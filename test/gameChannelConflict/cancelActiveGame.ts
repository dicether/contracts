import {GameStatus, ReasonEnded} from "@dicether/state-channel";
import {loadFixture, reset} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";

import {checkActiveGamesAsync, checkGameStatusAsync, createGameFixture, phash3, shash3} from "./util";
import {CONFLICT_END_FINE, MAX_STAKE} from "../utils/config";
import {createGame, getBalance} from "../utils/util";

export const TRANSACTION_ERROR = "Transaction reverted without a reason";

describe("serverCancelActiveGame", () => {
    const gameId = 1n;
    const stake = MAX_STAKE;

    before(async function () {
        await reset();
    });

    it("Should fail if wrong gameId", async () => {
        const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);

        await expect(gameChannel.write.serverCancelActiveGame([user, 2n], {account: server})).to.be.rejectedWith(
            "inv gameId",
        );
    });

    it("Should fail if game status not active", async () => {
        const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);

        await gameChannel.write.serverCancelActiveGame([user, gameId], {account: server});

        await expect(gameChannel.write.serverCancelActiveGame([user, gameId], {account: server})).to.be.rejectedWith(
            TRANSACTION_ERROR,
        );
    });

    it("Should fail if wrong user address", async () => {
        const {gameChannel, user2, server} = await loadFixture(createGameFixture);

        await createGame(gameChannel, server, user2, shash3, phash3, stake);

        await expect(gameChannel.write.serverCancelActiveGame([user2, 1n], {account: server})).to.be.rejectedWith(
            "inv gameId",
        );
    });

    it("Should succeed if already userCancelActiveGame called by user", async () => {
        const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);

        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

        const contractBalanceBefore = await getBalance(gameChannel.address);
        const houseProfitBefore = await gameChannel.read.houseProfit();
        const houseStakeBefore = await gameChannel.read.houseStake();

        await gameChannel.write.serverCancelActiveGame([user, gameId], {account: server});

        const contractBalanceAfter = await getBalance(gameChannel.address);
        const houseProfitAfter = await gameChannel.read.houseProfit();
        const houseStakeAfter = await gameChannel.read.houseStake();

        expect(contractBalanceAfter).to.eq(contractBalanceBefore - stake + CONFLICT_END_FINE);
        expect(houseProfitAfter).to.eq(houseProfitBefore + CONFLICT_END_FINE);
        expect(houseStakeAfter).to.eq(houseStakeBefore + CONFLICT_END_FINE);

        await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.CONFLICT_ENDED);

        await checkActiveGamesAsync(gameChannel, 0n);
    });

    it("Should succeed", async () => {
        const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
        await gameChannel.write.serverCancelActiveGame([user, gameId], {account: server});

        await checkGameStatusAsync(gameChannel, gameId, GameStatus.SERVER_INITIATED_END, ReasonEnded.REGULAR_ENDED);
    });
});

describe("userCancelActiveGame", () => {
    const gameId = 1n;
    const stake = MAX_STAKE;

    it("Should fail if wrong gameId", async () => {
        const {gameChannel, user1: user} = await loadFixture(createGameFixture);
        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

        await expect(gameChannel.write.userCancelActiveGame([2n], {account: user})).to.be.rejectedWith("inv gameId");
    });

    it("Should fail if game status not active", async () => {
        const {gameChannel, user1: user} = await loadFixture(createGameFixture);
        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

        await expect(gameChannel.write.userCancelActiveGame([1n], {account: user})).to.be.rejectedWith(
            TRANSACTION_ERROR,
        );
    });

    it("Should succeed if already serverCancelActiveGame called by server", async () => {
        const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
        await gameChannel.write.serverCancelActiveGame([user, 1n], {account: server});

        const contractBalanceBefore = await getBalance(gameChannel.address);
        const houseProfitBefore = await gameChannel.read.houseProfit();
        const houseStakeBefore = await gameChannel.read.houseStake();

        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

        const contractBalanceAfter = await getBalance(gameChannel.address);
        const houseProfitAfter = await gameChannel.read.houseProfit();
        const houseStakeAfter = await gameChannel.read.houseStake();

        expect(contractBalanceAfter).to.eq(contractBalanceBefore - stake + CONFLICT_END_FINE);
        expect(houseProfitAfter).to.eq(houseProfitBefore + CONFLICT_END_FINE);
        expect(houseStakeAfter).to.eq(houseStakeBefore + CONFLICT_END_FINE);

        await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.CONFLICT_ENDED);

        await checkActiveGamesAsync(gameChannel, 0n);
    });

    it("Should succeed", async () => {
        const {gameChannel, user1: user} = await loadFixture(createGameFixture);
        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

        await checkGameStatusAsync(gameChannel, gameId, GameStatus.USER_INITIATED_END, ReasonEnded.REGULAR_ENDED);
        await checkActiveGamesAsync(gameChannel, 1n);
    });
});
