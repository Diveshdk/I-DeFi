pragma solidity =0.5.16;

library UQ112x112 {
    uint224 constant Q112 = 2**112;
    function encode(uint112 y) internal pure returns (uint224) {
        return uint224(uint256(y) * uint256(Q112));
    }
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224) {
        return uint224(x / uint224(y));
    }
}
