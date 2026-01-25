import {time, loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";

import {gameChannelFixture} from "./gameChannelFixture";
import {getBalance, getTransactionCost} from "./utils/util";

const DestroyTimeout = 20 * 24 * 60 * 60;

export const TRANSACTION_ERROR = "Transaction reverted without a reason";

describe("destroy", () => {
    before(async function () {
        await reset();
    });

    it("Should fail if owner calls not paused", async () => {
        const {gameChannel, owner} = await loadFixture(gameChannelFixture);

        await gameChannel.write.activate({account: owner});
        await gameChannel.write.unpause({account: owner});
        await expect(gameChannel.write.destroy({account: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it("Should fail if owner calls paused with wrong timeout", async () => {
        const {gameChannel, owner} = await loadFixture(gameChannelFixture);

        await gameChannel.write.activate({account: owner});
        await gameChannel.write.unpause({account: owner});
        await gameChannel.write.pause({account: owner});
        await expect(gameChannel.write.destroy({account: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it("Should fail if non owner calls with correct timeout", async () => {
        const {gameChannel, owner, other} = await loadFixture(gameChannelFixture);

        await gameChannel.write.activate({account: owner});
        await gameChannel.write.unpause({account: owner});
        await gameChannel.write.pause({account: owner});
        await time.increase(DestroyTimeout);
        await expect(gameChannel.write.destroy({account: other})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it("Should succeed if owner call with correct timeout", async () => {
        const {gameChannel, owner} = await loadFixture(gameChannelFixture);

        await gameChannel.write.activate({account: owner});
        await gameChannel.write.unpause({account: owner});
        await gameChannel.write.pause({account: owner});
        await time.increase(DestroyTimeout);

        const contractBalance = await getBalance(gameChannel.address);
        const oldBalance = await getBalance(owner);

        const res = await gameChannel.write.destroy({account: owner});

        const newBalance = await getBalance(owner);
        const transactionCost = await getTransactionCost(res);

        expect(newBalance).to.eq(oldBalance + contractBalance - transactionCost);
    });
});
