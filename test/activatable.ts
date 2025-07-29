import {loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";

import {gameChannelFixture} from "./gameChannelFixture";

describe("Activatable", () => {
    before(async function () {
        await reset();
    });

    it("Should initial not be activated", async () => {
        const {gameChannel} = await loadFixture(gameChannelFixture);
        expect(await gameChannel.read.activated()).to.equal(false);
    });

    it("Should fail if non owner calls activate", async () => {
        const {gameChannel, other} = await loadFixture(gameChannelFixture);
        await expect(gameChannel.write.activate({account: other})).to.be.rejectedWith("reverted without a reason");
    });

    it("Should succeed", async () => {
        const {gameChannel, owner} = await loadFixture(gameChannelFixture);
        await gameChannel.write.activate({account: owner});
        expect(await gameChannel.read.activated()).to.equal(true);
    });
});
