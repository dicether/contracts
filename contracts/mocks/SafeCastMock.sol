pragma solidity ^0.5.0;

import "../SafeCast.sol";


contract SafeCastMock {
    function castToInt(uint a) public pure returns(int) {
        return SafeCast.castToInt(a);
    }

    function castToUint(int a) public pure returns(uint) {
        return SafeCast.castToUint(a);
    }
}
