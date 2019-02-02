import {maxBet} from "@dicether/state-channel";
import BN from "bn.js";
import * as chai from "chai";

import {MIN_BANKROLL} from "../utils/config";


const expect = chai.expect;


export const ZERO_SEED = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const phash1 = web3.utils.sha3("0x0000000000000000000000000000000000000000000000000000000000000001");
export const phash2 = web3.utils.sha3(phash1);
export const phash3 = web3.utils.sha3(phash2);
export const shash1 = web3.utils.sha3("0x0000000000000000000000000000000000000000000000000000000000000002");
export const shash2 = web3.utils.sha3(shash1);
export const shash3 = web3.utils.sha3(shash2);

export const BET_VALUE = new BN(maxBet(1, 1, MIN_BANKROLL.div(new BN(1e9)).toNumber())).mul(new BN(1e9));

export async function checkGameStatusAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number) {
    // check game session state
    const game = await gameChannel.gameIdGame.call(gameId);
    const status = game[0].toNumber();

    expect(status).to.equal(statusRef);
}

export async function checkGameStateAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number,
                                   gameTypeRef: number, roundIdRef: number, numRef: number, betValueRef: BN,
                                   balanceRef: BN, userSeedRef: string, serverSeedRef: string) {
    const game = await gameChannel.gameIdGame.call(gameId);

    const status = game[0].toNumber();
    const gameType = game[2].toNumber();
    const roundId = game[3].toNumber();
    const betNum = game[4].toNumber();
    const betValue = game[5];
    const userSeed = game[7];
    const serverSeed = game[8];

    expect(status).to.equal(statusRef);
    expect(gameType).to.equal(gameTypeRef);
    expect(roundId).to.equal(roundIdRef);
    expect(betNum).to.equal(numRef);
    expect(betValue).to.eq.BN(betValueRef);
    expect(userSeed).to.equal(userSeedRef);
    expect(serverSeed).to.equal(serverSeedRef);
}

export async function checkActiveGamesAsync(gameChannel: any, activeGamesRef: number) {
    const activeGames = await gameChannel.activeGames.call();
    expect(activeGames).to.eq.BN(activeGamesRef);
}
