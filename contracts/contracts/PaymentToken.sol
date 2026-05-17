// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title  PaymentToken
/// @notice ERC-20 platform currency used to settle property-share purchases.
///         The contract owner can mint freely so testers can experience the
///         dApp on Sepolia without acquiring real-world value.
contract PaymentToken is ERC20, Ownable {
    error ZeroAddress();
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {}

    /// @notice Owner-only mint. Used as a demo faucet on Sepolia.
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }
}
