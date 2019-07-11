pragma solidity ^0.5.0;

import "./GameInterface.sol";
import "./Utilities.sol";
import "../SafeMath.sol";
import "../SafeCast.sol";


contract Wheel is GameInterface, Utilities {
    using SafeCast for uint;
    using SafeMath for uint;

    uint public constant MAX_BET_DIVIDER = 10000;

    uint public constant PAYOUT_DIVIDER = 100;

    uint public constant RESULT_RANGE = 600;

    mapping (uint => mapping(uint => uint16)) public MAX_BET;

    mapping (uint => mapping(uint => uint16[])) public PAYOUT;

    constructor() public {
        MAX_BET[1][10] = 632;
        MAX_BET[1][20] = 386;
        MAX_BET[2][10] = 134;
        MAX_BET[2][20] = 134;
        MAX_BET[3][10] = 17;
        MAX_BET[3][20] = 8;

        PAYOUT[1][10] = [0, 120, 120, 0, 120, 120, 145, 120, 120, 120];
        PAYOUT[1][20] = [0, 120, 120, 0, 120, 120, 145, 120, 0, 120, 240, 120, 0, 120, 120, 145, 120, 0, 120, 120];
        PAYOUT[2][10] = [0, 165, 0, 160, 0, 300, 0, 160, 0, 200];
        PAYOUT[2][20] = [0, 165, 0, 160, 0, 300, 0, 160, 0, 200, 0, 165, 0, 160, 0, 300, 0, 160, 0, 200];
        PAYOUT[3][10] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 985];
        PAYOUT[3][20] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1970];
    }

    modifier onlyValidNum(uint _betNum) {
        uint risk = getRisk(_betNum);
        uint segments = getSegments(_betNum);

        require(risk >= 1 && risk <= 3 && segments >= 10 && segments <= 20 && segments % 10 == 0, "Invalid num");
        _;
    }

    modifier onlyValidResultNum(uint _resultNum) {
        require(_resultNum >= 0 && _resultNum < RESULT_RANGE);
        _;
    }

    function maxBet(uint _betNum, uint _bankRoll) external onlyValidNum(_betNum) view returns(uint) {
        uint risk = getRisk(_betNum);
        uint segments = getSegments(_betNum);
        uint maxBetValue = MAX_BET[risk][segments];

        return _bankRoll.mul(maxBetValue).div(MAX_BET_DIVIDER);
    }

    function resultNumber(bytes32 _serverSeed, bytes32 _userSeed, uint _betNum) external onlyValidNum(_betNum) view returns(uint) {
        uint randNum = Utilities.generateRandomNumber(_serverSeed, _userSeed);
        return randNum % RESULT_RANGE;
    }

    function userProfit(uint _betNum, uint _betValue, uint _resultNum)
        external
        onlyValidNum(_betNum)
        onlyValidResultNum(_resultNum)
        view
        returns(int)
    {
        uint risk = getRisk(_betNum);
        uint segments = getSegments(_betNum);
        uint16[] storage payout = PAYOUT[risk][segments];
        uint16 payoutValue = payout[_resultNum.mul(payout.length).div(RESULT_RANGE)];

        return calculateProfit(payoutValue, _betValue);
    }


    function maxUserProfit(uint _betNum, uint _betValue) external onlyValidNum(_betNum) view returns(int) {
        uint risk = getRisk(_betNum);
        uint segments = getSegments(_betNum);

        uint16[] storage payout = PAYOUT[risk][segments];
        uint maxPayout = 0;
        for (uint i = 0; i < payout.length; i++) {
            if (payout[i] > maxPayout) {
                maxPayout = payout[i];
            }
        }

        return calculateProfit(maxPayout, _betValue);
    }

    function calculateProfit(uint _payout, uint _betValue) private pure returns(int) {
        return _betValue.mul(_payout).div(PAYOUT_DIVIDER).castToInt().sub(_betValue.castToInt());
    }

    function getRisk(uint _num) private pure returns(uint) {
        return (_num / 100) % 10;
    }

    function getSegments(uint _num) private pure returns(uint) {
        return _num % 100;
    }
}
