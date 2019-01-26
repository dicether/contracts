pragma solidity ^0.5.0;

import "./GameInterface.sol";
import "./Utilities.sol";
import "../SafeMath.sol";
import "../SafeCast.sol";


contract FlipACoin is GameInterface, Utilities {
    using SafeCast for uint;
    using SafeMath for uint;

    uint private RANGE = 2;

    modifier onlyValidNum(uint _betNum) {
        require(_betNum >= 0 && _betNum <= 1, "Invalid num");
        _;
    }

    function maxBet(uint _betNum, uint _bankRoll) external onlyValidNum(_betNum) view returns(uint) {
        uint probability = Utilities.PROBABILITY_DIVISOR / RANGE;
        return Utilities.maxBetFromProbability(probability, _bankRoll);
    }

    function resultNumber(bytes32 _serverSeed, bytes32 _userSeed, uint _betNum) external onlyValidNum(_betNum) view returns(uint) {
        uint randNum = Utilities.generateRandomNumber(_serverSeed, _userSeed);
        return randNum % RANGE;
    }

    function userProfit(uint _betNum, uint _betValue, uint _resultNum)
        external
        onlyValidNum(_betNum)
        onlyValidNum(_resultNum)
        view
        returns(int)
    {
        bool won = _resultNum == _betNum;
        if (won) {
            uint totalWon = _betValue.mul(RANGE);
            return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
        } else {
            return -_betValue.castToInt();
        }
    }

    function maxUserProfit(uint _betNum, uint _betValue) external onlyValidNum(_betNum) view returns(int) {
        uint totalWon = _betValue.mul(RANGE);
        return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
    }
}
