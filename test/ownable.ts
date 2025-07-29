import {loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";

import {gameChannelFixture} from "./gameChannelFixture";
import {ZERO_ADDRESS} from "./utils/util";

describe("Ownable", () => {
    before(async function () {
        await reset();
    });

    it("Initial owner should be set", async () => {
        const {gameChannel, owner} = await loadFixture(gameChannelFixture);
        expect(await gameChannel.read.owner()).to.equal(owner);
    });

    it("Initial pending owner should be set to 0 ", async () => {
        const {gameChannel} = await loadFixture(gameChannelFixture);
        expect(await gameChannel.read.pendingOwner()).to.equal(ZERO_ADDRESS);
    });

    it("Should fail if non owner sets other new pending owner", async () => {
        const {gameChannel, other, other2} = await loadFixture(gameChannelFixture);
        await expect(gameChannel.write.transferOwnership([other2], {account: other})).to.be.rejectedWith(
            "reverted without a reason",
        );
    });

    it("Should fail if non owner sets self as new pending owner", async () => {
        const {gameChannel, other} = await loadFixture(gameChannelFixture);
        await expect(gameChannel.write.transferOwnership([other], {account: other})).to.be.rejectedWith(
            "reverted without a reason",
        );
    });

    it("New pending owner should be settable by owner", async () => {
        const {gameChannel, owner, other} = await loadFixture(gameChannelFixture);
        await gameChannel.write.transferOwnership([other], {account: owner});
        expect(await gameChannel.read.pendingOwner()).to.equal(other);
        await gameChannel.write.transferOwnership([other], {account: owner});
        expect(await gameChannel.read.pendingOwner()).to.equal(other);
    });

    it("Non pending owner should not be able to claim ownership", async () => {
        const {gameChannel, owner, other, other2} = await loadFixture(gameChannelFixture);
        await gameChannel.write.transferOwnership([other], {account: owner});
        await expect(gameChannel.write.claimOwnership({account: other2})).to.be.rejectedWith(
            "reverted without a reason",
        );
    });

    it("Pending owner should be able to claim ownership", async () => {
        const {gameChannel, owner, other} = await loadFixture(gameChannelFixture);
        await gameChannel.write.transferOwnership([other], {account: owner});
        await gameChannel.write.claimOwnership({account: other});
        expect(await gameChannel.read.owner()).to.equal(other);
        expect(await gameChannel.read.pendingOwner()).to.equal(ZERO_ADDRESS);
    });
});
