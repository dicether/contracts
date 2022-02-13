// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./GameChannelBase.sol";


/**
 * @title Game Channel Conflict
 * @dev Conflict handling implementation.
 * @author dicether
 */
contract GameChannelConflict is GameChannelBase {
    using SafeCast for int;
    using SafeCast for uint;
    using SafeMath for int;
    using SafeMath for uint;

    /**
     * @dev Contract constructor.
     * @param _serverAddress Server address.
     * @param _minStake Min value user needs to deposit to create game session.
     * @param _maxStake Max value user can deposit to create game session.
     * @param _conflictResAddress Conflict resolution contract address
     * @param _houseAddress House address to move profit to
     */
    constructor(
        address _serverAddress,
        uint128 _minStake,
        uint128 _maxStake,
        address _conflictResAddress,
        address payable _houseAddress
    )
        GameChannelBase(_serverAddress, _minStake, _maxStake, _conflictResAddress, _houseAddress)
    {
        // nothing to do
    }

    /**
     * @dev Used by server if user does not end game session.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server seed for this bet.
     * @param _userHash Hash of user seed for this bet.
     * @param _gameId Game session id.
     * @param _userSig User signature of this bet.
     * @param _userAddress Address of user.
     * @param _serverSeed Server seed for this bet.
     * @param _userSeed User seed for this bet.
     */
    function serverEndGameConflict(
        uint32 _roundId,
        uint8 _gameType,
        uint _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _userHash,
        uint _gameId,
        bytes memory _userSig,
        address payable _userAddress,
        bytes32 _serverSeed,
        bytes32 _userSeed
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
                _userHash,
                _gameId,
                address(this),
                _userSig,
                _userAddress
        );

        serverEndGameConflictImpl(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _userHash,
                _serverSeed,
                _userSeed,
                _gameId,
                _userAddress
        );
    }

    /**
     * @notice Can be used by user if server does not answer to the end game session request.
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server seed for this bet.
     * @param _userHash Hash of user seed for this bet.
     * @param _gameId Game session id.
     * @param _serverSig Server signature of this bet.
     * @param _userSeed User seed for this bet.
     */
    function userEndGameConflict(
        uint32 _roundId,
        uint8 _gameType,
        uint _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _userHash,
        uint _gameId,
        bytes memory _serverSig,
        bytes32 _userSeed
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
            _userHash,
            _gameId,
            address(this),
            _serverSig,
            serverAddress
        );

        userEndGameConflictImpl(
            _roundId,
            _gameType,
            _num,
            _value,
            _balance,
            _userHash,
            _userSeed,
            _gameId,
            payable(msg.sender)
        );
    }

    /**
     * @notice Cancel active game without playing. Useful if server stops responding before
     * one game is played.
     * @param _gameId Game session id.
     */
    function userCancelActiveGame(uint _gameId) public {
        address payable userAddress = payable(msg.sender);
        uint gameId = userGameId[userAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId, "inv gameId");

        if (game.status == GameStatus.ACTIVE) {
            game.endInitiatedTime = block.timestamp;
            game.status = GameStatus.USER_INITIATED_END;

            emit LogUserRequestedEnd(msg.sender, gameId);
        } else if (game.status == GameStatus.SERVER_INITIATED_END && game.roundId == 0) {
            cancelActiveGame(game, gameId, userAddress);
        } else {
            revert();
        }
    }

    /**
     * @dev Cancel active game without playing. Useful if user starts game session and
     * does not play.
     * @param _userAddress Users' address.
     * @param _gameId Game session id.
     */
    function serverCancelActiveGame(address payable _userAddress, uint _gameId) public onlyServer {
        uint gameId = userGameId[_userAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId, "inv gameId");

        if (game.status == GameStatus.ACTIVE) {
            game.endInitiatedTime = block.timestamp;
            game.status = GameStatus.SERVER_INITIATED_END;

            emit LogServerRequestedEnd(msg.sender, gameId);
        } else if (game.status == GameStatus.USER_INITIATED_END && game.roundId == 0) {
            cancelActiveGame(game, gameId, _userAddress);
        } else {
            revert();
        }
    }

    /**
    * @dev Force end of game if user does not respond. Only possible after a certain period of time
    * to give the user a chance to respond.
    * @param _userAddress User's address.
    */
    function serverForceGameEnd(address payable _userAddress, uint _gameId) public onlyServer {
        uint gameId = userGameId[_userAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId, "inv gameId");
        require(game.status == GameStatus.SERVER_INITIATED_END, "inv status");

        // theoretically we have enough data to calculate winner
        // but as user did not respond assume he has lost.
        int newBalance = conflictRes.serverForceGameEnd(
            game.gameType,
            game.betNum,
            game.betValue,
            game.balance,
            game.stake,
            game.serverSeed,
            game.userSeed,
            game.endInitiatedTime
        );

        closeGame(game, gameId, game.roundId, _userAddress, ReasonEnded.SERVER_FORCED_END, newBalance);
    }

    /**
    * @notice Force end of game if server does not respond. Only possible after a certain period of time
    * to give the server a chance to respond.
    */
    function userForceGameEnd(uint _gameId) public {
        address payable userAddress = payable(msg.sender);
        uint gameId = userGameId[userAddress];
        Game storage game = gameIdGame[gameId];

        require(gameId == _gameId, "inv gameId");
        require(game.status == GameStatus.USER_INITIATED_END, "inv status");

        int newBalance = conflictRes.userForceGameEnd(
            game.gameType,
            game.betNum,
            game.betValue,
            game.balance,
            game.stake,
            game.endInitiatedTime
        );

        closeGame(game, gameId, game.roundId, userAddress, ReasonEnded.USER_FORCED_END, newBalance);
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
     * @param _userHash Hash of user's seed for this bet.
     * @param _userSeed User's seed for this bet.
     * @param _gameId game Game session id.
     * @param _userAddress User's address.
     */
    function userEndGameConflictImpl(
        uint32 _roundId,
        uint8 _gameType,
        uint _num,
        uint _value,
        int _balance,
        bytes32 _userHash,
        bytes32 _userSeed,
        uint _gameId,
        address payable _userAddress
    )
        private
    {
        uint gameId = userGameId[_userAddress];
        Game storage game = gameIdGame[gameId];
        int maxBalance = conflictRes.maxBalance();
        int gameStake = int(uint(game.stake));

        require(gameId == _gameId, "inv gameId");
        require(_roundId > 0, "inv roundId");
        require(keccak256(abi.encodePacked(_userSeed)) == _userHash, "inv userSeed");
        require(-gameStake <= _balance && _balance <= maxBalance, "inv balance"); // game.stake save to cast as uint128
        require(conflictRes.isValidBet(_gameType, _num, _value), "inv bet");
        require(gameStake.add(_balance).sub(_value.castToInt()) >= 0, "value too high"); // game.stake save to cast as uint128

        if (game.status == GameStatus.SERVER_INITIATED_END && game.roundId == _roundId) {
            game.userSeed = _userSeed;
            endGameConflict(game, gameId, _userAddress);
        } else if (game.status == GameStatus.ACTIVE
                || (game.status == GameStatus.SERVER_INITIATED_END && game.roundId < _roundId)) {
            game.status = GameStatus.USER_INITIATED_END;
            game.endInitiatedTime = block.timestamp;
            game.roundId = _roundId;
            game.gameType = _gameType;
            game.betNum = _num;
            game.betValue = _value;
            game.balance = _balance;
            game.userSeed = _userSeed;
            game.serverSeed = bytes32(0);

            emit LogUserRequestedEnd(msg.sender, gameId);
        } else {
            revert("inv state");
        }
    }

    /**
     * @dev Conflict handling implementation. Stores game data and timestamp if game
     * is active. If user has already marked conflict for game session the conflict
     * resolution contract is used (compare conflictRes).
     * @param _roundId Round id of bet.
     * @param _gameType Game type of bet.
     * @param _num Number of bet.
     * @param _value Value of bet.
     * @param _balance Balance before this bet.
     * @param _serverHash Hash of server's seed for this bet.
     * @param _userHash Hash of user's seed for this bet.
     * @param _serverSeed Server's seed for this bet.
     * @param _userSeed User's seed for this bet.
     * @param _userAddress User's address.
     */
    function serverEndGameConflictImpl(
        uint32 _roundId,
        uint8 _gameType,
        uint _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _userHash,
        bytes32 _serverSeed,
        bytes32 _userSeed,
        uint _gameId,
        address payable _userAddress
    )
        private
    {
        uint gameId = userGameId[_userAddress];
        Game storage game = gameIdGame[gameId];
        int maxBalance = conflictRes.maxBalance();
        int gameStake = int(uint(game.stake));

        require(gameId == _gameId, "inv gameId");
        require(_roundId > 0, "inv roundId");
        require(keccak256(abi.encodePacked(_serverSeed)) == _serverHash, "inv serverSeed");
        require(keccak256(abi.encodePacked(_userSeed)) == _userHash, "inv userSeed");
        require(-gameStake <= _balance && _balance <= maxBalance, "inv balance"); // game.stake save to cast as uint128
        require(conflictRes.isValidBet(_gameType, _num, _value), "inv bet");
        require(gameStake.add(_balance).sub(_value.castToInt()) >= 0, "too high value"); // game.stake save to cast as uin128

        if (game.status == GameStatus.USER_INITIATED_END && game.roundId == _roundId) {
            game.serverSeed = _serverSeed;
            endGameConflict(game, gameId, _userAddress);
        } else if (game.status == GameStatus.ACTIVE
                || (game.status == GameStatus.USER_INITIATED_END && game.roundId < _roundId)) {
            game.status = GameStatus.SERVER_INITIATED_END;
            game.endInitiatedTime = block.timestamp;
            game.roundId = _roundId;
            game.gameType = _gameType;
            game.betNum = _num;
            game.betValue = _value;
            game.balance = _balance;
            game.serverSeed = _serverSeed;
            game.userSeed = _userSeed;

            emit LogServerRequestedEnd(_userAddress, gameId);
        } else {
            revert("inv state");
        }
    }

    /**
     * @dev End conflicting game without placed bets.
     * @param _game Game session data.
     * @param _gameId Game session id.
     * @param _userAddress User's address.
     */
    function cancelActiveGame(Game storage _game, uint _gameId, address payable _userAddress) private {
        // user need to pay a fee when conflict ended.
        // this ensures a malicious, rich user can not just generate game sessions and then wait
        // for us to end the game session and then confirm the session status, so
        // we would have to pay a high gas fee without profit.
        int newBalance = -conflictRes.conflictEndFine();

        // do not allow balance below user stake
        int stake = int(uint(_game.stake));
        if (newBalance < -stake) {
            newBalance = -stake;
        }
        closeGame(_game, _gameId, 0, _userAddress, ReasonEnded.CONFLICT_ENDED, newBalance);
    }

    /**
     * @dev End conflicting game.
     * @param _game Game session data.
     * @param _gameId Game session id.
     * @param _userAddress User's address.
     */
    function endGameConflict(Game storage _game, uint _gameId, address payable _userAddress) private {
        int newBalance = conflictRes.endGameConflict(
            _game.gameType,
            _game.betNum,
            _game.betValue,
            _game.balance,
            _game.stake,
            _game.serverSeed,
            _game.userSeed
        );

        closeGame(_game, _gameId, _game.roundId, _userAddress, ReasonEnded.CONFLICT_ENDED, newBalance);
    }
}
