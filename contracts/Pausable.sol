// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./Activatable.sol";
import "./SafeMath.sol";


/**
 * @title Pausable
 * @dev Provides pausing support.
 * @author dicether
 */
contract Pausable is Activatable {
    using SafeMath for uint;

    /// @dev Is contract paused. Initial it is paused.
    bool public paused = true;

    /// @dev Time pause was called
    uint public timePaused = block.timestamp;

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
        require(paused && (timePaused.add(timeSpan) <= block.timestamp));
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
     * @dev Unpause contract. Initial contract is paused and can only be unpaused after activating it.
     */
    function unpause() public onlyOwner onlyPaused onlyActivated {
        paused = false;
        timePaused = 0;
        emit LogUnpause();
    }
}
