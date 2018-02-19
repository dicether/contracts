pragma solidity 0.4.18;

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
     * @dev Destroy contract and transfer ether to address _targetAddress.
     * @param _targetAddress Address ether should be transferred to.
     */
    function destroy(address _targetAddress) public onlyOwner onlyPausedSince(TIMEOUT_DESTROY) {
        selfdestruct(_targetAddress);
    }
}
