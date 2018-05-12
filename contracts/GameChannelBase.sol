pragma solidity ^0.4.23;

import "./ConflictResolutionInterface.sol";
import "./ConflictResolutionManager.sol";
import "./Destroyable.sol";
import "./MathUtil.sol";


/**
 * @title Game Channel Base
 * @dev Base contract for state channel implementation.
 * @author dicether
 */
contract GameChannelBase is Destroyable, ConflictResolutionManager {
    /// @dev Different game session states.
    enum GameStatus {
        ENDED, ///< @dev Game session is ended.
        ACTIVE, ///< @dev Game session is active.
        PLAYER_INITIATED_END, ///< @dev Player initiated non regular end.
        SERVER_INITIATED_END ///< @dev Server initiated non regular end.
    }

    /// @dev Reason game session ended.
    enum ReasonEnded {
        REGULAR_ENDED, ///< @dev Game session is regularly ended.
        END_FORCED_BY_SERVER, ///< @dev Player did not respond. Server forced end.
        END_FORCED_BY_PLAYER ///< @dev Server did not respond. Player forced end.
    }

    struct Game {
        /// @dev Game session status.
        GameStatus status;

        /// @dev Player's stake.
        uint stake;

        /// @dev Last game round info if not regularly ended.
        /// If game session is ended normally this data is not used.
        uint8 gameType;
        uint32 roundId;
        uint16 betNum;
        uint betValue;
        int balance;
        bytes32 playerSeed;
        bytes32 serverSeed;
        uint endInitiatedTime;
    }

    /// @dev Minimal time span between profit transfer.
    uint public constant MIN_TRANSFER_TIMESPAN = 1 days;

    /// @dev Maximal time span between profit transfer.
    uint public constant MAX_TRANSFER_TIMSPAN = 6 * 30 days;

    /// @dev Current active game sessions.
    uint public activeGames = 0;

    /// @dev Game session id counter. Points to next free game session slot. So gameIdCntr -1 is the
    // number of game sessions created.
    uint public gameIdCntr;

    /// @dev Only this address can accept and end games.
    address public serverAddress;

    /// @dev Address to transfer profit to.
    address public houseAddress;

    /// @dev Current house stake.
    uint public houseStake = 0;

    /// @dev House profit since last profit transfer.
    int public houseProfit = 0;

    /// @dev Min value player needs to deposit for creating game session.
    uint public minStake;

    /// @dev Max value player can deposit for creating game session.
    uint public maxStake;

    /// @dev Timeout until next profit transfer is allowed.
    uint public profitTransferTimeSpan = 14 days;

    /// @dev Last time profit transferred to house.
    uint public lastProfitTransferTimestamp;

    bytes32 public typeHash;

    /// @dev Maps gameId to game struct.
    mapping (uint => Game) public gameIdGame;

    /// @dev Maps player address to current player game id.
    mapping (address => uint) public playerGameId;

    /// @dev Maps player address to pending returns.
    mapping (address => uint) public pendingReturns;

    /// @dev Modifier, which only allows to execute if house stake is high enough.
    modifier onlyValidHouseStake(uint _activeGames) {
        uint minHouseStake = conflictRes.minHouseStake(_activeGames);
        require(houseStake >= minHouseStake);
        _;
    }

    /// @dev Modifier to check if value send fulfills player stake requirements.
    modifier onlyValidValue() {
        require(minStake <= msg.value && msg.value <= maxStake);
        _;
    }

    /// @dev Modifier, which only allows server to call function.
    modifier onlyServer() {
        require(msg.sender == serverAddress);
        _;
    }

    /// @dev Modifier, which only allows to set valid transfer timeouts.
    modifier onlyValidTransferTimeSpan(uint transferTimeout) {
        require(transferTimeout >= MIN_TRANSFER_TIMESPAN
                && transferTimeout <= MAX_TRANSFER_TIMSPAN);
        _;
    }

    /// @dev This event is fired when player creates game session.
    event LogGameCreated(address indexed player, uint indexed gameId, uint stake, bytes32 serverEndHash, bytes32 playerEndHash);

    /// @dev This event is fired when player requests conflict end.
    event LogPlayerRequestedEnd(address indexed player, uint indexed gameId);

    /// @dev This event is fired when server requests conflict end.
    event LogServerRequestedEnd(address indexed player, uint indexed gameId);

    /// @dev This event is fired when game session is ended.
    event LogGameEnded(address indexed player, uint indexed gameId, uint32 roundId, int balance, ReasonEnded reason);

    /// @dev this event is fired when owner modifies player's stake limits.
    event LogStakeLimitsModified(uint minStake, uint maxStake);

    /**
     * @dev Contract constructor.
     * @param _serverAddress Server address.
     * @param _minStake Min value player needs to deposit to create game session.
     * @param _maxStake Max value player can deposit to create game session.
     * @param _conflictResAddress Conflict resolution contract address.
     * @param _houseAddress House address to move profit to.
     */
    constructor(
        address _serverAddress,
        uint _minStake,
        uint _maxStake,
        address _conflictResAddress,
        address _houseAddress,
        uint _gameIdCntr
    )
        public
        ConflictResolutionManager(_conflictResAddress)
    {
        require(_minStake > 0 && _minStake <= _maxStake);
        require(_gameIdCntr > 0);

        gameIdCntr = _gameIdCntr;
        serverAddress = _serverAddress;
        houseAddress = _houseAddress;
        lastProfitTransferTimestamp = block.timestamp;
        minStake = _minStake;
        maxStake = _maxStake;

        typeHash = keccak256(
            "uint32 Round Id",
            "uint8 Game Type",
            "uint16 Number",
            "uint Value (Wei)",
            "int Current Balance (Wei)",
            "bytes32 Server Hash",
            "bytes32 Player Hash",
            "uint Game Id",
            "address Contract Address"
        );
    }

    /**
     * @notice Withdraw pending returns.
     */
    function withdraw() public {
        uint toTransfer = pendingReturns[msg.sender];
        require(toTransfer > 0);

        pendingReturns[msg.sender] = 0;
        msg.sender.transfer(toTransfer);
    }

    /**
     * @notice Transfer house profit to houseAddress.
     */
    function transferProfitToHouse() public {
        require(lastProfitTransferTimestamp + profitTransferTimeSpan <= block.timestamp);

        if (houseProfit <= 0) {
            // update last transfer timestamp
            lastProfitTransferTimestamp = block.timestamp;
            return;
        }

        // houseProfit is gt 0 => safe to cast
        uint toTransfer = uint(houseProfit);
        assert(houseStake >= toTransfer);

        houseProfit = 0;
        lastProfitTransferTimestamp = block.timestamp;
        houseStake = houseStake - toTransfer;

        houseAddress.transfer(toTransfer);
    }

    /**
     * @dev Set profit transfer time span.
     */
    function setProfitTransferTimeSpan(uint _profitTransferTimeSpan)
        public
        onlyOwner
        onlyValidTransferTimeSpan(_profitTransferTimeSpan)
    {
        profitTransferTimeSpan = _profitTransferTimeSpan;
    }

    /**
     * @dev Increase house stake by msg.value
     */
    function addHouseStake() public payable onlyOwner {
        houseStake += msg.value;
    }

    /**
     * @dev Withdraw house stake.
     */
    function withdrawHouseStake(uint value) public onlyOwner {
        uint minHouseStake = conflictRes.minHouseStake(activeGames);

        require(value <= houseStake && houseStake - value >= minHouseStake);
        require(houseProfit <= 0 || uint(houseProfit) <= houseStake - value);

        houseStake = houseStake - value;
        owner.transfer(value);
    }

    /**
     * @dev Withdraw house stake and profit.
     */
    function withdrawAll() public onlyOwner onlyPausedSince(3 days) {
        houseProfit = 0;
        uint toTransfer = houseStake;
        houseStake = 0;
        owner.transfer(toTransfer);
    }

    /**
     * @dev Set new house address.
     * @param _houseAddress New house address.
     */
    function setHouseAddress(address _houseAddress) public onlyOwner {
        houseAddress = _houseAddress;
    }

    /**
     * @dev Set stake min and max value.
     * @param _minStake Min stake.
     * @param _maxStake Max stake.
     */
    function setStakeRequirements(uint _minStake, uint _maxStake) public onlyOwner {
        require(_minStake > 0 && _minStake <= _maxStake);
        minStake = _minStake;
        maxStake = _maxStake;
        emit LogStakeLimitsModified(minStake, maxStake);
    }

    /**
     * @dev Close game session.
     * @param _game Game session data.
     * @param _gameId Id of game session.
     * @param _playerAddress Player's address of game session.
     * @param _reason Reason for closing game session.
     * @param _balance Game session balance.
     */
    function closeGame(
        Game storage _game,
        uint _gameId,
        uint32 _roundId,
        address _playerAddress,
        ReasonEnded _reason,
        int _balance
    )
        internal
    {
        _game.status = GameStatus.ENDED;

        assert(activeGames > 0);
        activeGames = activeGames - 1;

        payOut(_playerAddress, _game.stake, _balance);

        emit LogGameEnded(_playerAddress, _gameId, _roundId, _balance, _reason);
    }

    /**
     * @dev End game by paying out player and server.
     * @param _playerAddress Player's address.
     * @param _stake Player's stake.
     * @param _balance Player's balance.
     */
    function payOut(address _playerAddress, uint _stake, int _balance) internal {
        assert(_balance <= conflictRes.maxBalance());
        assert(_stake <= maxStake);
        assert((int(_stake) + _balance) >= 0);

        uint valuePlayer = uint(int(_stake) + _balance);

        if (_balance > 0 && int(houseStake) < _balance) {
            // Should never happen!
            // House is bankrupt.
            // Payout left money.
            valuePlayer = houseStake;
        }

        houseProfit = houseProfit - _balance;

        int newHouseStake = int(houseStake) - _balance;
        assert(newHouseStake >= 0);
        houseStake = uint(newHouseStake);

        pendingReturns[_playerAddress] += valuePlayer;
        if (pendingReturns[_playerAddress] > 0) {
            safeSend(_playerAddress);
        }
    }

    /**
     * @dev Send value of pendingReturns[_address] to _address.
     * @param _address Address to send value to.
     */
    function safeSend(address _address) internal {
        uint valueToSend = pendingReturns[_address];
        assert(valueToSend > 0);

        pendingReturns[_address] = 0;
        if (_address.send(valueToSend) == false) {
            pendingReturns[_address] = valueToSend;
        }
    }

    /**
     * @dev Verify signature of given data. Throws on verification failure.
     * @param _sig Signature of given data in the form of rsv.
     * @param _address Address of signature signer.
     */
    function verifySig(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress,
        bytes _sig,
        address _address
    )
        internal
        view
    {
        // check if this is the correct contract
        address contractAddress = this;
        require(_contractAddress == contractAddress);

        bytes32 roundHash = calcHash(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _playerHash,
                _gameId,
                _contractAddress
        );

        verify(
                roundHash,
                _sig,
                _address
        );
    }

    /**
     * @dev Calculate typed hash of given data (compare eth_signTypedData).
     * @return Hash of given data.
     */
    function calcHash(
        uint32 _roundId,
        uint8 _gameType,
        uint16 _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _playerHash,
        uint _gameId,
        address _contractAddress
    )
        private
        view
        returns(bytes32)
    {
        bytes32 dataHash = keccak256(
            _roundId,
            _gameType,
            _num,
            _value,
            _balance,
            _serverHash,
            _playerHash,
            _gameId,
            _contractAddress
        );

        return keccak256(typeHash, dataHash);
    }

     /**
     * @dev Check if _sig is valid signature of _hash. Throws if invalid signature.
     * @param _hash Hash to check signature of.
     * @param _sig Signature of _hash.
     * @param _address Address of signer.
     */
    function verify(
        bytes32 _hash,
        bytes _sig,
        address _address
    )
        internal
        pure
    {
        bytes32 r;
        bytes32 s;
        uint8 v;

        (r, s, v) = signatureSplit(_sig);
        address addressRecover = ecrecover(_hash, v, r, s);
        require(addressRecover == _address);
    }

    /**
     * @dev Split the given signature of the form rsv in r s v. v is incremented with 27 if
     * it is below 2.
     * @param _signature Signature to split.
     * @return r s v
     */
    function signatureSplit(bytes _signature)
        private
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(_signature.length == 65);

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := and(mload(add(_signature, 65)), 0xff)
        }
        if (v < 2) {
            v = v + 27;
        }
    }
}
