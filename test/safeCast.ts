const SafeCastMock = artifacts.require("./mocks/SafeCastMock.sol");
import BN from 'bn.js';
import * as chai from 'chai';

import {configureChai, TRANSACTION_ERROR} from "./utils/util";


configureChai();
const expect = chai.expect;

contract('SafeCast', () => {
    const MAX_INT = new BN(2).pow(new BN(255)).subn(1);

    let safeCast: any;

    before(async function () {
        safeCast = await SafeCastMock.new();
    });

    describe('castToInt', function () {
        it('casts correctly', async function () {
            const a = new BN(5678);

            const result = await safeCast.castToInt(a);
            expect(result).to.eq.BN(a);
        });

        it('throws an error if to large', async function () {
            const a = new BN(MAX_INT.addn(1));

            await expect(safeCast.castToInt(a)).to.be.rejectedWith(TRANSACTION_ERROR);
        });
    });

    describe('castToUint', function () {
        it('casts correctly', async function () {
            const a = new BN(5678);

            const result = await safeCast.castToUint(a);
            expect(result).to.eq.BN(a);
        });

        it('throws an error if negative', async function () {
            const a = new BN(-1);

            await expect(safeCast.castToUint(a)).to.be.rejectedWith(TRANSACTION_ERROR);
        });
    });
});
