const BigNumber = require('bignumber.js');

const GameChannel = artifacts.require("./GameChannel.sol");
const ConflictResolution = artifacts.require("./ConflictResolution.sol");
const DiceLower = artifacts.require("./games/DiceLower.sol");
const DiceHigher = artifacts.require("./games/DiceHigher.sol");


module.exports = function(deployer, network, accounts) {
    let serverAccount = "";
    let houseAccount = "";
    let chainId = 123456789;
    if (network === "development" || network === "test") {
        serverAccount = accounts[1];
        houseAccount = accounts[4];
        chainId = 123456789;
    } else if (network === "rinkeby") {
        serverAccount = "0xcef260a5fed7a896bbe07b933b3a5c17aec094d8";
        houseAccount = "0x403681a631fd186d6b7b68f20be16c4c8e3edc12";
        chainId = 4;
    } else if (network === "main"){
        serverAccount = "0xcef260a5fed7a896bbe07b933b3a5c17aec094d8";
        houseAccount = "0x71be1ace87248f3950bdfc4c89b4b3eed059f6f3";
        chainId = 1;
    } else {
        throw "Invalid network!"
    }

    deployer.deploy([DiceLower, DiceHigher, ChooseFrom12]).then(() => {
        return deployer.deploy(ConflictResolution, [DiceLower.address, DiceHigher.address], {gas: 2000000});
    }).then(() => {
        return deployer.deploy(GameChannel, serverAccount, 1e16, 5e18, ConflictResolution.address,
            houseAccount, chainId, {gas: 5000000});

    }).then( () => {
        return GameChannel.deployed();
    }).then(gameChannel => {
        if (network === "development") {
            return gameChannel.addHouseStake({from: accounts[0], value: new BigNumber('20e18')}).then(() => {
                return gameChannel.activate({from: accounts[0]});
            }).then(() => {
                return gameChannel.unpause({from: accounts[0]});
            });
        }
    });
};
