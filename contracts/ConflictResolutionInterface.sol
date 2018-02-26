pragma solidity ^0.4.18;


/**
 * @title Conflict Resolution Interface
 * @dev interface to contract used for conflict resolution. Only needed if server or
 * player stops responding during game session. For documentation consult implementation
 * contract.
 * @author dicether
 */
interface ConflictResolutionInterface {
    function minHouseStake(uint activeGames) public pure returns(uint);

    function maxBalance() public pure returns(int);

    function isValidBet(uint8 _gameType, uint _betNum, uint _betValue) public pure returns(bool);

    function endGameConflict(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        bytes32 _serverSeed,
        bytes32 _playerSeed
    )
        public
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
        public
        view
        returns(int);

    function playerForceGameEnd(
        uint8 _gameType,
        uint _betNum,
        uint _betValue,
        int _balance,
        uint _stake,
        uint _endInitiatedTime
    )
        public
        view
        returns(int);
}
