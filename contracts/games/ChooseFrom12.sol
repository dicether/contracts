pragma solidity ^0.5.0;

import "./GameInterface.sol";
import "./Utilities.sol";
import "../SafeMath.sol";
import "../SafeCast.sol";


contract ChooseFrom12 is GameInterface, Utilities {
    using SafeCast for uint;
    using SafeMath for uint;

    uint private constant NUMBERS = 12;

    modifier onlyValidNum(uint _betNum) {
        require(_betNum > 0 && _betNum < ((1 << NUMBERS) - 1), "Invalid num");
        _;
    }

    modifier onlyValidResultNum(uint _resultNum) {
         require(_resultNum >= 0 &&  _resultNum < NUMBERS);
        _;
    }

    function maxBet(uint _betNum, uint _bankRoll) external onlyValidNum(_betNum) view returns(uint) {
        uint probability = getSelectedBits(_betNum).mul(Utilities.PROBABILITY_DIVISOR) / NUMBERS;
        return Utilities.maxBetFromProbability(probability, _bankRoll);
    }

    function resultNumber(bytes32 _serverSeed, bytes32 _userSeed, uint _betNum) external onlyValidNum(_betNum) view returns(uint) {
        uint randNum = Utilities.generateRandomNumber(_serverSeed, _userSeed);
        return randNum % NUMBERS;
    }

    function userProfit(uint _betNum, uint _betValue, uint _resultNum)
        external
        onlyValidNum(_betNum)
        onlyValidResultNum(_resultNum)
        view
        returns(int)
    {
        bool won = (_betNum & (1 <<_resultNum)) > 0;
        if (won) {
            uint totalWon = _betValue.mul(NUMBERS).div(getSelectedBits(_betNum));
            return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
        } else {
            return -_betValue.castToInt();
        }
    }

    function maxUserProfit(uint _betNum, uint _betValue) external onlyValidNum(_betNum) view returns(int) {
        uint totalWon = _betValue.mul(NUMBERS) / getSelectedBits(_betNum);
        return Utilities.calcProfitFromTotalWon(totalWon, _betValue);
    }

    function getSelectedBits(uint _num) private pure returns(uint) {
        uint selectedBits = 0;
        // Could be calculated more efficient.
        // But as it's only needed if a conflict arises, let's keeps it simple.
        for (uint i = 0; i < NUMBERS; i++) {
            if (_num & (1 << i) > 0) {
                selectedBits += 1;
            }
        }
        return selectedBits;
    }
}
