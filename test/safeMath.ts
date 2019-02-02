const SafeMathMock = artifacts.require("./mocks/SafeMathMock.sol");
import BN from 'bn.js';
import * as chai from 'chai';

import {configureChai, TRANSACTION_ERROR} from "./utils/util";

configureChai();
const expect = chai.expect;

// from zeppelin-solidity
contract('SafeMath', () => {
    const MIN_INT = new BN(2).pow(new BN(255)).neg();
    const MAX_INT = new BN(2).pow(new BN(255)).subn(1);
    const MAX_UINT = new BN(2).pow(new BN(256)).subn(1);

    let safeMath: any;

    before(async function () {
        safeMath = await SafeMathMock.new();
    });

    describe('unsigned integers', function () {
        describe('add', function () {
            it('adds correctly', async function () {
                const a = new BN(5678);
                const b = new BN(1234);

                const result = await safeMath.addUints(a, b);
                expect(result).to.eq.BN(a.add(b));
            });

            it('throws an error on addition overflow', async function () {
                const a = MAX_UINT;
                const b = new BN(1);

                await expect(safeMath.addUints(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('sub', function () {
            it('subtracts correctly', async function () {
                const a = new BN(5678);
                const b = new BN(1234);

                const result = await safeMath.subUints(a, b);
                expect(result).to.eq.BN(a.sub(b));
            });

            it('throws an error if subtraction result would be negative', async function () {
                const a = new BN(1234);
                const b = new BN(5678);

                await expect(safeMath.subUints(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('mul', function () {
            it('multiplies correctly', async function () {
                const a = new BN(1234);
                const b = new BN(5678);

                const result = await safeMath.mulUints(a, b);
                expect(result).to.eq.BN(a.mul(b));
            });

            it('handles a zero product correctly', async function () {
                const a = new BN(0);
                const b = new BN(5678);

                const result = await safeMath.mulUints(a, b);
                expect(result).to.eq.BN(a.mul(b));
            });

            it('throws an error on multiplication overflow', async function () {
                const a = MAX_UINT;
                const b = new BN(2);

                await expect(safeMath.mulUints(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('div', function () {
            it('divides correctly', async function () {
                const a = new BN(5678);
                const b = new BN(5678);

                const result = await safeMath.divUints(a, b);
                expect(result).to.eq.BN(a.div(b));
            });

            it('throws an error on zero division', async function () {
                const a = new BN(5678);
                const b = new BN(0);

                await expect(safeMath.divUints(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });
    });

    describe('signed integers', function () {
        describe('add', function () {
            it('adds correctly if it does not overflow and the result is positve', async function () {
                const a = new BN(1234);
                const b = new BN(5678);

                const result = await safeMath.addInts(a, b);
                expect(result).to.eq.BN(a.add(b));
            });

            it('adds correctly if it does not overflow and the result is negative', async function () {
                const a = MAX_INT;
                const b = MIN_INT;

                const result = await safeMath.addInts(a, b);
                expect(result).to.eq.BN(a.add(b));
            });

            it('throws an error on positive addition overflow', async function () {
                const a = MAX_INT;
                const b = new BN(1);

                await expect(safeMath.addInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it('throws an error on negative addition overflow', async function () {
                const a = MIN_INT;
                const b = new BN(-1);

                await expect(safeMath.addInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('sub', function () {
            it('subtracts correctly if it does not overflow and the result is positive', async function () {
                const a = new BN(5678);
                const b = new BN(1234);

                const result = await safeMath.subInts(a, b);
                expect(result).to.eq.BN(a.sub(b));
            });

            it('subtracts correctly if it does not overflow and the result is negative', async function () {
                const a = new BN(1234);
                const b = new BN(5678);

                const result = await safeMath.subInts(a, b);
                expect(result).to.eq.BN(a.sub(b));
            });

            it('throws an error on positive subtraction overflow', async function () {
                const a = MAX_INT;
                const b = new BN(-1);

                await expect(safeMath.subInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it('throws an error on negative subtraction overflow', async function () {
                const a = MIN_INT;
                const b = new BN(1);

                await expect(safeMath.subInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('mul', function () {
            it('multiplies correctly', async function () {
                const a = new BN(5678);
                const b = new BN(-1234);

                const result = await safeMath.mulInts(a, b);
                expect(result).to.eq.BN(a.mul(b));
            });

            it('handles a zero product correctly', async function () {
                const a = new BN(0);
                const b = new BN(5678);

                const result = await safeMath.mulInts(a, b);
                expect(result).to.eq.BN(a.mul(b));
            });

            it('throws an error on multiplication overflow, positive operands', async function () {
                const a = MAX_INT;
                const b = new BN(2);

                await expect(safeMath.mulInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it('throws an error on multiplication overflow, negative operands', async function () {
                const a = MIN_INT;
                const b = new BN(-1);

                await expect(safeMath.mulInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });

        describe('div', function () {
            it('divides correctly', async function () {
                const a = new BN(-5678);
                const b = new BN(5678);

                const result = await safeMath.divInts(a, b);
                expect(result).to.eq.BN(a.div(b));
            });

            it('throws an error on zero division', async function () {
                const a = new BN(-5678);
                const b = new BN(0);

                await expect(safeMath.divInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it('throws an error on overflow, negative second', async function () {
                const a = new BN(MIN_INT);
                const b = new BN(-1);

                await expect(safeMath.divInts(a, b)).to.be.rejectedWith(TRANSACTION_ERROR);
            });
        });
    });
});
