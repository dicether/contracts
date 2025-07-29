import {maxBet} from "@dicether/state-channel";
import {expect} from "chai";
import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";
import {Address, keccak256} from "viem";

import {enableGameChannelFixture, GameChannelFixtureReturn} from "../gameChannelFixture";
import {MAX_STAKE, MIN_BANKROLL} from "../utils/config";
import {createGame} from "../utils/util";

export const ZERO_SEED = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const phash1 = keccak256("0x0000000000000000000000000000000000000000000000000000000000000001");
export const phash2 = keccak256(phash1);
export const phash3 = keccak256(phash2);
export const shash1 = keccak256("0x0000000000000000000000000000000000000000000000000000000000000002");
export const shash2 = keccak256(shash1);
export const shash3 = keccak256(shash2);

export const BET_VALUE = BigInt(maxBet(1, 1, Number(MIN_BANKROLL / BigInt(1e9)), 1)) * BigInt(1e9);

export async function checkGameStatusAsync(
    gameChannel: ContractTypesMap["GameChannel"],
    gameId: bigint,
    statusRef: number,
    _reasonEndedRef: number,
): Promise<void> {
    // check game session state
    const game = await gameChannel.read.gameIdGame([gameId]);
    const status = game[0];

    expect(status).to.equal(statusRef);
}

export async function checkGameStateAsync(
    gameChannel: ContractTypesMap["GameChannel"],
    gameId: bigint,
    statusRef: number,
    reasonEndedRef: number,
    gameTypeRef: number,
    roundIdRef: number,
    numRef: bigint,
    betValueRef: bigint,
    balanceRef: bigint,
    userSeedRef: string,
    serverSeedRef: string,
): Promise<void> {
    const game = await gameChannel.read.gameIdGame([gameId]);

    const status = game[0];
    const gameType = game[2];
    const roundId = game[3];
    const betNum = game[4];
    const betValue = game[5];
    const userSeed = game[7];
    const serverSeed = game[8];

    expect(status).to.equal(statusRef);
    expect(gameType).to.equal(gameTypeRef);
    expect(roundId).to.equal(roundIdRef);
    expect(betNum).to.equal(numRef);
    expect(betValue).to.equal(betValueRef);
    expect(userSeed).to.equal(userSeedRef);
    expect(serverSeed).to.equal(serverSeedRef);
}

export async function checkActiveGamesAsync(
    gameChannel: ContractTypesMap["GameChannel"],
    activeGamesRef: bigint,
): Promise<void> {
    const activeGames = await gameChannel.read.activeGames();
    expect(activeGames).to.equal(activeGamesRef);
}

export type CreateGameFixtureReturn = GameChannelFixtureReturn & {
    other: Address;
    user1: Address;
    user2: Address;
    stake: bigint;
    gameId: bigint;
};

export const createGameFixture = async function (): Promise<CreateGameFixtureReturn> {
    const accounts = await hre.viem.getWalletClients();

    const user1 = accounts[5].account.address;
    const user2 = accounts[6].account.address;

    const {gameChannel, server, ...rest} = await enableGameChannelFixture();

    await createGame(gameChannel, server, user1, shash3, phash3, MAX_STAKE);

    return {gameChannel, server, user1, user2, stake: MAX_STAKE, gameId: 1n, ...rest};
};
