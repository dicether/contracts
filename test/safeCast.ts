import {expect} from "chai";
import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";

describe("SafeCast", () => {
    const MAX_INT = 2n ** 255n - 1n;

    let safeCast: ContractTypesMap["SafeCastMock"];

    before(async function () {
        await hre.network.provider.send("hardhat_reset");
        safeCast = await hre.viem.deployContract("SafeCastMock");
    });

    describe("castToInt", function () {
        it("casts correctly", async function () {
            const a = 5678n;

            const result = await safeCast.read.castToInt([a]);
            expect(result).to.eq(a);
        });

        it("throws an error if to large", async function () {
            const a = MAX_INT + 1n;

            await expect(safeCast.read.castToInt([a])).to.be.rejectedWith("Assertion error");
        });
    });

    describe("castToUint", function () {
        it("casts correctly", async function () {
            const a = 5678n;

            const result = await safeCast.read.castToUint([a]);
            expect(result).to.eq(a);
        });

        it("throws an error if negative", async function () {
            const a = -1n;

            await expect(safeCast.read.castToUint([a])).to.be.rejectedWith("Assertion error");
        });
    });
});
