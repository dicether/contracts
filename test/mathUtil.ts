import BN from "bn.js";

const MathUtilMock = artifacts.require("./mocks/MathUtilMock.sol");
import * as chai from "chai";

import {configureChai} from "./utils/util";

configureChai();
const expect = chai.expect;

contract("MathUtilMock", () => {
    const MAX_INT = new BN(2).pow(new BN(255)).subn(1);
    let mathUtil: any;

    before(async () => {
        mathUtil = await MathUtilMock.new();
    });

    it("max", async () => {
        const a = 100;
        const b = 1;
        const res = await mathUtil.max(a, b);
        expect(res).to.eq.BN(a);
    });

    it("min", async () => {
        const a = 100;
        const b = 1;
        const res = await mathUtil.min(a, b);
        expect(res).to.eq.BN(b);
    });

    describe("abs", () => {
        it("Should work for positive number", async () => {
            const a = 100;
            const res = await mathUtil.abs(a);
            expect(res).to.eq.BN(Math.abs(a));
        });

        it("Should work for negative number", async () => {
            const a = -100;
            const res = await mathUtil.abs(a);
            expect(res).to.eq.BN(Math.abs(a));
        });

        it("Should work for -MAX_INT", async () => {
            const res = await mathUtil.abs(MAX_INT.neg());
            expect(res).to.eq.BN(MAX_INT);
        });
    });
});
