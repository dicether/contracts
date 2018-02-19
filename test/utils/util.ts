import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as ChaiAsPromised from 'chai-as-promised';
import * as ChaiBigNumber from 'chai-bignumber';


BigNumber.prototype.idiv = function(divider) {
    // tslint:disable-next-line:no-invalid-this
    return this.div(divider);
};

export function increaseTimeAsync(addSeconds: number) {
    (web3.currentProvider as any).send({
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
