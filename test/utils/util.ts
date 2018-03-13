import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as ChaiAsPromised from 'chai-as-promised';
import * as ChaiBigNumber from 'chai-bignumber';
import {promisify} from "util";


BigNumber.prototype.idiv = function(divider) {
    // tslint:disable-next-line:no-invalid-this
    return this.div(divider);
};

export async function increaseTimeAsync(addSeconds: number) {
    await promisify(web3.currentProvider.sendAsync)({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [addSeconds], id: 0
    })
}

export function configureChai() {
    chai.config.includeStack = true;
    chai.use(ChaiBigNumber());
    chai.use(ChaiAsPromised);
}

export const TRANSACTION_ERROR = 'VM Exception';
