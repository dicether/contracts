const SafeCastMock = artifacts.require("./mocks/SafeCastMock.sol");
import BigNumber from 'bignumber.js';
import * as chai from 'chai';

import {configureChai, TRANSACTION_ERROR} from "./utils/util";


configureChai();
const expect = chai.expect;

contract('SafeCast', () => {
    const MAX_INT = new BigNumber(2).pow(255).minus(1);

    let safeCast: any;

    before(async function () {
        safeCast = await SafeCastMock.new();
    });

    describe('castToInt', function () {
        it('casts correctly', async function () {
            const a = new BigNumber(5678);

            const result = await safeCast.castToInt(a);
            expect(result).to.be.bignumber.equal(a);
        });

        it('throws an error if to large', async function () {
            const a = new BigNumber(MAX_INT.add(1));

            await expect(safeCast.castToInt(a)).to.be.rejectedWith(TRANSACTION_ERROR);
        });
    });

    describe('castToUint', function () {
        it('casts correctly', async function () {
            const a = new BigNumber(5678);

            const result = await safeCast.castToUint(a);
            expect(result).to.be.bignumber.equal(a);
        });

        it('throws an error if negative', async function () {
            const a = new BigNumber(-1);

            await expect(safeCast.castToUint(a)).to.be.rejectedWith(TRANSACTION_ERROR);
        });
    });
});
