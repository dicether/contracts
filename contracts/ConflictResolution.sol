pragma solidity ^0.4.24;

import "./ConflictResolutionInterface.sol";
import "./MathUtil.sol";
import "./SafeCast.sol";
import "./SafeMath.sol";


/**
 * @title Conflict Resolution
 * @dev Contract used for conflict resolution. Only needed if server or
 * user stops responding during game session.
 * @author dicether
 */
contract ConflictResolution is ConflictResolutionInterface {
    using SafeCast for int;
    using SafeCast for uint;
    using SafeMath for int;
    using SafeMath for uint;

    uint public constant DICE_RANGE = 100;
    uint public constant HOUSE_EDGE = 150;
    uint public constant HOUSE_EDGE_DIVISOR = 10000;

    uint public constant SERVER_TIMEOUT = 6 hours;
    uint public constant USER_TIMEOUT = 6 hours;

    uint8 public constant DICE_LOWER = 1; ///< @dev dice game lower number wins
    uint8 public constant DICE_HIGHER = 2; ///< @dev dice game higher number wins

    uint public constant MAX_BET_VALUE = 2e16; /// max 0.02 ether bet
    uint public constant MIN_BET_VALUE = 1e13; /// min 0.00001 ether bet

    int public constant NOT_ENDED_FINE = 1e15; /// 0.001 ether

    int public constant MAX_BALANCE = int(MAX_BET_VALUE) * 100 * 5;

    modifier onlyValidBet(uint8 _gameType, uint _betNum, uint _betValue) {
        require(isValidBet(_gameType, _betNum, _betValue));
        _;
    }

    modifier onlyValidBalance(int _balance, uint _gameStake) {
        // safe to cast gameStake as range is fixed
        require(-int(_gameStake) <= _balance && _balance <= MAX_BALANCE);
        _;
    }

    /**
     * @dev Check if bet is valid.
     * @param _gameType Game type.
     * @param _betNum Number of bet.
     * @param _betValue Value of bet.
     * @return True if bet is valid false otherwise.
     */
    function isValidBet(uint8 _gameType, uint _betNum, uint _betValue) public pure returns(bool) {
        bool validValue = MIN_BET_VALUE <= _betValue && _betValue <= MAX_BET_VALUE;
        bool validGame = false;

        if (_gameType == DICE_LOWER) {
            validGame = _betNum > 0 && _betNum < DICE_RANGE - 1;
        } else if (_gameType == DICE_HIGHER) {
            validGame = _betNum > 0 && _betNum < DICE_RANGE - 1;
        } else {
            validGame = false;
        }

        return validValue && validGame;
    }

    /**
     * @return Max balance.
     */
    function maxBalance() public pure returns(int) {
        return MAX_BALANCE;
    }

    /**
     * Calculate minimum needed house stake.
     */
    function minHouseStake(uint activeGames) public pure returns(uint) {
        return  MathUtil.min(activeGames, 1) * MAX_BET_VALUE * 400;
    }

    /**
     * @dev Calculates game result and returns new balance.
     * @param _gameType Type of game.
     * @param _betNum Bet number.
     * @param _betValue Value of bet.
     * @param _balance Current balance.
     * @param _serverSeed Server's seed of current round.
     * @param _userSeed User's seed of current round.
     * @return New game session balance.
     */
    function endGameConflict(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        bytes32 _serverSeed,
        bytes32 _userSeed
    )
        public
        view
        onlyValidBet(_gameType, _betNum, _betValue)
        onlyValidBalance(_balance, _stake)
        returns(int)
    {
        assert(_serverSeed != 0 && _userSeed != 0);

        int newBalance =  processBet(_gameType, _betNum, _betValue, _balance, _serverSeed, _userSeed);

        // do not allow balance below user stake
        int stake = _stake.castToInt();
        if (newBalance < -stake) {
            newBalance = -stake;
        }

        return newBalance;
    }

    /**
     * @dev Force end of game if user does not respond. Only possible after a time period.
     * to give the user a chance to respond.
     * @param _gameType Game type.
     * @param _betNum Bet number.
     * @param _betValue Bet value.
     * @param _balance Current balance.
     * @param _stake User stake.
     * @param _endInitiatedTime Time server initiated end.
     * @return New game session balance.
     */
    function serverForceGameEnd(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        uint _endInitiatedTime
    )
        public
        view
        onlyValidBalance(_balance, _stake)
        returns(int)
    {
        require(_endInitiatedTime + SERVER_TIMEOUT <= block.timestamp);
        require(isValidBet(_gameType, _betNum, _betValue)
                || (_gameType == 0 && _betNum == 0 && _betValue == 0 && _balance == 0));


        // assume user has lost
        int newBalance = _balance.sub(_betValue.castToInt());

        // penalize user as he didn't end game
        newBalance = newBalance.sub(NOT_ENDED_FINE);

        // do not allow balance below user stake
        int stake = _stake.castToInt();
        if (newBalance < -stake) {
            newBalance = -stake;
        }

        return newBalance;
    }

    /**
     * @dev Force end of game if server does not respond. Only possible after a time period
     * to give the server a chance to respond.
     * @param _gameType Game type.
     * @param _betNum Bet number.
     * @param _betValue Value of bet.
     * @param _balance Current balance.
     * @param _endInitiatedTime Time server initiated end.
     * @return New game session balance.
     */
    function userForceGameEnd(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint  _stake,
        uint _endInitiatedTime
    )
        public
        view
        onlyValidBalance(_balance, _stake)
        returns(int)
    {
        require(_endInitiatedTime + USER_TIMEOUT <= block.timestamp);
        require(isValidBet(_gameType, _betNum, _betValue) ||
                (_gameType == 0 && _betNum == 0 && _betValue == 0 && _balance == 0));

        int profit = 0;
        if (_gameType == 0 && _betNum == 0 && _betValue == 0 && _balance == 0) {
            // user cancelled game without playing
            profit = 0;
        } else {
            profit = calculateProfit(_gameType, _betNum, _betValue); // safe to cast as ranges are limited
        }

        // penalize server as it didn't end game
        profit = profit.add(NOT_ENDED_FINE);

        return _balance.add(profit);
    }

    /**
     * @dev Calculate new balance after executing bet.
     * @param _gameType game type.
     * @param _betNum Bet Number.
     * @param _betValue Value of bet.
     * @param _balance Current balance.
     * @param _serverSeed Server's seed
     * @param _userSeed User's seed
     * return new balance.
     */
    function processBet(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        bytes32 _serverSeed,
        bytes32 _userSeed
    )
        private
        pure
        returns (int)
    {
        bool won = hasUserWon(_gameType, _betNum, _serverSeed, _userSeed);
        if (!won) {
            return _balance.sub(_betValue.castToInt());
        } else {
            int profit = calculateProfit(_gameType, _betNum, _betValue);
            return _balance.add(profit);
        }
    }

    /**
     * @dev Calculate user profit.
     * @param _gameType type of game.
     * @param _betNum bet numbe.
     * @param _betValue bet value.
     * return profit of user
     */
    function calculateProfit(uint8 _gameType, uint _betNum, uint _betValue) private pure returns(int) {
        uint betValueInGwei = _betValue / 1e9; // convert to gwei
        int res = 0;

        if (_gameType == DICE_LOWER) {
            res = calculateProfitGameType1(_betNum, betValueInGwei);
        } else if (_gameType == DICE_HIGHER) {
            res = calculateProfitGameType2(_betNum, betValueInGwei);
        } else {
            assert(false);
        }
        return res.mul(1e9); // convert to wei
    }

    /**
     * Calculate user profit from total won.
     * @param _totalWon user winning in gwei.
     * @return user profit in gwei.
     */
    function calcProfitFromTotalWon(uint _totalWon, uint _betValue) private pure returns(int) {
        // safe to multiply as _totalWon range is fixed.
        uint houseEdgeValue = _totalWon.mul(HOUSE_EDGE).div(HOUSE_EDGE_DIVISOR);

        // safe to cast as all value ranges are fixed
        return _totalWon.castToInt().sub(houseEdgeValue.castToInt()).sub(_betValue.castToInt());
    }

    /**
     * @dev Calculate user profit if user has won for game type 1 (dice lower wins).
     * @param _betNum Bet number of user.
     * @param _betValue Value of bet in gwei.
     * @return Users' profit.
     */
    function calculateProfitGameType1(uint _betNum, uint _betValue) private pure returns(int) {
        assert(_betNum > 0 && _betNum < DICE_RANGE);

        // safe as ranges are fixed
        uint totalWon = _betValue.mul(DICE_RANGE).div(_betNum);
        return calcProfitFromTotalWon(totalWon, _betValue);
    }

    /**
     * @dev Calculate user profit if user has won for game type 2 (dice lower wins).
     * @param _betNum Bet number of user.
     * @param _betValue Value of bet in gwei.
     * @return Users' profit.
     */
    function calculateProfitGameType2(uint _betNum, uint _betValue) private pure returns(int) {
        assert(_betNum >= 0 && _betNum < DICE_RANGE - 1);

        // safe as ranges are fixed
        uint totalWon = _betValue.mul(DICE_RANGE).div(DICE_RANGE.sub(_betNum).sub(1));
        return calcProfitFromTotalWon(totalWon, _betValue);
    }

    /**
     * @dev Check if user hash won or lost.
     * @return true if user has won.
     */
    function hasUserWon(
        uint8 _gameType,
        uint _betNum,
        bytes32 _serverSeed,
        bytes32 _userSeed
    )
        private
        pure
        returns(bool)
    {
        bytes32 combinedHash = keccak256(abi.encodePacked(_serverSeed, _userSeed));
        uint randNum = uint(combinedHash);

        if (_gameType == 1) {
            return calculateWinnerGameType1(randNum, _betNum);
        } else if (_gameType == 2) {
            return calculateWinnerGameType2(randNum, _betNum);
        } else {
            assert(false);
        }
    }

    /**
     * @dev Calculate winner of game type 1 (roll lower).
     * @param _randomNum 256 bit random number.
     * @param _betNum Bet number.
     * @return True if user has won false if he lost.
     */
    function calculateWinnerGameType1(uint _randomNum, uint _betNum) private pure returns(bool) {
        assert(_betNum > 0 && _betNum < DICE_RANGE);

        uint resultNum = _randomNum % DICE_RANGE; // bias is negligible
        return resultNum < _betNum;
    }

    /**
     * @dev Calculate winner of game type 2 (roll higher).
     * @param _randomNum 256 bit random number.
     * @param _betNum Bet number.
     * @return True if user has won false if he lost.
     */
    function calculateWinnerGameType2(uint _randomNum, uint _betNum) private pure returns(bool) {
        assert(_betNum >= 0 && _betNum < DICE_RANGE - 1);

        uint resultNum = _randomNum % DICE_RANGE; // bias is negligible
        return resultNum > _betNum;
    }
}
