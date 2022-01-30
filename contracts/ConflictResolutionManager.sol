// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

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
    address public newConflictRes = address(0);

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
    constructor(address _conflictResAddress) {
        conflictRes = ConflictResolutionInterface(_conflictResAddress);
    }

    /**
     * @dev Initiate conflict resolution contract update.
     * @param _newConflictResAddress New conflict resolution contract address.
     */
    function updateConflictResolution(address _newConflictResAddress) public onlyOwner {
        newConflictRes = _newConflictResAddress;
        updateTime = block.timestamp;

        emit LogUpdatingConflictResolution(_newConflictResAddress);
    }

    /**
     * @dev Active new conflict resolution contract.
     */
    function activateConflictResolution() public onlyOwner {
        require(newConflictRes != address(0));
        require(updateTime != 0);
        require(updateTime + MIN_TIMEOUT <= block.timestamp && block.timestamp <= updateTime + MAX_TIMEOUT);

        conflictRes = ConflictResolutionInterface(newConflictRes);
        newConflictRes = address(0);
        updateTime = 0;

        emit LogUpdatedConflictResolution(newConflictRes);
    }
}
