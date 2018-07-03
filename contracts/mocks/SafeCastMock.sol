pragma solidity ^0.4.24;

import "../SafeCast.sol";


contract SafeCastMock {
    function castToInt(uint a) public pure returns(int) {
        return SafeCast.castToInt(a);
    }

    function castToUint(int a) public pure returns(uint) {
        return SafeCast.castToUint(a);
    }
}
