import {TransactionReceipt} from "@ethersproject/abstract-provider";
import bnChai from "bn-chai";
import BN from "bn.js";
import * as chai from "chai";
import ChaiAsPromised from "chai-as-promised";
import {HttpProvider} from "web3-core";

import {promisify} from "util";
import {signStartData} from "./signUtil";


export async function increaseTimeAsync(addSeconds: number) {
    await promisify((web3.currentProvider as HttpProvider).send)({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [addSeconds], id: 0
    })
}

export async function getTransactionCost(receipt: TransactionReceipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);

    const gasPrice = tx.gasPrice;
    const gasUsed = receipt.gasUsed;

    return new BN(gasPrice.toString()).mul(new BN(gasUsed.toString()));
}

export function configureChai() {
    chai.config.includeStack = true;
    chai.use(ChaiAsPromised);
    chai.use(bnChai(BN));
}

export async function createGame(contract: any,
                                 serverAddress: string,
                                 userAddress: string,
                                 serverEndHash: string,
                                 userEndHash: string,
                                 userStake: BN,
                                 createBefore: number =  Math.floor(Date.now() / 1000) + 120 * 60) {
    const lastGameId = (await contract.userGameId.call(userAddress)).toNumber();

    const sig = signStartData(contract.address, userAddress, lastGameId, createBefore, serverEndHash, serverAddress);

    return contract.createGame(userEndHash, lastGameId, createBefore, serverEndHash, sig, {from: userAddress, value: userStake});
}

export async function getBalance(address: string) {
    return web3.utils.toBN(await web3.eth.getBalance(address));
}

export function max(num1: BN, num2: BN) {
    return num1.gte(num2) ? num1 : num2;
}

export const TRANSACTION_ERROR = 'VM Exception';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
