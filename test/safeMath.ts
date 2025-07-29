import {expect} from "chai";
import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";

const OVERFLOW_ERROR = "Arithmetic operation overflowed";
const DIVISION_BY_ZERO_ERROR = "Division or modulo division";

describe("SafeMath", () => {
    const MIN_INT = -(2n ** 255n);
    const MAX_INT = 2n ** 255n - 1n;
    const MAX_UINT = 2n ** 256n - 1n;

    let safeMath: ContractTypesMap["SafeMathMock"];

    before(async function () {
        await hre.network.provider.send("hardhat_reset");
        safeMath = await hre.viem.deployContract("SafeMathMock");
    });

    describe("unsigned integers", function () {
        describe("add", function () {
            it("adds correctly", async function () {
                const a = 5678n;
                const b = 1234n;

                const result = await safeMath.read.addUints([a, b]);
                expect(result).to.eq(a + b);
            });

            it("throws an error on addition overflow", async function () {
                const a = MAX_UINT;
                const b = 1n;

                await expect(safeMath.read.addUints([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("sub", function () {
            it("subtracts correctly", async function () {
                const a = 5678n;
                const b = 1234n;

                const result = await safeMath.read.subUints([a, b]);
                expect(result).to.eq(a - b);
            });

            it("throws an error if subtraction result would be negative", async function () {
                const a = 1234n;
                const b = 5678n;

                await expect(safeMath.read.subUints([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("mul", function () {
            it("multiplies correctly", async function () {
                const a = 1234n;
                const b = 5678n;

                const result = await safeMath.read.mulUints([a, b]);
                expect(result).to.eq(a * b);
            });

            it("handles a zero product correctly", async function () {
                const a = 0n;
                const b = 5678n;

                const result = await safeMath.read.mulUints([a, b]);
                expect(result).to.eq(a * b);
            });

            it("throws an error on multiplication overflow", async function () {
                const a = MAX_UINT;
                const b = 2n;

                await expect(safeMath.read.mulUints([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("div", function () {
            it("divides correctly", async function () {
                const a = 5678n;
                const b = 5678n;

                const result = await safeMath.read.divUints([a, b]);
                expect(result).to.eq(a / b);
            });

            it("throws an error on zero division", async function () {
                const a = 5678n;
                const b = 0n;

                await expect(safeMath.read.divUints([a, b])).to.be.rejectedWith(DIVISION_BY_ZERO_ERROR);
            });
        });
    });

    describe("signed integers", function () {
        describe("add", function () {
            it("adds correctly if it does not overflow and the result is positve", async function () {
                const a = 1234n;
                const b = 5678n;

                const result = await safeMath.read.addInts([a, b]);
                expect(result).to.eq(a + b);
            });

            it("adds correctly if it does not overflow and the result is negative", async function () {
                const a = MAX_INT;
                const b = MIN_INT;

                const result = await safeMath.read.addInts([a, b]);
                expect(result).to.eq(a + b);
            });

            it("throws an error on positive addition overflow", async function () {
                const a = MAX_INT;
                const b = 1n;

                await expect(safeMath.read.addInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });

            it("throws an error on negative addition overflow", async function () {
                const a = MIN_INT;
                const b = -1n;

                await expect(safeMath.read.addInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("sub", function () {
            it("subtracts correctly if it does not overflow and the result is positive", async function () {
                const a = 5678n;
                const b = 1234n;

                const result = await safeMath.read.subInts([a, b]);
                expect(result).to.eq(a - b);
            });

            it("subtracts correctly if it does not overflow and the result is negative", async function () {
                const a = 1234n;
                const b = 5678n;

                const result = await safeMath.read.subInts([a, b]);
                expect(result).to.eq(a - b);
            });

            it("throws an error on positive subtraction overflow", async function () {
                const a = MAX_INT;
                const b = -1n;

                await expect(safeMath.read.subInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });

            it("throws an error on negative subtraction overflow", async function () {
                const a = MIN_INT;
                const b = 1n;

                await expect(safeMath.read.subInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("mul", function () {
            it("multiplies correctly", async function () {
                const a = 5678n;
                const b = -1234n;

                const result = await safeMath.read.mulInts([a, b]);
                expect(result).to.eq(a * b);
            });

            it("handles a zero product correctly", async function () {
                const a = 0n;
                const b = 5678n;

                const result = await safeMath.read.mulInts([a, b]);
                expect(result).to.eq(a * b);
            });

            it("throws an error on multiplication overflow, positive operands", async function () {
                const a = MAX_INT;
                const b = 2n;

                await expect(safeMath.read.mulInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });

            it("throws an error on multiplication overflow, negative operands", async function () {
                const a = MIN_INT;
                const b = -1n;

                await expect(safeMath.read.mulInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });

        describe("div", function () {
            it("divides correctly", async function () {
                const a = -5678n;
                const b = 5678n;

                const result = await safeMath.read.divInts([a, b]);
                expect(result).to.eq(a / b);
            });

            it("throws an error on zero division", async function () {
                const a = -5678n;
                const b = 0n;

                await expect(safeMath.read.divInts([a, b])).to.be.rejectedWith(DIVISION_BY_ZERO_ERROR);
            });

            it("throws an error on overflow, negative second", async function () {
                const a = MIN_INT;
                const b = -1n;

                await expect(safeMath.read.divInts([a, b])).to.be.rejectedWith(OVERFLOW_ERROR);
            });
        });
    });
});
