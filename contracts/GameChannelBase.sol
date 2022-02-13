// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./ConflictResolutionInterface.sol";
import "./ConflictResolutionManager.sol";
import "./Destroyable.sol";
import "./MathUtil.sol";
import "./SafeCast.sol";
import "./SafeMath.sol";


/**
 * @title Game Channel Base
 * @dev Base contract for state channel implementation.
 * @author dicether
 */
contract GameChannelBase is Destroyable, ConflictResolutionManager {
    using SafeCast for int;
    using SafeCast for uint;
    using SafeMath for int;
    using SafeMath for uint;


    /// @dev Different game session states.
    enum GameStatus {
        ENDED, ///< @dev Game session is ended.
        ACTIVE, ///< @dev Game session is active.
        USER_INITIATED_END, ///< @dev User initiated non regular end.
        SERVER_INITIATED_END ///< @dev Server initiated non regular end.
    }

    /// @dev Reason game session ended.
    enum ReasonEnded {
        REGULAR_ENDED, ///< @dev Game session is regularly ended.
        SERVER_FORCED_END, ///< @dev User did not respond. Server forced end.
        USER_FORCED_END, ///< @dev Server did not respond. User forced end.
        CONFLICT_ENDED ///< @dev Server or user raised conflict ans pushed game state, opponent pushed same game state.
    }

    struct Game {
        /// @dev Game session status.
        GameStatus status;

        /// @dev User's stake.
        uint128 stake;

        /// @dev Last game round info if not regularly ended.
        /// If game session is ended normally this data is not used.
        uint8 gameType;
        uint32 roundId;
        uint betNum;
        uint betValue;
        int balance;
        bytes32 userSeed;
        bytes32 serverSeed;
        uint endInitiatedTime;
    }

    /// @dev Minimal time span between profit transfer.
    uint public constant MIN_TRANSFER_TIMESPAN = 1 days;

    /// @dev Maximal time span between profit transfer.
    uint public constant MAX_TRANSFER_TIMSPAN = 6 * 30 days;

    bytes32 public constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant BET_TYPEHASH = keccak256(
        "Bet(uint32 roundId,uint8 gameType,uint256 number,uint256 value,int256 balance,bytes32 serverHash,bytes32 userHash,uint256 gameId)"
    );

    bytes32 public DOMAIN_SEPERATOR;

    /// @dev Current active game sessions.
    uint public activeGames = 0;

    /// @dev Game session id counter. Points to next free game session slot. So gameIdCntr -1 is the
    // number of game sessions created.
    uint public gameIdCntr = 1;

    /// @dev Only this address can accept and end games.
    address public serverAddress;

    /// @dev Address to transfer profit to.
    address payable public houseAddress;

    /// @dev Current house stake.
    uint public houseStake = 0;

    /// @dev House profit since last profit transfer.
    int public houseProfit = 0;

    /// @dev Min value user needs to deposit for creating game session.
    uint128 public minStake;

    /// @dev Max value user can deposit for creating game session.
    uint128 public maxStake;

    /// @dev Timeout until next profit transfer is allowed.
    uint public profitTransferTimeSpan = 14 days;

    /// @dev Last time profit transferred to house.
    uint public lastProfitTransferTimestamp;

    /// @dev Maps gameId to game struct.
    mapping (uint => Game) public gameIdGame;

    /// @dev Maps user address to current user game id.
    mapping (address => uint) public userGameId;

    /// @dev Maps user address to pending returns.
    mapping (address => uint) public pendingReturns;

    /// @dev Modifier, which only allows to execute if house stake is high enough.
    modifier onlyValidHouseStake(uint _activeGames) {
        uint minHouseStake = conflictRes.minHouseStake(_activeGames);
        require(houseStake >= minHouseStake, "inv houseStake");
        _;
    }

    /// @dev Modifier to check if value send fulfills user stake requirements.
    modifier onlyValidValue() {
        require(minStake <= msg.value && msg.value <= maxStake, "inv stake");
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

    /// @dev This event is fired when user creates game session.
    event LogGameCreated(address indexed user, uint indexed gameId, uint128 stake, bytes32 indexed serverEndHash, bytes32 userEndHash);

    /// @dev This event is fired when user requests conflict end.
    event LogUserRequestedEnd(address indexed user, uint indexed gameId);

    /// @dev This event is fired when server requests conflict end.
    event LogServerRequestedEnd(address indexed user, uint indexed gameId);

    /// @dev This event is fired when game session is ended.
    event LogGameEnded(address indexed user, uint indexed gameId, uint32 roundId, int balance, ReasonEnded reason);

    /// @dev this event is fired when owner modifies user's stake limits.
    event LogStakeLimitsModified(uint minStake, uint maxStake);

    /**
     * @dev Contract constructor.
     * @param _serverAddress Server address.
     * @param _minStake Min value user needs to deposit to create game session.
     * @param _maxStake Max value user can deposit to create game session.
     * @param _conflictResAddress Conflict resolution contract address.
     * @param _houseAddress House address to move profit to.
     */
    constructor(
        address _serverAddress,
        uint128 _minStake,
        uint128 _maxStake,
        address _conflictResAddress,
        address payable _houseAddress
    )
        ConflictResolutionManager(_conflictResAddress)
    {
        require(_minStake > 0 && _minStake <= _maxStake);

        serverAddress = _serverAddress;
        houseAddress = _houseAddress;
        lastProfitTransferTimestamp = block.timestamp;
        minStake = _minStake;
        maxStake = _maxStake;

        DOMAIN_SEPERATOR =  keccak256(abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256("Dicether"),
            keccak256("2"),
            block.chainid,
            address(this)
        ));
    }

    /**
     * @dev Set gameIdCntr. Can be only set before activating contract.
     */
    function setGameIdCntr(uint _gameIdCntr) public onlyOwner onlyNotActivated {
        require(gameIdCntr > 0);
        gameIdCntr = _gameIdCntr;
    }

    /**
     * @notice Withdraw pending returns.
     */
    function withdraw() public {
        uint toTransfer = pendingReturns[msg.sender];
        require(toTransfer > 0);

        pendingReturns[msg.sender] = 0;
        payable(msg.sender).transfer(toTransfer);
    }

    /**
     * @notice Transfer house profit to houseAddress.
     */
    function transferProfitToHouse() public {
        require(lastProfitTransferTimestamp.add(profitTransferTimeSpan) <= block.timestamp);

        // update last transfer timestamp
        lastProfitTransferTimestamp = block.timestamp;

        if (houseProfit <= 0) {
            // no profit to transfer
            return;
        }

        uint toTransfer = houseProfit.castToUint();

        houseProfit = 0;
        houseStake = houseStake.sub(toTransfer);

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
        houseStake = houseStake.add(msg.value);
    }

    /**
     * @dev Withdraw house stake.
     */
    function withdrawHouseStake(uint value) public onlyOwner {
        uint minHouseStake = conflictRes.minHouseStake(activeGames);

        require(value <= houseStake && houseStake.sub(value) >= minHouseStake);
        require(houseProfit <= 0 || houseProfit.castToUint() <= houseStake.sub(value));

        houseStake = houseStake.sub(value);
        payable(owner).transfer(value);
    }

    /**
     * @dev Withdraw house stake and profit.
     */
    function withdrawAll() public onlyOwner onlyPausedSince(3 days) {
        houseProfit = 0;
        uint toTransfer = houseStake;
        houseStake = 0;
        payable(owner).transfer(toTransfer);
    }

    /**
     * @dev Set new house address.
     * @param _houseAddress New house address.
     */
    function setHouseAddress(address payable _houseAddress) public onlyOwner {
        houseAddress = _houseAddress;
    }

    /**
     * @dev Set stake min and max value.
     * @param _minStake Min stake.
     * @param _maxStake Max stake.
     */
    function setStakeRequirements(uint128 _minStake, uint128 _maxStake) public onlyOwner {
        require(_minStake > 0 && _minStake <= _maxStake);
        minStake = _minStake;
        maxStake = _maxStake;
        emit LogStakeLimitsModified(minStake, maxStake);
    }

    /**
     * @dev Close game session.
     * @param _game Game session data.
     * @param _gameId Id of game session.
     * @param _userAddress User's address of game session.
     * @param _reason Reason for closing game session.
     * @param _balance Game session balance.
     */
    function closeGame(
        Game storage _game,
        uint _gameId,
        uint32 _roundId,
        address payable _userAddress,
        ReasonEnded _reason,
        int _balance
    )
        internal
    {
        _game.status = GameStatus.ENDED;

        activeGames = activeGames.sub(1);

        payOut(_userAddress, _game.stake, _balance);

        emit LogGameEnded(_userAddress, _gameId, _roundId, _balance, _reason);
    }

    /**
     * @dev End game by paying out user and server.
     * @param _userAddress User's address.
     * @param _stake User's stake.
     * @param _balance User's balance.
     */
    function payOut(address payable _userAddress, uint128 _stake, int _balance) internal {
        int stakeInt = int(uint(_stake));
        int houseStakeInt = houseStake.castToInt();

        assert(_balance <= conflictRes.maxBalance());
        assert((stakeInt.add(_balance)) >= 0);

        if (_balance > 0 && houseStakeInt < _balance) {
            // Should never happen!
            // House is bankrupt.
            // Payout left money.
            _balance = houseStakeInt;
        }

        houseProfit = houseProfit.sub(_balance);

        int newHouseStake = houseStakeInt.sub(_balance);
        houseStake = newHouseStake.castToUint();

        uint valueUser = stakeInt.add(_balance).castToUint();
        pendingReturns[_userAddress] += valueUser;
        if (pendingReturns[_userAddress] > 0) {
            safeSend(_userAddress);
        }
    }

    /**
     * @dev Send value of pendingReturns[_address] to _address.
     * @param _address Address to send value to.
     */
    function safeSend(address payable _address) internal {
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
        uint _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _userHash,
        uint _gameId,
        address _contractAddress,
        bytes memory _sig,
        address _address
    )
        internal
        view
    {
        // check if this is the correct contract
        address contractAddress = address(this);
        require(_contractAddress == contractAddress, "inv contractAddress");

        bytes32 roundHash = calcHash(
                _roundId,
                _gameType,
                _num,
                _value,
                _balance,
                _serverHash,
                _userHash,
                _gameId
        );

        verify(
                roundHash,
                _sig,
                _address
        );
    }

     /**
     * @dev Check if _sig is valid signature of _hash. Throws if invalid signature.
     * @param _hash Hash to check signature of.
     * @param _sig Signature of _hash.
     * @param _address Address of signer.
     */
    function verify(
        bytes32 _hash,
        bytes memory _sig,
        address _address
    )
        internal
        pure
    {
        (bytes32 r, bytes32 s, uint8 v) = signatureSplit(_sig);
        address addressRecover = ecrecover(_hash, v, r, s);
        require(addressRecover == _address, "inv sig");
    }

    /**
     * @dev Calculate typed hash of given data (compare eth_signTypedData).
     * @return Hash of given data.
     */
    function calcHash(
        uint32 _roundId,
        uint8 _gameType,
        uint _num,
        uint _value,
        int _balance,
        bytes32 _serverHash,
        bytes32 _userHash,
        uint _gameId
    )
        private
        view
        returns(bytes32)
    {
        bytes32 betHash = keccak256(abi.encode(
            BET_TYPEHASH,
            _roundId,
            _gameType,
            _num,
            _value,
            _balance,
            _serverHash,
            _userHash,
            _gameId
        ));

        return keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPERATOR,
            betHash
        ));
    }

    /**
     * @dev Split the given signature of the form rsv in r s v. v is incremented with 27 if
     * it is below 2.
     * @param _signature Signature to split.
     * @return r s v
     */
    function signatureSplit(bytes memory _signature)
        private
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(_signature.length == 65, "inv sig");

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
