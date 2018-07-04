import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as ChaiAsPromised from 'chai-as-promised';
import * as ChaiBigNumber from 'chai-bignumber';
import {promisify} from "util";
import * as Web3 from 'web3';
import {signStartData} from "./signUtil";


BigNumber.prototype.idiv = function(divider) {
    // tslint:disable-next-line:no-invalid-this
    return this.dividedToIntegerBy(divider);
};

export async function increaseTimeAsync(addSeconds: number) {
    await promisify(web3.currentProvider.sendAsync)({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [addSeconds], id: 0
    })
}

export async function getTransactionCost(receipt: Web3.TransactionReceipt) {
    const tx = await web3.eth.getTransaction(receipt.transactionHash);

    const gasPrice = tx.gasPrice;
    const gasUsed = receipt.gasUsed;

    return new BigNumber(gasPrice.toString()).mul(gasUsed);
}

export function configureChai() {
    chai.config.includeStack = true;
    chai.use(ChaiBigNumber());
    chai.use(ChaiAsPromised);
}

export async function createGame(contract: any,
                                 serverAddress: string,
                                 userAddress: string,
                                 serverEndHash: string,
                                 userEndHash: string,
                                 userStake: BigNumber,
                                 createBefore: number =  Math.floor(Date.now() / 1000) + 120 * 60) {
    const lastGameId = (await contract.userGameId.call(userAddress)).toNumber();

    const sig = signStartData(contract.address, userAddress, lastGameId, createBefore, serverEndHash, serverAddress);

    return contract.createGame(userEndHash, lastGameId, createBefore, serverEndHash, sig, {from: userAddress, value: userStake});

}

export const TRANSACTION_ERROR = 'VM Exception';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
