const MathUtilMock = artifacts.require("./mocks/MathUtilMock.sol");
import * as chai from 'chai';

import {configureChai} from './utils/util';

configureChai();
const expect = chai.expect;


contract('MathUtilMock', () => {
    let mathUtil: any;
    
    before(async () => {
        mathUtil = await MathUtilMock.new();
    });

    it("max", async () => {
        const a = 100;
        const b = 1;
        const res = await mathUtil.max(a, b);
        expect(res).to.be.bignumber.equal(a);
    });

    it('min', async () => {
        const a = 100;
        const b = 1;
        const res = await mathUtil.min(a, b);
        expect(res).to.be.bignumber.equal(b);
    });

    describe('abs', () => {
        it('Should work for positive number', async () => {
            const a = 100;
            const res = await mathUtil.abs(a);
            expect(res).to.be.bignumber.equal(Math.abs(a));
        });

        it('Should work for negative number', async () => {
            const a = -100;
            const res = await mathUtil.abs(a);
            expect(res).to.be.bignumber.equal(Math.abs(a));
        });
    });
});
