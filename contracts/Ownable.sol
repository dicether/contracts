pragma solidity ^0.4.23;


/**
 * @title Owned
 * @dev Basic contract for authorization control.
 * @author dicether
 */
contract Ownable {
    address public owner;

    event LogOwnerShipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Modifier, which throws if called by other account than owner.
     */
    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Set contract creator as initial owner
     */
    constructor() public {
        owner = msg.sender;
    }

    /**
     * @dev Allows the current owner to transfer control of the
     * contract to a newOwner _newOwner.
     * @param _newOwner The address to transfer ownership to.
     */
    function setOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0));
        emit LogOwnerShipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
