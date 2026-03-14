// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DEXPair.sol";

/**
 * @title DEXFactory
 * @notice Creates and tracks DEXPair contracts.
 *         Modeled after Uniswap V2 Factory.
 */
contract DEXFactory {
    address public owner;
    address public feeTo;           // Protocol fee recipient (0 = fee off)

    // token0 => token1 => pair address (always token0 < token1)
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 totalPairs);
    event FeeToUpdated(address indexed feeTo);
    event OwnerUpdated(address indexed newOwner);

    error IdenticalAddresses();
    error ZeroAddress();
    error PairExists();

    modifier onlyOwner() {
        require(msg.sender == owner, "DEXFactory: FORBIDDEN");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /**
     * @notice Deploy a new liquidity pair for tokenA and tokenB.
     * @dev    Tokens are sorted so token0 < token1 to ensure a canonical address.
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalAddresses();
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (token0 == address(0)) revert ZeroAddress();
        if (getPair[token0][token1] != address(0)) revert PairExists();

        DEXPair newPair = new DEXPair(token0, token1, address(this));
        pair = address(newPair);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // reverse mapping for convenience
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    /// @notice Set protocol fee recipient. Zero address disables protocol fees.
    function setFeeTo(address _feeTo) external onlyOwner {
        feeTo = _feeTo;
        emit FeeToUpdated(_feeTo);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "DEXFactory: ZERO_ADDRESS");
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }
}
