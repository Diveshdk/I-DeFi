// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC20Token
 * @notice Generic mintable ERC20 token used for testing and deployment.
 *         Owner can mint additional supply at any time.
 */
contract ERC20Token is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply,
        address owner_
    ) ERC20(name, symbol) Ownable(owner_) {
        _decimals = decimals_;
        _mint(owner_, initialSupply);
    }

    /// @notice Mint tokens to any address (owner only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
