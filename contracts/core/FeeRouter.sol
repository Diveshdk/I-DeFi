// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);

    function WETH() external pure returns (address);
}

/**
 * @title FeeRouter
 * @notice Wraps Uniswap V2 Router and takes a 0.3% fee on every swap.
 *         Fee is sent to the contract owner (feeRecipient).
 */
contract FeeRouter {
    address public immutable uniswapRouter;
    address public feeRecipient;
    address public owner;

    uint256 public constant FEE_BPS = 30; // 0.30% = 30 basis points
    uint256 public constant BPS_DENOM = 10_000;

    event FeeCollected(address indexed token, uint256 feeAmount);
    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "FeeRouter: not owner");
        _;
    }

    constructor(address _uniswapRouter, address _feeRecipient) {
        require(_uniswapRouter != address(0), "FeeRouter: zero router");
        require(_feeRecipient != address(0), "FeeRouter: zero recipient");
        uniswapRouter = _uniswapRouter;
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }

    // ── Token → Token ─────────────────────────────────────────────────────────

    /**
     * @notice Swap ERC-20 → ERC-20 with 0.3% fee deducted from amountIn.
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 _deadline
    ) external returns (uint256[] memory amounts) {
        address tokenIn = path[0];

        // Pull full amountIn from user
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "FeeRouter: transferFrom failed"
        );

        // Deduct fee
        uint256 fee = (amountIn * FEE_BPS) / BPS_DENOM;
        uint256 amountInAfterFee = amountIn - fee;

        // Send fee to recipient
        if (fee > 0) {
            require(IERC20(tokenIn).transfer(feeRecipient, fee), "FeeRouter: fee transfer failed");
            emit FeeCollected(tokenIn, fee);
        }

        // Approve router for the net amount
        IERC20(tokenIn).approve(uniswapRouter, amountInAfterFee);

        // Execute swap
        amounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            amountInAfterFee,
            amountOutMin,
            path,
            to,
            _deadline
        );

        emit SwapExecuted(msg.sender, tokenIn, path[path.length - 1], amountIn, amounts[amounts.length - 1]);
    }

    // ── ETH → Token ───────────────────────────────────────────────────────────

    /**
     * @notice Swap ETH → ERC-20 with 0.3% fee deducted from msg.value.
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 _deadline
    ) external payable returns (uint256[] memory amounts) {
        require(msg.value > 0, "FeeRouter: no ETH sent");

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 ethAfterFee = msg.value - fee;

        // Send fee in ETH
        if (fee > 0) {
            (bool sent, ) = feeRecipient.call{value: fee}("");
            require(sent, "FeeRouter: ETH fee transfer failed");
            emit FeeCollected(address(0), fee);
        }

        // Swap the remaining ETH
        amounts = IUniswapV2Router02(uniswapRouter).swapExactETHForTokens{value: ethAfterFee}(
            amountOutMin,
            path,
            to,
            _deadline
        );

        emit SwapExecuted(msg.sender, path[0], path[path.length - 1], msg.value, amounts[amounts.length - 1]);
    }

    // ── Token → ETH ───────────────────────────────────────────────────────────

    /**
     * @notice Swap ERC-20 → ETH with 0.3% fee deducted from amountIn.
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 _deadline
    ) external returns (uint256[] memory amounts) {
        address tokenIn = path[0];

        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "FeeRouter: transferFrom failed"
        );

        uint256 fee = (amountIn * FEE_BPS) / BPS_DENOM;
        uint256 amountInAfterFee = amountIn - fee;

        if (fee > 0) {
            require(IERC20(tokenIn).transfer(feeRecipient, fee), "FeeRouter: fee transfer failed");
            emit FeeCollected(tokenIn, fee);
        }

        IERC20(tokenIn).approve(uniswapRouter, amountInAfterFee);

        amounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForETH(
            amountInAfterFee,
            amountOutMin,
            path,
            to,
            _deadline
        );

        emit SwapExecuted(msg.sender, tokenIn, path[path.length - 1], amountIn, amounts[amounts.length - 1]);
    }

    // ── Quote passthrough ─────────────────────────────────────────────────────

    /**
     * @notice Mirrors Uniswap's getAmountsOut — accounts for the fee already deducted.
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts)
    {
        uint256 fee = (amountIn * FEE_BPS) / BPS_DENOM;
        uint256 amountInAfterFee = amountIn - fee;
        return IUniswapV2Router02(uniswapRouter).getAmountsOut(amountInAfterFee, path);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "FeeRouter: zero address");
        feeRecipient = _feeRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FeeRouter: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Accept ETH refunds from router
    receive() external payable {}
}
