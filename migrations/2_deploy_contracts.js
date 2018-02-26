const GameChannel = artifacts.require("./GameChannel.sol");
const ConflictResolution = artifacts.require("./ConflictResolution.sol");

module.exports = function(deployer, network, accounts) {
    let serverAccount = "0x73fd0d10438be13a31ff12e20790f2002cdb8529";
    let houseAccount = "0xb9629e0766491dfdb94f632741da28945d4c03ce";
    if (network === "development") {
        serverAccount = accounts[1];
        houseAccount = accounts[4];
    }
    deployer.deploy(ConflictResolution).then(() => {
        return deployer.deploy(GameChannel, serverAccount, 1e17, 1e18, ConflictResolution.address,
            houseAccount, 1,  {gas: 4000000});
    });

};
