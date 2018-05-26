pragma solidity ^0.4.24;

import "./GameChannelBase.sol";


/**
 * @title Game Channel Conflict
 * @dev Conflict handling implementation.
 * @author dicether
 */
contract GameChannelConflict is GameChannelBase {
    /**
     * @dev Contract constructor.
     * @param _serverAddress Server address.
     * @param _minStake Min value player needs to deposit to create game session.
     * @param _maxStake Max value player can deposit to create game session.
     * @param _conflictResAddress Conflict resolution contract address
     * @param _houseAddress House address to move profit to
     */
    constructor(
        address _serverAddress,
        uint128 _minStake,
        uint128 _maxStake,
        address _conflictResAddress,
        address _houseAddress,
        uint _gameIdCtr
    )
        public
        GameChannelBase(_serverAddress, _minStake, _maxStake, _conflictResAddress, _houseAddress, _gameIdCtr)
    {
        // nothing to do
    }

    /**
     * @dev Used by server if player does not end game session.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server seed for this bet.
     * @param _playerHash Hash of player seed for this bet.
     * @param _gameId Game session id.
     * @param _contractAddress Address of this contract.
     * @param _playerSig Player signature of this bet.
     * @param _playerAddress Address of player.
     * @param _serverSeed Server seed for this bet.
     * @param _playerSeed Player seed for this bet.
     */
    function serverEndGameConflict(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress,
        bytes _playerSig,
        address _playerAddress,
        bytes32 _serverSeed,
        bytes32 _playerSeed
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

        serverEndGameConflictImpl(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _playerHash,
                _serverSeed,
                _playerSeed,
                _gameId,
                _playerAddress
        );
    }

    /**
     * @notice Can be used by player if server does not answer to the end game session request.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server seed for this bet.
     * @param _playerHash Hash of player seed for this bet.
     * @param _gameId Game session id.
     * @param _contractAddress Address of this contract.
     * @param _serverSig Server signature of this bet.
     * @param _playerSeed Player seed for this bet.
     */
    function playerEndGameConflict(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress,
        bytes _serverSig,
        bytes32 _playerSeed
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

        playerEndGameConflictImpl(
            _roundId,
            _gameType,
            _num,
            _value,
            _balance,
            _playerHash,
            _playerSeed,
            _gameId,
            msg.sender
        );
    }

    /**
     * @notice Cancel active game without playing. Useful if server stops responding before
     * one game is played.
     * @param _gameId Game session id.
     */
    function playerCancelActiveGame(uint _gameId) public {
        address playerAddress = msg.sender;
        uint gameId = playerGameId[playerAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId);

        if (game.status == GameStatus.ACTIVE) {
            game.endInitiatedTime = block.timestamp;
            game.status = GameStatus.PLAYER_INITIATED_END;

            emit LogPlayerRequestedEnd(msg.sender, gameId);
        } else if (game.status == GameStatus.SERVER_INITIATED_END && game.roundId == 0) {
            closeGame(game, gameId, 0, playerAddress, ReasonEnded.REGULAR_ENDED, 0);
        } else {
            revert();
        }
    }

    /**
     * @dev Cancel active game without playing. Useful if player starts game session and
     * does not play.
     * @param _playerAddress Players' address.
     * @param _gameId Game session id.
     */
    function serverCancelActiveGame(address _playerAddress, uint _gameId) public onlyServer {
        uint gameId = playerGameId[_playerAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId);

        if (game.status == GameStatus.ACTIVE) {
            game.endInitiatedTime = block.timestamp;
            game.status = GameStatus.SERVER_INITIATED_END;

            emit LogServerRequestedEnd(msg.sender, gameId);
        } else if (game.status == GameStatus.PLAYER_INITIATED_END && game.roundId == 0) {
            closeGame(game, gameId, 0, _playerAddress, ReasonEnded.REGULAR_ENDED, 0);
        } else {
            revert();
        }
    }

    /**
    * @dev Force end of game if player does not respond. Only possible after a certain period of time
    * to give the player a chance to respond.
    * @param _playerAddress Player's address.
    */
    function serverForceGameEnd(address _playerAddress, uint _gameId) public onlyServer {
        uint gameId = playerGameId[_playerAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId);
        require(game.status == GameStatus.SERVER_INITIATED_END);

        // theoretically we have enough data to calculate winner
        // but as player did not respond assume he has lost.
        int newBalance = conflictRes.serverForceGameEnd(
            game.gameType,
            game.betNum,
            game.betValue,
            game.balance,
            game.stake,
            game.endInitiatedTime
        );

        closeGame(game, gameId, game.roundId, _playerAddress, ReasonEnded.END_FORCED_BY_SERVER, newBalance);
    }

    /**
    * @notice Force end of game if server does not respond. Only possible after a certain period of time
    * to give the server a chance to respond.
    */
    function playerForceGameEnd(uint _gameId) public {
        address playerAddress = msg.sender;
        uint gameId = playerGameId[playerAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId);
        require(game.status == GameStatus.PLAYER_INITIATED_END);

        int newBalance = conflictRes.playerForceGameEnd(
            game.gameType,
            game.betNum,
            game.betValue,
            game.balance,
            game.stake,
            game.endInitiatedTime
        );

        closeGame(game, gameId, game.roundId, playerAddress, ReasonEnded.END_FORCED_BY_PLAYER, newBalance);
    }

    /**
     * @dev Conflict handling implementation. Stores game data and timestamp if game
     * is active. If server has already marked conflict for game session the conflict
     * resolution contract is used (compare conflictRes).
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _playerHash Hash of player's seed for this bet.
     * @param _playerSeed Player's seed for this bet.
     * @param _gameId game Game session id.
     * @param _playerAddress Player's address.
     */
    function playerEndGameConflictImpl(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _playerHash,
        bytes32 _playerSeed,
        uint _gameId,
        address _playerAddress
    )
        private
    {
        uint gameId = playerGameId[_playerAddress];
        Game storage game = gameIdGame[gameId];
        int maxBalance = conflictRes.maxBalance();

        require(gameId == _gameId);
        require(_roundId > 0);
        require(keccak256(abi.encodePacked(_playerSeed)) == _playerHash);
        require(_value <= game.stake);
        require(-int(game.stake) <= _balance && _balance <= maxBalance); // save to cast as ranges are fixed
        require(int(game.stake) + _balance - int(_value) >= 0); // save to cast as ranges are fixed
        require(conflictRes.isValidBet(_gameType, _num, _value));

        if (game.status == GameStatus.SERVER_INITIATED_END && game.roundId == _roundId) {
            game.playerSeed = _playerSeed;
            endGameConflict(game, gameId, _playerAddress);
        } else if (game.status == GameStatus.ACTIVE
                || (game.status == GameStatus.SERVER_INITIATED_END && game.roundId < _roundId)) {
            game.status = GameStatus.PLAYER_INITIATED_END;
            game.endInitiatedTime = block.timestamp;
            game.roundId = _roundId;
            game.gameType = _gameType;
            game.betNum = _num;
            game.betValue = _value;
            game.balance = _balance;
            game.playerSeed = _playerSeed;
            game.serverSeed = bytes32(0);

            emit LogPlayerRequestedEnd(msg.sender, gameId);
        } else {
            revert();
        }
    }

    /**
     * @dev Conflict handling implementation. Stores game data and timestamp if game
     * is active. If player has already marked conflict for game session the conflict
     * resolution contract is used (compare conflictRes).
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server's seed for this bet.
     * @param _playerHash Hash of player's seed for this bet.
     * @param _serverSeed Server's seed for this bet.
     * @param _playerSeed Player's seed for this bet.
     * @param _playerAddress Player's address.
     */
    function serverEndGameConflictImpl(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        bytes32 _serverSeed,
        bytes32 _playerSeed,
        uint _gameId,
        address _playerAddress
    )
        private
    {
        uint gameId = playerGameId[_playerAddress];
        Game storage game = gameIdGame[gameId];
        int maxBalance = conflictRes.maxBalance();

        require(gameId == _gameId);
        require(_roundId > 0);
        require(keccak256(abi.encodePacked(_serverSeed)) == _serverHash);
        require(keccak256(abi.encodePacked(_playerSeed)) == _playerHash);
        require(_value <= game.stake);
        require(-int(game.stake) <= _balance && _balance <= maxBalance); // save to cast as ranges are fixed
        require(int(game.stake) + _balance - int(_value) >= 0); // save to cast as ranges are fixed
        require(conflictRes.isValidBet(_gameType, _num, _value));


        if (game.status == GameStatus.PLAYER_INITIATED_END && game.roundId == _roundId) {
            game.serverSeed = _serverSeed;
            endGameConflict(game, gameId, _playerAddress);
        } else if (game.status == GameStatus.ACTIVE
                || (game.status == GameStatus.PLAYER_INITIATED_END && game.roundId < _roundId)) {
            game.status = GameStatus.SERVER_INITIATED_END;
            game.endInitiatedTime = block.timestamp;
            game.roundId = _roundId;
            game.gameType = _gameType;
            game.betNum = _num;
            game.betValue = _value;
            game.balance = _balance;
            game.serverSeed = _serverSeed;
            game.playerSeed = _playerSeed;

            emit LogServerRequestedEnd(_playerAddress, gameId);
        } else {
            revert();
        }
    }

    /**
     * @dev End conflicting game.
     * @param _game Game session data.
     * @param _gameId Game session id.
     * @param _playerAddress Player's address.
     */
    function endGameConflict(Game storage _game, uint _gameId, address _playerAddress) private {
        int newBalance = conflictRes.endGameConflict(
            _game.gameType,
            _game.betNum,
            _game.betValue,
            _game.balance,
            _game.stake,
            _game.serverSeed,
            _game.playerSeed
        );

        closeGame(_game, _gameId, _game.roundId, _playerAddress, ReasonEnded.REGULAR_ENDED, newBalance);
    }
}
