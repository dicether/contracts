import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types/artifacts";
import {Address, getAddress} from "viem";

import {INITIAL_HOUSE_STAKE} from "./utils/config";

export interface GameChannelFixtureReturn {
    gameChannel: ContractTypesMap["GameChannel"];
    owner: Address;
    house: Address;
    server: Address;
    other: Address;
    other2: Address;
}

export const gameChannelFixture = async function (): Promise<GameChannelFixtureReturn> {
    const accounts = await hre.viem.getWalletClients();

    const owner = getAddress(accounts[0].account.address);
    const server = getAddress(accounts[1].account.address);
    const house = getAddress(accounts[2].account.address);
    const other = getAddress(accounts[3].account.address);
    const other2 = getAddress(accounts[4].account.address);

    const diceLower = await hre.viem.deployContract("DiceLower");
    const diceHigher = await hre.viem.deployContract("DiceHigher");

    const chooseFrom12 = await hre.viem.deployContract("ChooseFrom12");

    const flipACoin = await hre.viem.deployContract("FlipACoin");
    const keno = await hre.viem.deployContract("Keno");
    const wheel = await hre.viem.deployContract("Wheel");

    const plinko = await hre.viem.deployContract("Plinko");

    const conflictResolution = await hre.viem.deployContract(
        "ConflictResolution",
        [
            [
                diceLower.address,
                diceHigher.address,
                chooseFrom12.address,
                flipACoin.address,
                keno.address,
                wheel.address,
                plinko.address,
            ],
        ],
        {},
    );

    const gameChannel = await hre.viem.deployContract("GameChannel", [
        server,
        BigInt((1e16).toString()),
        BigInt((200e18).toString()),
        conflictResolution.address,
        house,
    ]);

    return {
        gameChannel,
        owner,
        server,
        house,
        other,
        other2,
    };
};

export const enableGameChannelFixture = async function (): Promise<GameChannelFixtureReturn> {
    const {gameChannel, owner, ...rest} = await gameChannelFixture();
    await gameChannel.write.addHouseStake({account: owner, value: INITIAL_HOUSE_STAKE});
    await gameChannel.write.activate({account: owner});
    await gameChannel.write.unpause({account: owner});

    return {gameChannel, owner, ...rest};
};
