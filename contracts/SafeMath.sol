// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;


/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error.
 * No checks necessary for solidity >= 0.8.
 * From zeppelin-solidity
 */
library SafeMath {

    /**
    * @dev Multiplies two unsigned integers, throws on overflow.
    */
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        return a * b;
    }

    /**
    * @dev Multiplies two signed integers, throws on overflow.
    */
    function mul(int256 a, int256 b) internal pure returns (int256) {
        return a * b;
    }

    /**
    * @dev Integer division of two unsigned integers, truncating the quotient.
    */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return a / b;
    }

    /**
    * @dev Integer division of two signed integers, truncating the quotient.
    */
    function div(int256 a, int256 b) internal pure returns (int256) {
        return a / b;
    }

    /**
    * @dev Subtracts two unsigned integers, throws on overflow (i.e. if subtrahend is greater than minuend).
    */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a - b;
    }

    /**
    * @dev Subtracts two signed integers, throws on overflow.
    */
    function sub(int256 a, int256 b) internal pure returns (int256) {
        return a - b;
    }

    /**
    * @dev Adds two unsigned integers, throws on overflow.
    */
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        return a + b;
    }

    /**
    * @dev Adds two signed integers, throws on overflow.
    */
    function add(int256 a, int256 b) internal pure returns (int256) {
        return a + b;
    }
}
