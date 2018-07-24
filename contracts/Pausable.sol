pragma solidity ^0.4.24;

import "./Ownable.sol";


/**
 * @title Pausable
 * @dev Provides pausing support.
 * @author dicether
 */
contract Pausable is Ownable {
    /// @dev Is contract paused.
    bool public paused = false;

    /// @dev Time pause was called
    uint public timePaused = 0;

    /// @dev Modifier, which only allows function execution if not paused.
    modifier onlyNotPaused() {
        require(!paused, "paused");
        _;
    }

    /// @dev Modifier, which only allows function execution if paused.
    modifier onlyPaused() {
        require(paused);
        _;
    }

    /// @dev Modifier, which only allows function execution if paused longer than timeSpan.
    modifier onlyPausedSince(uint timeSpan) {
        require(paused && timePaused + timeSpan <= block.timestamp);
        _;
    }

    /// @dev Event is fired if paused.
    event LogPause();

    /// @dev Event is fired if pause is ended.
    event LogUnpause();

    /**
     * @dev Pause contract. No new game sessions can be created.
     */
    function pause() public onlyOwner onlyNotPaused {
        paused = true;
        timePaused = block.timestamp;
        emit LogPause();
    }

    /**
     * @dev Unpause contract.
     */
    function unpause() public onlyOwner onlyPaused {
        paused = false;
        timePaused = 0;
        emit LogUnpause();
    }
}
