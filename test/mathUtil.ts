import {reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";
import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";

describe("MathUtilMock", () => {
    const MAX_INT = 2n ** 255n - 1n;

    let mathUtil: ContractTypesMap["MathUtilMock"];

    before(async function () {
        await reset();
        mathUtil = await hre.viem.deployContract("MathUtilMock");
    });

    it("max", async () => {
        const a = 100n;
        const b = 1n;
        const res = await mathUtil.read.max([a, b]);
        expect(res).to.eq(a);
    });

    it("min", async () => {
        const a = 100n;
        const b = 1n;
        const res = await mathUtil.read.min([a, b]);
        expect(res).to.eq(b);
    });

    describe("abs", () => {
        it("Should work for positive number", async () => {
            const a = 100n;
            const res = await mathUtil.read.abs([a]);
            expect(res).to.eq(a < 0n ? -a : a);
        });

        it("Should work for negative number", async () => {
            const a = -100n;
            const res = await mathUtil.read.abs([a]);
            expect(res).to.eq(a < 0n ? -a : a);
        });

        it("Should work for -MAX_INT", async () => {
            const res = await mathUtil.read.abs([-MAX_INT]);
            expect(res).to.eq(MAX_INT);
        });
    });
});
