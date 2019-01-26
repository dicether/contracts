pragma solidity ^0.5.0;

import "./GameInterface.sol";
import "./Utilities.sol";
import "../SafeMath.sol";
import "../SafeCast.sol";


contract Keno is GameInterface, Utilities {
    using SafeCast for uint;
    using SafeMath for uint;

    /// @dev divider for PAY_OUT and MAX_BET
    uint public constant DIVIDER = 1000;

    /// @dev #selectable fields
    uint public constant SELECTABLE_FIELDS = 10;

    /// @dev #available fields
    uint public constant FIELDS = 40;

    /// @dev max bet table as fraction of bankroll
    uint16[11] public MAX_BET = [0, 5, 10, 7, 5, 4, 4, 2, 2, 2, 1];

    /// @dev payout multiplier table, first index: selected fields, second: hits
    uint24[][11] public PAY_OUT;

    event LogGameCreated(uint num);

    constructor() public {
        // setup payout table
        PAY_OUT[0]  = [0];
        PAY_OUT[1]  = [0, 3940];
        PAY_OUT[2]  = [0, 2000, 3740];
        PAY_OUT[3]  = [0, 1000, 3150, 9400];
        PAY_OUT[4]  = [0, 800, 1700, 5300, 24500];
        PAY_OUT[5]  = [0, 250, 1400, 4000, 16600, 42000];
        PAY_OUT[6]  = [0, 0, 1000, 3650, 7000, 16000, 46000];
        PAY_OUT[7]  = [0, 0, 460, 3000, 4400, 14000, 39000, 80000];
        PAY_OUT[8]  = [0, 0, 0, 2250, 4000, 11000, 30000, 67000, 90000];
        PAY_OUT[9]  = [0, 0, 0, 1550, 3000, 8000, 14000, 37000, 65000, 100000];
        PAY_OUT[10] = [0, 0, 0, 1400, 2200, 4400, 8000, 28000, 60000, 120000, 200000];
    }

    modifier onlyValidNum(uint _betNum) {
        require(_betNum > 0 && _betNum < (1 << FIELDS) && getSelectedBits(_betNum) <= SELECTABLE_FIELDS, "Invalid num");
        _;
    }

    modifier onlyValidResultNum(uint _resultNum) {
        require(_resultNum < (1 << FIELDS) && getSelectedBits(_resultNum) == SELECTABLE_FIELDS);
        _;
    }

    function maxBet(uint _betNum, uint _bankRoll) external onlyValidNum(_betNum) view returns(uint) {
        uint fields = getSelectedBits(_betNum);
        return uint(MAX_BET[fields]).mul(_bankRoll).div(DIVIDER);
    }

    function resultNumber(bytes32 _serverSeed, bytes32 _userSeed, uint _betNum) external onlyValidNum(_betNum) view returns(uint) {
        uint resultNum = 0;
        bytes32 seed = keccak256(abi.encodePacked(_serverSeed, _userSeed));

        for (uint i = 0; i < SELECTABLE_FIELDS; i++) {
            uint randNum = uint(seed) % (FIELDS - i);

            uint pos = 0;
            uint resultPos = 0;
            for (;;) {
                if (resultNum & (1 << resultPos) == 0) {
                    if (pos == randNum) {
                        break;
                    }
                    pos++;
                }
                resultPos++;
            }
            resultNum |= 1 << resultPos;

            // update seed
            seed = keccak256(abi.encodePacked(seed));
        }

        return resultNum;
    }

    function userProfit(uint _betNum, uint _betValue, uint _resultNum)
        external
        onlyValidNum(_betNum)
        onlyValidResultNum(_resultNum)
        view
        returns(int)
    {
        uint hits = getSelectedBits(_betNum & _resultNum);
        uint selected = getSelectedBits(_betNum);

        return calcProfit(_betValue, selected, hits);
    }

    function maxUserProfit(uint _betNum, uint _betValue) external onlyValidNum(_betNum) view returns(int) {
        uint selected = getSelectedBits(_betNum);

        return calcProfit(_betValue, selected, selected);
    }

    function calcProfit(uint _betValue, uint _selected, uint _hits) private view returns(int) {
        assert(_hits <= _selected);
        assert(_selected <= SELECTABLE_FIELDS);

        uint payoutMultiplier = PAY_OUT[_selected][_hits];
        uint payout = _betValue.mul(payoutMultiplier).div(DIVIDER);
        return payout.castToInt().sub(_betValue.castToInt());
    }

    function getSelectedBits(uint _num) private pure returns(uint) {
        uint selectedBits = 0;
        // Could be calculated more efficient.
        // But as it's only needed if a conflict arises, let's keep it simple.
        for (uint i = 0; i < FIELDS; i++) {
            if (_num & (1 << i) > 0) {
                selectedBits += 1;
            }
        }
        return selectedBits;
    }
}
