const BigNumber = require('bignumber.js');

const GameChannel = artifacts.require("./GameChannel.sol");
const ConflictResolution = artifacts.require("./ConflictResolution.sol");

module.exports = function(deployer, network, accounts) {
    let serverAccount = "0xcef260a5fed7a896bbe07b933b3a5c17aec094d8";
    let houseAccount = "0x403681a631fd186d6b7b68f20be16c4c8e3edc12";
    if (network === "development") {
        serverAccount = accounts[1];
        houseAccount = accounts[4];
    }

    deployer.deploy(ConflictResolution, {gas: 700000}).then(() => {
        return deployer.deploy(GameChannel, serverAccount, 1e16, 2e17, ConflictResolution.address,
            houseAccount, 1, {gas: 4000000});

    }).then( () => {
        return GameChannel.deployed();
    }).then(gameChannel => {
        if (network === "development") {
            gameChannel.addHouseStake({from: accounts[0], value: new BigNumber('10e18')});
        }
     });
};
