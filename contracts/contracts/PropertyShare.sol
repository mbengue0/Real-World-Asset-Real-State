// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  PropertyShare
/// @notice Fixed-supply ERC-20 representing fractional ownership of a single
///         real-estate property. The full supply is minted to the deploying
///         factory at construction (custodial model — factory transfers shares
///         to buyers as purchases settle).
/// @dev    Decimals are 0: shares are whole units. Strings cannot be `immutable`
///         in Solidity, so the metadata URI is stored only in the factory registry.
contract PropertyShare is ERC20 {
    /// @notice The PropertyFactory that deployed this contract.
    address public immutable factory;

    /// @notice Stable identifier matching this property in the factory registry.
    uint256 public immutable propertyId;

    constructor(
        address factory_,
        uint256 propertyId_,
        uint256 totalShares_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        factory = factory_;
        propertyId = propertyId_;
        _mint(factory_, totalShares_);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }
}
