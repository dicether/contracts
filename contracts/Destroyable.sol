// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./Pausable.sol";


/**
 * @title Destroyable
 * @dev Provides destroy support
 * @author dicether
 */
contract Destroyable is Pausable {
    /// @dev After pausing the contract for 20 days owner can selfdestruct it.
    uint public constant TIMEOUT_DESTROY = 20 days;

    /**
     * @dev Destroy contract and transfer ether to owner.
     */
    function destroy() public onlyOwner onlyPausedSince(TIMEOUT_DESTROY) {
        selfdestruct(payable(owner));
    }
}
