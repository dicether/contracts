// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./GameInterface.sol";
import "./Utilities.sol";
import "../SafeMath.sol";
import "../SafeCast.sol";


contract DiceLower is GameInterface, Utilities {
    using SafeCast for uint;
    using SafeMath for uint;

    uint private constant DICE_RANGE = 100;

    modifier onlyValidNum(uint _betNum) {
        require(_betNum > 0 && _betNum < DICE_RANGE - 1, "Invalid num");
        _;
    }

    modifier onlyValidResultNum(uint _resultNum) {
        require(_resultNum >= 0 && _resultNum < DICE_RANGE);
        _;
    }

    function maxBet(uint _betNum, uint _bankRoll) external onlyValidNum(_betNum) pure returns(uint) {
        uint probability = _betNum.mul(Utilities.PROBABILITY_DIVISOR) / DICE_RANGE;
        return Utilities.maxBetFromProbability(probability, _bankRoll);
    }

    function resultNumber(bytes32 _serverSeed, bytes32 _userSeed, uint _betNum) external onlyValidNum(_betNum) pure returns(uint) {
        uint randNum = Utilities.generateRandomNumber(_serverSeed, _userSeed);
        return randNum % DICE_RANGE;
    }

    function userProfit(uint _betNum, uint _betValue, uint _resultNum)
        external
        onlyValidNum(_betNum)
        onlyValidResultNum(_resultNum)
        pure
        returns(int)
    {
        bool won = _resultNum < _betNum;
        if (won) {
            uint totalWon = _betValue.mul(DICE_RANGE).div(_betNum);
            return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
        } else {
            return -_betValue.castToInt();
        }
    }

    function maxUserProfit(uint _betNum, uint _betValue) external onlyValidNum(_betNum) pure returns(int) {
        uint totalWon = _betValue.mul(DICE_RANGE).div(_betNum);
        return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
    }
}
