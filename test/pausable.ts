import {loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";

import {gameChannelFixture} from "./gameChannelFixture";

describe("Pausable", () => {
    before(async function () {
        await reset();
    });

    describe("pause", () => {
        it("Should fail if non owner calls pause", async () => {
            const {gameChannel, owner, other} = await loadFixture(gameChannelFixture);
            await gameChannel.write.activate({account: owner});
            await gameChannel.write.unpause({account: owner});
            await expect(gameChannel.write.pause({account: other})).to.be.rejectedWith("without a reason");
        });

        it("Should pause contract", async () => {
            const {gameChannel, owner} = await loadFixture(gameChannelFixture);
            await gameChannel.write.activate({account: owner});
            await gameChannel.write.unpause({account: owner});
            await gameChannel.write.pause({account: owner});
            expect(await gameChannel.read.paused()).to.equal(true);
            // expect(await gameChannel.timePaused.call()).to.eq.BN();
        });
    });

    describe("unpause", () => {
        it("Should fail if non owner calls unpause", async () => {
            const {gameChannel, owner, other} = await loadFixture(gameChannelFixture);
            await gameChannel.write.activate({account: owner});
            await expect(gameChannel.write.unpause({account: other})).to.be.rejectedWith("without a reason");
        });

        it("Should fail if non activated", async () => {
            const {gameChannel, owner} = await loadFixture(gameChannelFixture);
            await expect(gameChannel.write.unpause({account: owner})).to.be.rejectedWith("without a reason");
        });

        it("Should unpause contract", async () => {
            const {gameChannel, owner} = await loadFixture(gameChannelFixture);
            await gameChannel.write.activate({account: owner});
            await gameChannel.write.unpause({account: owner});
            expect(await gameChannel.read.paused()).to.equal(false);
            expect(await gameChannel.read.timePaused()).to.eq(0n);
        });
    });
});
