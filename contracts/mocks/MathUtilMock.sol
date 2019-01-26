pragma solidity ^0.5.0;

import "../MathUtil.sol";


contract MathUtilMock {
    function abs(int _val) public pure returns(uint) {
        return MathUtil.abs(_val);
    }

    function max(uint _val1, uint _val2) public pure returns(uint) {
        return MathUtil.max(_val1, _val2);
    }

    function min(uint _val1, uint _val2) public pure returns(uint) {
        return MathUtil.min(_val1, _val2);
    }
}
