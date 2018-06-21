import {BigNumber as BN} from 'bignumber.js';
import web3 = require('web3');

declare module "bignumber.js" {
    interface BigNumber {
        idiv(param: BigNumber | number | string): BN;
    }

}

declare global {
    const web3: web3;
}