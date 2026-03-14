// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title DEXPair
 * @notice Constant-product AMM pair (x * y = k), Uniswap V2 style.
 *         LP tokens are minted to liquidity providers.
 *
 * Fee: 0.3% per swap (997/1000 on input amount).
 * Protocol fee: 1/6 of the 0.3% (when feeTo != address(0)).
 */
contract DEXPair is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant MINIMUM_LIQUIDITY = 1_000;  // Locked on first mint
    // OZ v5 disallows minting to address(0); use a dead address instead
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 private constant FEE_NUMERATOR    = 997;
    uint256 private constant FEE_DENOMINATOR  = 1_000;

    // ─── State ────────────────────────────────────────────────────────────────
    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32  private blockTimestampLast;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint256 public kLast; // reserve0 * reserve1. Updated on liquidity events only.

    // ─── Events ───────────────────────────────────────────────────────────────
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _token0, address _token1, address _factory)
        ERC20("DEX LP Token", "DEX-LP")
    {
        token0  = _token0;
        token1  = _token1;
        factory = _factory;
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    function getReserves()
        public
        view
        returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)
    {
        _reserve0          = reserve0;
        _reserve1          = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /**
     * @dev Update reserves and TWAP accumulators.
     *      Accumulators use UQ112.112 fixed-point arithmetic.
     */
    function _update(
        uint256 balance0,
        uint256 balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "DEXPair: OVERFLOW");

        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed    = blockTimestamp - blockTimestampLast;

        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // price = reserve1 / reserve0 expressed as UQ112.112
            price0CumulativeLast += (uint256(_reserve1) * 2 ** 112 / uint256(_reserve0)) * timeElapsed;
            price1CumulativeLast += (uint256(_reserve0) * 2 ** 112 / uint256(_reserve1)) * timeElapsed;
        }

        reserve0           = uint112(balance0);
        reserve1           = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    /**
     * @dev Mint protocol fee LP tokens when feeTo is set.
     *      Equivalent to 1/6 of the 0.3% fee (= ~0.05% of volume).
     */
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        address feeTo = _getFeeTo();
        feeOn = feeTo != address(0);
        uint256 _kLast = kLast;

        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK     = Math.sqrt(uint256(_reserve0) * uint256(_reserve1));
                uint256 rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator   = totalSupply() * (rootK - rootKLast);
                    uint256 denominator = rootK * 5 + rootKLast;
                    uint256 liquidity   = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    function _getFeeTo() private view returns (address) {
        (bool ok, bytes memory data) = factory.staticcall(abi.encodeWithSignature("feeTo()"));
        if (!ok || data.length == 0) return address(0);
        return abi.decode(data, (address));
    }

    // ─── Core AMM functions ───────────────────────────────────────────────────

    /**
     * @notice Add liquidity. Tokens must be transferred in BEFORE calling mint.
     * @param  to Recipient of LP tokens.
     */
    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0  = balance0 - _reserve0;
        uint256 amount1  = balance1 - _reserve1;

        bool feeOn        = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            // Geometric mean minus minimum liquidity (locked forever at DEAD address)
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(DEAD, MINIMUM_LIQUIDITY);
        } else {
            liquidity = Math.min(
                amount0 * _totalSupply / _reserve0,
                amount1 * _totalSupply / _reserve1
            );
        }

        require(liquidity > 0, "DEXPair: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0) * reserve1;
        emit Mint(msg.sender, amount0, amount1);
    }

    /**
     * @notice Remove liquidity. LP tokens must be transferred in BEFORE calling burn.
     * @param  to Recipient of underlying tokens.
     */
    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0  = IERC20(token0).balanceOf(address(this));
        uint256 balance1  = IERC20(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        bool feeOn        = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();

        amount0 = liquidity * balance0 / _totalSupply;
        amount1 = liquidity * balance1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "DEXPair: INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);

        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint256(reserve0) * reserve1;
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /**
     * @notice Swap tokens. Exactly one of amount0Out / amount1Out must be > 0.
     *         Optionally pass calldata `data` to trigger a flash-swap callback.
     * @param  amount0Out Amount of token0 to send out.
     * @param  amount1Out Amount of token1 to send out.
     * @param  to         Recipient.
     */
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to
    ) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "DEXPair: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "DEXPair: INSUFFICIENT_LIQUIDITY");
        require(to != token0 && to != token1, "DEXPair: INVALID_TO");

        if (amount0Out > 0) IERC20(token0).safeTransfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).safeTransfer(to, amount1Out);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "DEXPair: INSUFFICIENT_INPUT_AMOUNT");

        // k invariant check: (balance - 0.3% fee) satisfies constant product
        uint256 balance0Adjusted = balance0 * FEE_DENOMINATOR - amount0In * (FEE_DENOMINATOR - FEE_NUMERATOR);
        uint256 balance1Adjusted = balance1 * FEE_DENOMINATOR - amount1In * (FEE_DENOMINATOR - FEE_NUMERATOR);
        require(
            balance0Adjusted * balance1Adjusted >=
            uint256(_reserve0) * uint256(_reserve1) * FEE_DENOMINATOR ** 2,
            "DEXPair: K"
        );

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /// @notice Sync reserves to match actual balances.
    function sync() external nonReentrant {
        _update(
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this)),
            reserve0,
            reserve1
        );
    }
}
