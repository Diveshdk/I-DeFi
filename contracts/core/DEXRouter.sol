// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DEXFactory.sol";
import "./DEXPair.sol";

/**
 * @title DEXRouter
 * @notice User-facing router for add/remove liquidity and token swaps.
 *         Handles token transfers, slippage checks, and deadline protection.
 *         Modeled after Uniswap V2 Router.
 */
contract DEXRouter {
    using SafeERC20 for IERC20;

    DEXFactory public immutable factory;

    error Expired();
    error InsufficientAAmount();
    error InsufficientBAmount();
    error InsufficientOutputAmount();
    error InsufficientInputAmount();
    error InvalidPath();
    error PairNotFound();

    modifier ensure(uint256 deadline) {
        if (deadline < block.timestamp) revert Expired();
        _;
    }

    constructor(address _factory) {
        factory = DEXFactory(_factory);
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _getPair(address tokenA, address tokenB) internal view returns (DEXPair pair) {
        address pairAddr = factory.getPair(tokenA, tokenB);
        if (pairAddr == address(0)) revert PairNotFound();
        pair = DEXPair(pairAddr);
    }

    /**
     * @dev Given an input amount and reserves, compute the maximum output (0.3% fee).
     *      amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientInputAmount();
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1_000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @dev Given an output amount and reserves, compute the required input amount.
     *      amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1
     */
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountIn) {
        if (amountOut == 0) revert InsufficientOutputAmount();
        uint256 numerator = reserveIn * amountOut * 1_000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = numerator / denominator + 1;
    }

    /**
     * @notice Compute output amounts for a multi-hop swap path.
     * @param  amountIn Starting input amount.
     * @param  path     Array of token addresses [tokenIn, ..., tokenOut].
     * @return amounts  Array of amounts at each hop.
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        if (path.length < 2) revert InvalidPath();
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pairAddr = factory.getPair(path[i], path[i + 1]);
            if (pairAddr == address(0)) revert PairNotFound();
            DEXPair pair = DEXPair(pairAddr);
            (uint112 r0, uint112 r1,) = pair.getReserves();
            (uint256 rIn, uint256 rOut) = path[i] < path[i + 1] ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
            amounts[i + 1] = getAmountOut(amounts[i], rIn, rOut);
        }
    }

    /**
     * @notice Compute input amounts for a multi-hop swap path (reverse).
     */
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        if (path.length < 2) revert InvalidPath();
        amounts = new uint256[](path.length);
        amounts[path.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            address pairAddr = factory.getPair(path[i - 1], path[i]);
            if (pairAddr == address(0)) revert PairNotFound();
            DEXPair pair = DEXPair(pairAddr);
            (uint112 r0, uint112 r1,) = pair.getReserves();
            (uint256 rIn, uint256 rOut) = path[i - 1] < path[i] ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
            amounts[i - 1] = getAmountIn(amounts[i], rIn, rOut);
        }
    }

    // ─── Liquidity ───────────────────────────────────────────────────────────

    /**
     * @notice Add liquidity to a tokenA/tokenB pair.
     *         Creates the pair if it doesn't exist yet.
     * @param  amountADesired Max amount of tokenA to deposit.
     * @param  amountBDesired Max amount of tokenB to deposit.
     * @param  amountAMin     Revert if actual tokenA < amountAMin (slippage).
     * @param  amountBMin     Revert if actual tokenB < amountBMin (slippage).
     * @param  to             Recipient of LP tokens.
     * @param  deadline       Unix timestamp after which tx reverts.
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Create pair if needed
        if (factory.getPair(tokenA, tokenB) == address(0)) {
            factory.createPair(tokenA, tokenB);
        }

        DEXPair pair = _getPair(tokenA, tokenB);
        (uint112 r0, uint112 r1,) = pair.getReserves();

        // Determine canonical order
        bool aIsToken0 = tokenA < tokenB;
        uint256 reserveA = aIsToken0 ? r0 : r1;
        uint256 reserveB = aIsToken0 ? r1 : r0;

        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = _quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                if (amountBOptimal < amountBMin) revert InsufficientBAmount();
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = _quote(amountBDesired, reserveB, reserveA);
                if (amountAOptimal < amountAMin) revert InsufficientAAmount();
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        address pairAddr = address(pair);
        IERC20(tokenA).safeTransferFrom(msg.sender, pairAddr, amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, pairAddr, amountB);
        liquidity = pair.mint(to);
    }

    /**
     * @notice Remove liquidity from a tokenA/tokenB pair.
     * @param  liquidity   Amount of LP tokens to burn.
     * @param  amountAMin  Minimum tokenA to receive.
     * @param  amountBMin  Minimum tokenB to receive.
     * @param  to          Recipient of underlying tokens.
     * @param  deadline    Unix timestamp deadline.
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        DEXPair pair = _getPair(tokenA, tokenB);
        IERC20(address(pair)).safeTransferFrom(msg.sender, address(pair), liquidity);
        (uint256 amount0, uint256 amount1) = pair.burn(to);

        bool aIsToken0 = tokenA < tokenB;
        (amountA, amountB) = aIsToken0 ? (amount0, amount1) : (amount1, amount0);
        if (amountA < amountAMin) revert InsufficientAAmount();
        if (amountB < amountBMin) revert InsufficientBAmount();
    }

    // ─── Swaps ───────────────────────────────────────────────────────────────

    /**
     * @notice Swap an exact amount of input tokens for as many output tokens as possible.
     * @param  amountIn     Exact input amount.
     * @param  amountOutMin Minimum output (slippage protection).
     * @param  path         [tokenIn, ..., tokenOut] swap route.
     * @param  to           Recipient of output tokens.
     * @param  deadline     Unix timestamp deadline.
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();

        // Transfer input to first pair
        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            factory.getPair(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    /**
     * @notice Swap tokens for an exact output amount.
     * @param  amountOut    Exact output desired.
     * @param  amountInMax  Maximum input to spend.
     * @param  path         [tokenIn, ..., tokenOut] swap route.
     * @param  to           Recipient of output tokens.
     * @param  deadline     Unix timestamp deadline.
     */
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsIn(amountOut, path);
        if (amounts[0] > amountInMax) revert InsufficientInputAmount();

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            factory.getPair(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    // ─── Private swap executor ────────────────────────────────────────────────

    function _swap(uint256[] memory amounts, address[] calldata path, address _to) internal {
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            bool inputIsToken0 = input < output;
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = inputIsToken0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));

            // Send to next pair or final recipient
            address pairAddr = factory.getPair(input, output);
            address recipient = i < path.length - 2
                ? factory.getPair(path[i + 1], path[i + 2])
                : _to;

            DEXPair(pairAddr).swap(amount0Out, amount1Out, recipient);
        }
    }

    // ─── Pure quote helper ────────────────────────────────────────────────────

    /// @dev Pro-rata quote: amountB = amountA * reserveB / reserveA
    function _quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        internal
        pure
        returns (uint256 amountB)
    {
        amountB = amountA * reserveB / reserveA;
    }

    /// @notice Public wrapper for the quote helper (used by frontends).
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        external
        pure
        returns (uint256 amountB)
    {
        return _quote(amountA, reserveA, reserveB);
    }
}
