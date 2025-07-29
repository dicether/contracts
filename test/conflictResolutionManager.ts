import {loadFixture, reset, time} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import hre from "hardhat";
import {getAddress} from "viem";

import {gameChannelFixture} from "./gameChannelFixture";

const ConflictResUpdateMinTimeout = 3 * 24 * 60 * 60;
const ConflictResUpdateMaxTimeout = 6 * 24 * 60 * 60;

describe("ConflictResolutionManager", () => {
    before(async function () {
        await reset();
    });

    async function conflicResolutionFicture() {
        const res = await gameChannelFixture();
        const accounts = await hre.viem.getWalletClients();
        const notOwner = accounts[3].account.address;
        const newConflictResolutionContractAddress = getAddress(accounts[4].account.address);
        return {...res, notOwner, newConflictResolutionContractAddress};
    }

    describe("update ConflictResolution", () => {
        it("Should fail if non owner updates conflict resolution contract", async () => {
            const {gameChannel, newConflictResolutionContractAddress, notOwner} =
                await loadFixture(conflicResolutionFicture);
            await expect(
                gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: notOwner}),
            ).to.be.rejectedWith("without a reason");
        });

        it("New conflict resolution address should be settable by owner", async () => {
            const {gameChannel, newConflictResolutionContractAddress, owner} =
                await loadFixture(conflicResolutionFicture);
            await gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: owner});
            expect(await gameChannel.read.newConflictRes()).to.equal(newConflictResolutionContractAddress);
        });
    });

    describe("activate ConflictResolution", () => {
        it("Should fail if owner activates before min timeout", async () => {
            const {gameChannel, newConflictResolutionContractAddress, owner} =
                await loadFixture(conflicResolutionFicture);
            await gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: owner});
            await expect(gameChannel.write.activateConflictResolution({account: owner})).to.be.rejectedWith(
                "without a reason",
            );
        });

        it("Should fail if non owner activates after min timeout", async () => {
            const {gameChannel, newConflictResolutionContractAddress, owner, notOwner} =
                await loadFixture(conflicResolutionFicture);
            await gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: owner});
            await time.increase(ConflictResUpdateMinTimeout);

            await expect(gameChannel.write.activateConflictResolution({account: notOwner})).to.be.rejectedWith(
                "without a reason",
            );
        });

        it("Should fail if owner activates after max timeout", async () => {
            const {gameChannel, newConflictResolutionContractAddress, owner} =
                await loadFixture(conflicResolutionFicture);
            await gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: owner});
            await time.increase(ConflictResUpdateMaxTimeout + 1);
            await expect(gameChannel.write.activateConflictResolution({account: owner})).to.be.rejectedWith(
                "without a reason",
            );
        });

        it("New conflict resolution address can be activated by owner", async () => {
            const {gameChannel, newConflictResolutionContractAddress, owner} =
                await loadFixture(conflicResolutionFicture);
            await gameChannel.write.updateConflictResolution([newConflictResolutionContractAddress], {account: owner});
            await time.increase(ConflictResUpdateMinTimeout + 1);
            await gameChannel.write.activateConflictResolution({account: owner});
            expect(await gameChannel.read.conflictRes()).to.equal(newConflictResolutionContractAddress);
        });
    });
});
