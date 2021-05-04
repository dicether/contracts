const GameChannel = artifacts.require("./GameChannel.sol");
const ConflictResolution = artifacts.require("./ConflictResolution.sol");
const DiceLower = artifacts.require("./games/DiceLower.sol");
const DiceHigher = artifacts.require("./games/DiceHigher.sol");
const ChooseFrom12 = artifacts.require("./games/ChooseFrom12.sol");
const FlipACoin = artifacts.require("./games/FlipACoin.sol");
const Keno = artifacts.require("./games/Keno.sol");
const Wheel = artifacts.require("./games/Wheel.sol");
const Plinko = artifacts.require("./games/Plinko.sol");


module.exports = async function(deployer, network, accounts) {
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
    } else if (network === "main") {
        serverAccount = "0xcef260a5fed7a896bbe07b933b3a5c17aec094d8";
        houseAccount = "0x71be1ace87248f3950bdfc4c89b4b3eed059f6f3";
        chainId = 1;
    } else {
        throw "Invalid network!"
    }

    await deployer.deploy(DiceLower);
    await deployer.deploy(DiceHigher);
    await deployer.deploy(ChooseFrom12);
    await deployer.deploy(FlipACoin);
    await deployer.deploy(Keno);
    await deployer.deploy(Wheel);
    await deployer.deploy(Plinko);

    await DiceLower.deployed();
    await DiceHigher.deployed();
    await ChooseFrom12.deployed();
    await FlipACoin.deployed();
    await Keno.deployed();
    await Wheel.deployed();
    await Plinko.deployed();

    await deployer.deploy(
        ConflictResolution,
        [DiceLower.address, DiceHigher.address, ChooseFrom12.address, FlipACoin.address, Keno.address, Wheel.address, Plinko.address],
        {gas: 2000000}
    );

    await ConflictResolution.deployed();
    await deployer.deploy(
        GameChannel,
        serverAccount,
        1e16.toString(),
        200e18.toString(),
        ConflictResolution.address,
        houseAccount,
        chainId,
        {gas: 5500000}
    );

    const gameChannel = await GameChannel.deployed();

    if (network === "development") {
        await gameChannel.addHouseStake({from: accounts[0], value: 50e18.toString()});
        await gameChannel.activate({from: accounts[0]});
        await gameChannel.unpause({from: accounts[0]});
    }
};
