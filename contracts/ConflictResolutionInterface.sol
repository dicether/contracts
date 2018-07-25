pragma solidity ^0.4.24;


/**
 * @title Conflict Resolution Interface
 * @dev interface to contract used for conflict resolution. Only needed if server or
 * user stops responding during game session. For documentation consult implementation
 * contract.
 * @author dicether
 */
interface ConflictResolutionInterface {
    function minHouseStake(uint activeGames) external pure returns(uint);

    function maxBalance() external pure returns(int);

    function conflictEndFine() external pure returns(int);

    function isValidBet(uint8 _gameType, uint _betNum, uint _betValue) external pure returns(bool);

    function endGameConflict(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        bytes32 _serverSeed,
        bytes32 _userSeed
    )
        external
        view
        returns(int);

    function serverForceGameEnd(
        uint8 gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        uint _endInitiatedTime
    )
        external
        view
        returns(int);

    function userForceGameEnd(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        uint _endInitiatedTime
    )
        external
        view
        returns(int);
}
