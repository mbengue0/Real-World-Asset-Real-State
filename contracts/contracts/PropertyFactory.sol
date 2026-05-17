// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {PropertyShare} from "./PropertyShare.sol";

/// @title  PropertyFactory
/// @notice Registry and primary marketplace for tokenized real estate.
///         The owner lists properties; investors buy fractional shares
///         settled in a configured PaymentToken. Each listing deploys
///         one new PropertyShare ERC-20.
contract PropertyFactory is Ownable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    enum Status { Listed, SoldOut, Delisted }

    /// @dev Storage layout (3 packed slots + dynamic string):
    ///      slot 0 → shareContract (20B) + pricePerShare (12B)
    ///      slot 1 → seller        (20B) + listedAt      (8B) + totalShares (4B)
    ///      slot 2 → sharesSold    (4B)  + status        (1B)
    ///      slot 3+ → metadataURI (dynamic)
    struct Property {
        address shareContract;
        uint96  pricePerShare;
        address seller;
        uint64  listedAt;
        uint32  totalShares;
        uint32  sharesSold;
        Status  status;
        string  metadataURI;
    }

    IERC20 public immutable paymentToken;
    uint256 public totalProperties;

    mapping(uint256 propertyId => Property property) private _properties;

    // ── Events ────────────────────────────────────────────────────────────
    event PropertyListed(
        uint256 indexed propertyId,
        address indexed seller,
        address shareContract,
        uint256 totalShares,
        uint256 pricePerShare,
        string  metadataURI
    );
    event SharesPurchased(
        uint256 indexed propertyId,
        address indexed buyer,
        uint256 shares,
        uint256 paid
    );
    event PropertyDelisted(uint256 indexed propertyId);

    // ── Errors ────────────────────────────────────────────────────────────
    error ZeroAddress();
    error InvalidShares(uint256 requested);
    error InvalidPrice();
    error InsufficientShareSupply(uint256 requested, uint256 available);
    error PropertyNotListed(uint256 propertyId);
    error AlreadyDelisted(uint256 propertyId);

    constructor(address paymentToken_, address initialOwner) Ownable(initialOwner) {
        if (paymentToken_ == address(0) || initialOwner == address(0)) revert ZeroAddress();
        paymentToken = IERC20(paymentToken_);
    }

    /// @notice List a new property. Deploys a PropertyShare ERC-20 with the
    ///         full supply held by this factory.
    function listProperty(
        address seller,
        uint32  totalShares_,
        uint96  pricePerShare,
        string calldata metadataURI
    ) external onlyOwner returns (uint256 propertyId, address shareContract) {
        if (seller == address(0))   revert ZeroAddress();
        if (totalShares_ == 0)      revert InvalidShares(0);
        if (pricePerShare == 0)     revert InvalidPrice();

        unchecked { propertyId = ++totalProperties; }

        string memory name_   = string.concat("PropertyShare #", Strings.toString(propertyId));
        string memory symbol_ = string.concat("PS", Strings.toString(propertyId));

        PropertyShare share = new PropertyShare(
            address(this),
            propertyId,
            totalShares_,
            name_,
            symbol_
        );
        shareContract = address(share);

        _properties[propertyId] = Property({
            shareContract: shareContract,
            pricePerShare: pricePerShare,
            seller:        seller,
            listedAt:      uint64(block.timestamp),
            totalShares:   totalShares_,
            sharesSold:    0,
            status:        Status.Listed,
            metadataURI:   metadataURI
        });

        emit PropertyListed(propertyId, seller, shareContract, totalShares_, pricePerShare, metadataURI);
    }

    /// @notice Buy `shareCount` shares of `propertyId`. Caller must have
    ///         approved this contract for `shareCount * pricePerShare` PaymentToken.
    function buyShares(uint256 propertyId, uint256 shareCount) external nonReentrant {
        // ── CHECKS ────────────────────────────────────────────────────────
        Property storage prop = _properties[propertyId];
        address shareContract = prop.shareContract;
        if (shareContract == address(0))  revert PropertyNotListed(propertyId);
        if (prop.status != Status.Listed) revert PropertyNotListed(propertyId);
        if (shareCount == 0)              revert InvalidShares(0);

        uint256 available = prop.totalShares - prop.sharesSold;
        if (shareCount > available) revert InsufficientShareSupply(shareCount, available);

        uint256 totalCost = shareCount * prop.pricePerShare;

        // ── EFFECTS ───────────────────────────────────────────────────────
        // shareCount fits in uint32 because shareCount <= available <= uint32.
        uint32 newSold = prop.sharesSold + uint32(shareCount);
        prop.sharesSold = newSold;
        if (newSold == prop.totalShares) {
            prop.status = Status.SoldOut;
        }

        // Cache seller before interactions (shareContract already cached above)
        address seller = prop.seller;

        emit SharesPurchased(propertyId, msg.sender, shareCount, totalCost);

        // ── INTERACTIONS ──────────────────────────────────────────────────
        paymentToken.safeTransferFrom(msg.sender, seller, totalCost);
        IERC20(shareContract).safeTransfer(msg.sender, shareCount);
    }

    /// @notice Delist a property. Outstanding PropertyShare balances remain
    ///         valid and transferable — only further primary sales are blocked.
    function delistProperty(uint256 propertyId) external onlyOwner {
        Property storage prop = _properties[propertyId];
        if (prop.shareContract == address(0)) revert PropertyNotListed(propertyId);
        if (prop.status == Status.Delisted)   revert AlreadyDelisted(propertyId);
        prop.status = Status.Delisted;
        emit PropertyDelisted(propertyId);
    }

    function getProperty(uint256 propertyId) external view returns (Property memory) {
        return _properties[propertyId];
    }
}
