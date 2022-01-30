// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.11;

import "./Ownable.sol";


/**
 * @title Activatable
 * @dev Contract is initial deactivated and can be activated by owner.
 * @author Dicether
 */
contract Activatable is Ownable {
    bool public activated = false;

    /// @dev Event is fired if activated.
    event LogActive();

    /// @dev Modifier, which only allows function execution if activated.
    modifier onlyActivated() {
        require(activated);
        _;
    }

    /// @dev Modifier, which only allows function execution if not activated.
    modifier onlyNotActivated() {
        require(!activated);
        _;
    }

    /// @dev activate contract, can be only called once by the contract owner.
    function activate() public onlyOwner onlyNotActivated {
        activated = true;
        emit LogActive();
    }
}
