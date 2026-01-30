import {
    GameStatus,
    ReasonEnded,
    fromWeiToGwei,
    fromGweiToWei,
    calcMaxUserProfit,
    calcNewBalance,
} from "@dicether/state-channel";
import {reset, time} from "@nomicfoundation/hardhat-network-helpers";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers/dist/src/loadFixture";
import {expect} from "chai";

import {ValidGameTypes} from "./GameTypes";
import {
    BET_VALUE,
    checkActiveGamesAsync,
    checkGameStatusAsync,
    createGameFixture,
    phash1,
    phash2,
    shash1,
    shash2,
} from "./util";
import {MAX_STAKE, NOT_ENDED_FINE, USER_TIMEOUT, SERVER_TIMEOUT, MAX_BALANCE} from "../utils/config";
import {signData} from "../utils/signUtil";
import {getBalance, maxBigInt} from "../utils/util";

describe("GameChannelConflict-ForceEnd", () => {
    before(async function () {
        await reset();
    });

    describe("serverForceGameEnd", () => {
        const stake = MAX_STAKE;

        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80n,
            value: BET_VALUE / 2n,
            balance: MAX_BALANCE,
            serverHash: shash2,
            userHash: phash2,
            gameId: 1n,
            serverSeed: shash1,
            userSeed: phash1,
        };

        it("Should fail if time span too low", async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
                defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            const userSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                user,
            );

            await gameChannel.write.serverEndGameConflict(
                [
                    roundId,
                    gameType,
                    num,
                    value,
                    balance,
                    serverHash,
                    userHash,
                    gameId,
                    userSig,
                    user,
                    serverSeed,
                    userSeed,
                ],
                {account: server},
            );

            await expect(gameChannel.write.serverForceGameEnd([user, gameId], {account: server})).to.be.rejectedWith(
                "too low timeout",
            );
        });

        it("Should fail if wrong sender", async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
                defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            const userSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                user,
            );

            await gameChannel.write.serverEndGameConflict(
                [
                    roundId,
                    gameType,
                    num,
                    value,
                    balance,
                    serverHash,
                    userHash,
                    gameId,
                    userSig,
                    user,
                    serverSeed,
                    userSeed,
                ],
                {account: server},
            );

            await expect(gameChannel.write.serverForceGameEnd([user, gameId], {account: user})).to.be.rejectedWith(
                "without a reason",
            );
        });

        it("Should fail if game still active", async () => {
            const {gameId} = defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            await expect(gameChannel.write.serverForceGameEnd([user, gameId], {account: server})).to.be.rejectedWith(
                "inv status",
            );
        });

        it("Should fail if user init end game!", async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, gameType, num} = defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            const serverSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                server,
            );

            await gameChannel.write.userEndGameConflict(
                [roundId, gameType, num, value, balance, serverHash, userHash, gameId, serverSig, userSeed],
                {account: user},
            );

            await time.increase(Math.max(SERVER_TIMEOUT, USER_TIMEOUT));

            await expect(gameChannel.write.serverForceGameEnd([user, gameId], {account: server})).to.be.rejectedWith(
                "inv status",
            );
        });

        it("Force end should succeed", async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
                defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            const userSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                user,
            );

            await gameChannel.write.serverEndGameConflict(
                [
                    roundId,
                    gameType,
                    num,
                    value,
                    balance,
                    serverHash,
                    userHash,
                    gameId,
                    userSig,
                    user,
                    serverSeed,
                    userSeed,
                ],
                {account: server},
            );

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.read.houseProfit();
            const houseStakeBefore = await gameChannel.read.houseStake();

            await time.increase(SERVER_TIMEOUT);
            await gameChannel.write.serverForceGameEnd([user, gameId], {account: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter = await gameChannel.read.houseProfit();
            const houseStakeAfter = await gameChannel.read.houseStake();

            // check new balances (profit, stake, contract balance)
            const regularNewBalance = BigInt(
                fromGweiToWei(
                    calcNewBalance(
                        gameType,
                        Number(num),
                        fromWeiToGwei(value),
                        serverSeed,
                        userSeed,
                        fromWeiToGwei(balance),
                    ),
                ),
            );
            const newBalance = maxBigInt(regularNewBalance - NOT_ENDED_FINE, -stake);
            const payout = stake + newBalance;

            expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
            expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
            expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.SERVER_FORCED_END);

            await checkActiveGamesAsync(gameChannel, 0n);
        });

        it("Force end should succeed after cancelActiveGame", async () => {
            const {gameId} = defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);

            await gameChannel.write.serverCancelActiveGame([user, gameId], {account: server});

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.read.houseProfit();
            const houseStakeBefore = await gameChannel.read.houseStake();

            await time.increase(SERVER_TIMEOUT);
            await gameChannel.write.serverForceGameEnd([user, gameId], {account: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter = await gameChannel.read.houseProfit();
            const houseStakeAfter = await gameChannel.read.houseStake();

            // check new balances (profit, stake, contract balance)
            const newBalance = maxBigInt(-NOT_ENDED_FINE, -stake);
            const payout = stake + newBalance;

            expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
            expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
            expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.SERVER_FORCED_END);

            await checkActiveGamesAsync(gameChannel, 0n);
        });

        // TODO: Add wrong game id check
    });

    describe("userForceGameEnd", () => {
        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80n,
            value: BET_VALUE,
            balance: MAX_BALANCE / 2n,
            serverHash: shash2,
            userHash: phash2,
            gameId: 1n,
            serverSeed: shash1,
            userSeed: phash1,
        };

        it("Should fail if time span too low", async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, gameType, num} = defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);

            const serverSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                server,
            );

            await gameChannel.write.userEndGameConflict(
                [roundId, gameType, num, value, balance, serverHash, userHash, gameId, serverSig, userSeed],
                {account: user},
            );

            await expect(gameChannel.write.userForceGameEnd([gameId], {account: user})).to.be.rejectedWith(
                "too low timeout",
            );
        });

        it("Should fail if game still active", async () => {
            const {gameId} = defaultData;
            const {gameChannel, user1: user} = await loadFixture(createGameFixture);
            await expect(gameChannel.write.userForceGameEnd([gameId], {account: user})).to.be.rejectedWith(
                "inv status",
            );
        });

        it("Should fail if server init end game!", async () => {
            const {roundId, value, balance, serverHash, userHash, serverSeed, gameId, userSeed, gameType, num} =
                defaultData;
            const {gameChannel, user1: user, server} = await loadFixture(createGameFixture);
            const userSig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                user,
            );

            await gameChannel.write.serverEndGameConflict(
                [
                    roundId,
                    gameType,
                    num,
                    value,
                    balance,
                    serverHash,
                    userHash,
                    gameId,
                    userSig,
                    user,
                    serverSeed,
                    userSeed,
                ],
                {account: server},
            );

            await time.increase(Math.max(SERVER_TIMEOUT, USER_TIMEOUT));

            await expect(gameChannel.write.userForceGameEnd([gameId], {account: user})).to.be.rejectedWith(
                "inv status",
            );
        });

        it("should succeed after cancelActiveGame", async () => {
            const {gameId} = defaultData;
            const {gameChannel, user1: user, stake} = await loadFixture(createGameFixture);
            await gameChannel.write.userCancelActiveGame([gameId], {account: user});

            await time.increase(USER_TIMEOUT);

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.read.houseProfit();
            const houseStakeBefore = await gameChannel.read.houseStake();

            await gameChannel.write.userForceGameEnd([gameId], {account: user});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter = await gameChannel.read.houseProfit();
            const houseStakeAfter = await gameChannel.read.houseStake();

            // check new balances (profit, stake, contract balance)
            const newBalance = NOT_ENDED_FINE;
            const payout = stake + newBalance;

            expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
            expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
            expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.USER_FORCED_END);

            await checkActiveGamesAsync(gameChannel, 0n);
        });

        ValidGameTypes.forEach(({gameType, num}) => {
            it(`Should succeed with gameType ${gameType} with num ${num}!`, async () => {
                const {roundId, value, balance, serverHash, userHash, gameId, userSeed} = defaultData;
                const {gameChannel, user1: user, server, stake} = await loadFixture(createGameFixture);
                const serverSig = await signData(
                    roundId,
                    gameType,
                    Number(num),
                    value,
                    balance,
                    serverHash,
                    userHash,
                    Number(gameId),
                    gameChannel.address,
                    server,
                );

                await gameChannel.write.userEndGameConflict(
                    [roundId, gameType, num, value, balance, serverHash, userHash, gameId, serverSig, userSeed],
                    {account: user},
                );

                await time.increase(USER_TIMEOUT);

                const contractBalanceBefore = await getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.read.houseProfit();
                const houseStakeBefore = await gameChannel.read.houseStake();

                await gameChannel.write.userForceGameEnd([gameId], {account: user});

                const contractBalanceAfter = await getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.read.houseProfit();
                const houseStakeAfter = await gameChannel.read.houseStake();

                // check new balances (profit, stake, contract balance)
                const newBalance = maxBigInt(
                    balance +
                        BigInt(fromGweiToWei(calcMaxUserProfit(gameType, Number(num), fromWeiToGwei(value)))) +
                        NOT_ENDED_FINE,
                    -stake,
                );
                const payout = stake + newBalance;

                expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
                expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
                expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

                await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.USER_FORCED_END);

                await checkActiveGamesAsync(gameChannel, 0n);
            });
        });
    });
});
