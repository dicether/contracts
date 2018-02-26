pragma solidity ^0.4.18;

import "./ConflictResolutionInterface.sol";
import "./Ownable.sol";


/**
 * @title Conflict Resolution Manager
 * @author dicether
 */
contract ConflictResolutionManager is Ownable {
    /// @dev Conflict resolution contract.
    ConflictResolutionInterface public conflictRes;

    /// @dev New Conflict resolution contract.
    address public newConflictRes = 0;

    /// @dev Time update of new conflict resolution contract was initiated.
    uint public updateTime = 0;

    /// @dev Min time before new conflict res contract can be activated after initiating update.
    uint public constant MIN_TIMEOUT = 3 days;

    /// @dev Min time before new conflict res contract can be activated after initiating update.
    uint public constant MAX_TIMEOUT = 6 days;

    /// @dev Update of conflict resolution contract was initiated.
    event LogUpdatingConflictResolution(address newConflictResolutionAddress);

    /// @dev New conflict resolution contract is active.
    event LogUpdatedConflictResolution(address newConflictResolutionAddress);

    /**
     * @dev Constructor
     * @param _conflictResAddress conflict resolution contract address.
     */
    function ConflictResolutionManager(address _conflictResAddress) public {
        conflictRes = ConflictResolutionInterface(_conflictResAddress);
    }

    /**
     * @dev Initiate conflict resolution contract update.
     * @param _newConflictResAddress New conflict resolution contract address.
     */
    function updateConflictResolution(address _newConflictResAddress) public onlyOwner {
        newConflictRes = _newConflictResAddress;
        updateTime = block.timestamp;

        LogUpdatingConflictResolution(_newConflictResAddress);
    }

    /**
     * @dev Active new conflict resolution contract.
     */
    function activateConflictResolution() public onlyOwner {
        require(newConflictRes != 0);
        require(updateTime != 0);
        require(updateTime + MIN_TIMEOUT <= block.timestamp && block.timestamp <= updateTime + MAX_TIMEOUT);

        conflictRes = ConflictResolutionInterface(newConflictRes);
        newConflictRes = 0;
        updateTime = 0;

        LogUpdatedConflictResolution(newConflictRes);
    }
}
