pragma solidity ^0.4.24;

import "./GameChannelConflict.sol";


/**
 * @title Game Channel
 * @author dicether
 */
contract GameChannel is GameChannelConflict {
    /**
     * @dev contract constructor
     * @param _serverAddress Server address.
     * @param _minStake Min value player needs to deposit to create game session.
     * @param _maxStake Max value player can deposit to create game session.
     * @param _conflictResAddress Conflict resolution contract address.
     * @param _houseAddress House address to move profit to.
     */
    constructor(
        address _serverAddress,
        uint128 _minStake,
        uint128 _maxStake,
        address _conflictResAddress,
        address _houseAddress,
        uint _gameIdCntr
    )
        public
        GameChannelConflict(_serverAddress, _minStake, _maxStake, _conflictResAddress, _houseAddress, _gameIdCntr)
    {
        // nothing to do
    }

    /**
     * @notice Create games session request. msg.value needs to be valid stake value.
     * @param _playerEndHash last entry of players' hash chain.
     * @param _previousGameId player's previous game id, initial 0.
     * @param _createBefore game can be only created before this timestamp.
     * @param _serverEndHash last entry of server's hash chain.
     * @param _serverSig server signature. See verifyCreateSig
     */
    function createGame(
        bytes32 _playerEndHash,
        uint _previousGameId,
        uint _createBefore,
        bytes32 _serverEndHash,
        bytes _serverSig
    )
        public
        payable
        onlyValidValue
        onlyValidHouseStake(activeGames + 1)
        onlyNotPaused
    {
        uint previousGameId = playerGameId[msg.sender];
        Game storage game = gameIdGame[previousGameId];

        require(game.status == GameStatus.ENDED);
        require(previousGameId == _previousGameId);
        require(block.timestamp < _createBefore);

        verifyCreateSig(msg.sender, _previousGameId, _createBefore, _serverEndHash, _serverSig);

        uint gameId = gameIdCntr++;
        playerGameId[msg.sender] = gameId;
        Game storage newGame = gameIdGame[gameId];

        newGame.stake = uint128(msg.value); // It's safe to cast msg.value as it is limited, see onlyValidValue
        newGame.status = GameStatus.ACTIVE;

        activeGames = activeGames + 1;

        // It's safe to cast msg.value as it is limited, see onlyValidValue
        emit LogGameCreated(msg.sender, gameId, uint128(msg.value), _serverEndHash,  _playerEndHash);
    }


    /**
     * @dev Regular end game session. Used if player and house have both
     * accepted current game session state.
     * The game session with gameId _gameId is closed
     * and the player paid out. This functions is called by the server after
     * the player requested the termination of the current game session.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Current balance.
     * @param _serverHash Hash of server's seed for this bet.
     * @param _playerHash Hash of player's seed for this bet.
     * @param _gameId Game session id.
     * @param _contractAddress Address of this contract.
     * @param _playerAddress Address of player.
     * @param _playerSig Player's signature of this bet.
     */
    function serverEndGame(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress,
        address _playerAddress,
        bytes _playerSig
    )
        public
        onlyServer
    {
        verifySig(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _playerHash,
                _gameId,
                _contractAddress,
                _playerSig,
                _playerAddress
        );

        regularEndGame(_playerAddress, _roundId, _gameType, _num, _value, _balance, _gameId, _contractAddress);
    }

    /**
     * @notice Regular end game session. Normally not needed as server ends game (@see serverEndGame).
     * Can be used by player if server does not end game session.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Current balance.
     * @param _serverHash Hash of server's seed for this bet.
     * @param _playerHash Hash of player's seed for this bet.
     * @param _gameId Game session id.
     * @param _contractAddress Address of this contract.
     * @param _serverSig Server's signature of this bet.
     */
    function playerEndGame(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress,
        bytes _serverSig
    )
        public
    {
        verifySig(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _playerHash,
                _gameId,
                _contractAddress,
                _serverSig,
                serverAddress
        );

        regularEndGame(msg.sender, _roundId, _gameType, _num, _value, _balance, _gameId, _contractAddress);
    }

    /**
     * @dev Verify server signature.
     * @param _playerAddress player's address.
     * @param _previousGameId player's previous game id, initial 0.
     * @param _createBefore game can be only created before this timestamp.
     * @param _serverEndHash last entry of server's hash chain.
     * @param _serverSig server signature.
     */
    function verifyCreateSig(
        address _playerAddress,
        uint _previousGameId,
        uint _createBefore,
        bytes32 _serverEndHash,
        bytes _serverSig
    )
        private view
    {
        address contractAddress = this;
        bytes32 hash = keccak256(abi.encodePacked(
            contractAddress, _playerAddress, _previousGameId, _createBefore, _serverEndHash
        ));

        verify(hash, _serverSig, serverAddress);
    }

    /**
     * @dev Regular end game session implementation. Used if player and house have both
     * accepted current game session state. The game session with gameId _gameId is closed
     * and the player paid out.
     * @param _playerAddress Address of player.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Current balance.
     * @param _gameId Game session id.
     * @param _contractAddress Address of this contract.
     */
    function regularEndGame(
        address _playerAddress,
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        uint _gameId,
        address _contractAddress
    )
        private
    {
        uint gameId = playerGameId[_playerAddress];
        Game storage game = gameIdGame[gameId];
        address contractAddress = this;
        int maxBalance = conflictRes.maxBalance();

        require(_gameId == gameId);
        require(_roundId > 0);
        // save to cast as game.stake hash fixed range
        require(-int(game.stake) <= _balance && _balance <= maxBalance);
        require((_gameType == 0) && (_num == 0) && (_value == 0));
        require(game.status == GameStatus.ACTIVE);

        assert(_contractAddress == contractAddress);

        closeGame(game, gameId, _roundId, _playerAddress, ReasonEnded.REGULAR_ENDED, _balance);
    }
}
