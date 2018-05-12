import {MAX_VALUE} from "../utils/stateChannel";
import BigNumber from "bignumber.js";
import * as chai from "chai";


const expect = chai.expect;


export const ZERO_SEED = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const phash1 = web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000001",
    {encoding: "hex"});
export const phash2 = web3.sha3(phash1,
    {encoding: "hex"});
export const phash3 = web3.sha3(phash2,
    {encoding: "hex"});
export const shash1 = web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000002",
    {encoding: "hex"});
export const shash2 = web3.sha3(shash1,
    {encoding: "hex"});
export const shash3 = web3.sha3(shash2,
    {encoding: "hex"});

export const BET_VALUE = MAX_VALUE;

export async function checkGameStatusAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number) {
    // check game session state
    const game = await gameChannel.gameIdGame.call(gameId);
    const status = game[0].toNumber();

    expect(status).to.equal(statusRef);
}

export async function checkGameStateAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number,
                                   gameTypeRef: number, roundIdRef: number, numRef: number, betValueRef: BigNumber,
                                   balanceRef: BigNumber, playerSeedRef: string, serverSeedRef: string) {
    const game = await gameChannel.gameIdGame.call(gameId);

    const status = game[0].toNumber();
    const gameType = game[2].toNumber();
    const roundId = game[3].toNumber();
    const betNum = game[4].toNumber();
    const betValue = game[5];
    const playerSeed = game[7];
    const serverSeed = game[8];

    expect(status).to.equal(statusRef);
    expect(gameType).to.equal(gameTypeRef);
    expect(roundId).to.equal(roundIdRef);
    expect(betNum).to.equal(numRef);
    expect(betValue).to.be.bignumber.equal(betValueRef);
    expect(playerSeed).to.equal(playerSeedRef);
    expect(serverSeed).to.equal(serverSeedRef);
}

export async function checkActiveGamesAsync(gameChannel: any, activeGamesRef: number) {
    const activeGames = await gameChannel.activeGames.call();
    expect(activeGames).to.be.bignumber.equal(activeGamesRef);
}
