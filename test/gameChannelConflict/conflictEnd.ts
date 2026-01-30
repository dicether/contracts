import {calcNewBalance, GameStatus, GameType, ReasonEnded, fromWeiToGwei, fromGweiToWei} from "@dicether/state-channel";
import {loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";
import {ContractTypesMap} from "hardhat/types";
import {Address, Hex} from "viem";

import {InvalidGameTypes, ValidGameTypes} from "./GameTypes";
import {
    BET_VALUE,
    checkGameStateAsync,
    checkGameStatusAsync,
    createGameFixture,
    CreateGameFixtureReturn,
    phash1,
    phash2,
    phash3,
    shash1,
    shash2,
    shash3,
    ZERO_SEED,
} from "./util";
import {CONFLICT_END_FINE, MAX_BALANCE} from "../utils/config";
import {signData} from "../utils/signUtil";
import {createGame, getBalance, maxBigInt} from "../utils/util";

export const TRANSACTION_ERROR = "Transaction reverted without a reason";

describe("serverEndConflict", () => {
    before(async function () {
        await reset();
    });

    interface DefaultData {
        roundId: number;
        gameType: number;
        num: bigint;
        value: bigint;
        balance: bigint;
        serverHash: Hex;
        userHash: Hex;
        gameId: number;
        contractAddress: Address;
        userAddress: Address;
        serverSeed: Hex;
        userSeed: Hex;
        signer: Address;
        from: Address;
    }

    const serverEndConfigFailTest = async (
        error: string,
        gameChannel: ContractTypesMap["GameChannel"],
        d: DefaultData,
    ) => {
        const {
            roundId,
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            userSeed,
            serverSeed,
            userAddress,
            gameType,
            contractAddress,
            num,
            signer,
            from,
        } = d;
        const userSig = await signData(
            roundId,
            gameType,
            Number(num),
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            contractAddress,
            signer,
        );

        await expect(
            gameChannel.write.serverEndGameConflict(
                [
                    roundId,
                    gameType,
                    BigInt(num),
                    value,
                    balance,
                    serverHash,
                    userHash,
                    BigInt(gameId),
                    userSig,
                    userAddress,
                    serverSeed,
                    userSeed,
                ],
                {account: from},
            ),
        ).to.be.rejectedWith(error);
    };

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

    async function testHelper(
        error: string,
        dataGen: (
            testData: DefaultData,
            gameFixtureData: CreateGameFixtureReturn,
        ) => Promise<DefaultData> | DefaultData,
    ) {
        const gameFixtureData = await loadFixture(createGameFixture);
        const {user1: user, server, gameChannel} = gameFixtureData;

        const defaultData: DefaultData = {
            roundId: 10,
            gameType: 1,
            num: 80n,
            value: BET_VALUE,
            balance: MAX_BALANCE / 2n,
            serverHash: shash2,
            userHash: phash2,
            gameId: 1,
            contractAddress: gameChannel.address,
            userAddress: user,
            serverSeed: shash1,
            userSeed: phash1,
            signer: user,
            from: server,
        };

        return await serverEndConfigFailTest(error, gameChannel, await dataGen(defaultData, gameFixtureData));
    }

    it("Should fail not server", async () => {
        return testHelper("without a reason", (defaultData, {user2}) => ({...defaultData, from: user2}));
    });

    it("Should fail wrong round Id", async () => {
        return testHelper("inv roundId", (defaultData, _) => ({...defaultData, roundId: 0}));
    });

    it("Should fail wrong sig", async () => {
        return testHelper("inv sig", (defaultData, {user2}) => ({...defaultData, signer: user2}));
    });

    it("Should fail wrong user seed", async () => {
        return testHelper("inv userSeed", (defaultData, _) => ({...defaultData, userSeed: shash2}));
    });

    it("Should fail wrong game type", async () => {
        return testHelper("Invalid game type", (defaultData, _) => ({...defaultData, gameType: 0}));
    });

    it("Should fail too low balance", async () => {
        return testHelper("inv balance", (defaultData, {stake}) => ({...defaultData, balance: -stake - BigInt(1e9)}));
    });

    it("Should fail too high balance", async () => {
        return testHelper("inv balance", (defaultData, _) => ({...defaultData, balance: MAX_BALANCE + BigInt(1e9)}));
    });

    it("Should fail wrong contract address", async () => {
        return testHelper("inv sig", (defaultData, {other}) => ({...defaultData, contractAddress: other}));
    });

    it("Should fail with too low number game type 1", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({...defaultData, gameType: 1, num: 0n}));
    });

    it("Should fail with too high number game type 1", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({
            ...defaultData,
            gameType: 1,
            num: 99n,
        }));
    });

    it("Should fail with too too low number game type 2", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({
            ...defaultData,
            gameType: 2,
            num: 0n,
        }));
    });

    it("too high number game type 2", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({...defaultData, gameType: 2, num: 99n}));
    });

    it("Should fail with too too low number game type 3", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({...defaultData, gameType: 3, num: 0n}));
    });

    it("Should fail with too high number game type 3", async () => {
        return testHelper("Invalid num", (defaultData, _) => ({
            ...defaultData,
            gameType: 3,
            num: BigInt(Math.pow(2, 12) - 1),
        }));
    });

    it("Should fail with wrong user address", async () => {
        return testHelper("inv sig", async (defaultData, gameFixtureData) => {
            const {gameChannel, server, user2, stake} = gameFixtureData;
            await createGame(gameChannel, server, user2, shash3, phash3, stake);
            return {...defaultData, userAddress: user2};
        });
    });

    it("Should fail with wrong game id", async () => {
        return testHelper("inv gameId", async (defaultData, gameFixtureData) => {
            const {gameChannel, server, user2, stake} = gameFixtureData;
            await createGame(gameChannel, server, user2, shash3, phash3, stake);
            return {...defaultData, gameId: 2};
        });
    });

    it("Should succeed", async () => {
        const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
            defaultData;
        const {gameChannel, server, user1: user} = await loadFixture(createGameFixture);

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
            [roundId, gameType, num, value, balance, serverHash, userHash, gameId, userSig, user, serverSeed, userSeed],
            {account: server},
        );

        await checkGameStateAsync(
            gameChannel,
            gameId,
            GameStatus.SERVER_INITIATED_END,
            ReasonEnded.REGULAR_ENDED,
            GameType.DICE_LOWER,
            roundId,
            num,
            value,
            balance,
            userSeed,
            serverSeed,
        );
    });

    it("Should succeed after user called cancelActiveGame!", async () => {
        const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
            defaultData;
        const {gameChannel, server, user1: user} = await loadFixture(createGameFixture);

        await gameChannel.write.userCancelActiveGame([gameId], {account: user});

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
            [roundId, gameType, num, value, balance, serverHash, userHash, gameId, userSig, user, serverSeed, userSeed],
            {account: server},
        );

        await checkGameStateAsync(
            gameChannel,
            gameId,
            GameStatus.SERVER_INITIATED_END,
            ReasonEnded.REGULAR_ENDED,
            GameType.DICE_LOWER,
            roundId,
            num,
            value,
            balance,
            userSeed,
            serverSeed,
        );
    });

    it("Should succeed after user called conflict game with lower roundId!", async () => {
        const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
            defaultData;
        const {gameChannel, server, user1: user} = await loadFixture(createGameFixture);

        const serverSig = await signData(
            roundId - 1,
            gameType,
            Number(num),
            value,
            balance,
            shash3,
            phash3,
            Number(gameId),
            gameChannel.address,
            server,
        );

        await gameChannel.write.userEndGameConflict(
            [roundId - 1, gameType, num, value, balance, shash3, phash3, gameId, serverSig, phash2],
            {account: user},
        );

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
            [roundId, gameType, num, value, balance, serverHash, userHash, gameId, userSig, user, serverSeed, userSeed],
            {account: server},
        );

        await checkGameStateAsync(
            gameChannel,
            gameId,
            GameStatus.SERVER_INITIATED_END,
            ReasonEnded.REGULAR_ENDED,
            GameType.DICE_LOWER,
            roundId,
            num,
            value,
            balance,
            userSeed,
            serverSeed,
        );
    });

    ValidGameTypes.forEach(({gameType, num}) => {
        it(`Should succeed after user called conflict game with gameType ${gameType} with num ${num}`, async () => {
            const {roundId, value, balance, serverHash, userHash, gameId, userSeed, serverSeed, gameType, num} =
                defaultData;
            const {gameChannel, server, user1: user, stake} = await loadFixture(createGameFixture);

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

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.read.houseProfit();
            const houseStakeBefore = await gameChannel.read.houseStake();

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

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter = await gameChannel.read.houseProfit();
            const houseStakeAfter = await gameChannel.read.houseStake();

            // check new balances (profit, stake, contract balance)
            const newBalance = maxBigInt(
                BigInt(
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
                ) - CONFLICT_END_FINE,
                -stake,
            );

            const payout = stake + newBalance;

            expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
            expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
            expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);
        });
    });
});

describe("userEndConflict", () => {
    interface DefaultData {
        roundId: number;
        gameType: number;
        num: bigint;
        value: bigint;
        balance: bigint;
        serverHash: Hex;
        userHash: Hex;
        gameId: number;
        contractAddress: Address;
        userAddress: Address;
        serverSeed: Hex;
        userSeed: Hex;
        signer: Address;
        from: Address;
    }

    const userEndConfigFailTest = async (
        error: string,
        gameChannel: ContractTypesMap["GameChannel"],
        d: DefaultData,
    ) => {
        const {
            roundId,
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            userSeed,
            gameType,
            contractAddress,
            num,
            signer,
            from,
        } = d;
        const serverSig = await signData(
            roundId,
            gameType,
            Number(num),
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            contractAddress,
            signer,
        );

        await expect(
            gameChannel.write.userEndGameConflict(
                [
                    roundId,
                    gameType,
                    BigInt(num),
                    value,
                    balance,
                    serverHash,
                    userHash,
                    BigInt(gameId),
                    serverSig,
                    userSeed,
                ],
                {account: from},
            ),
        ).to.be.rejectedWith(error);
    };

    async function testHelper(
        error: string,
        dataGen: (
            testData: DefaultData,
            gameFixtureData: CreateGameFixtureReturn,
        ) => Promise<DefaultData> | DefaultData,
    ) {
        const gameFixtureData = await loadFixture(createGameFixture);
        const {user1: user, server, gameChannel} = gameFixtureData;

        const defaultData: DefaultData = {
            roundId: 10,
            gameType: 1,
            num: 80n,
            value: BET_VALUE,
            balance: MAX_BALANCE / 2n,
            serverHash: shash2,
            userHash: phash2,
            gameId: 1,
            contractAddress: gameChannel.address,
            userAddress: user,
            serverSeed: shash1,
            userSeed: phash1,
            signer: server,
            from: user,
        };

        return await userEndConfigFailTest(error, gameChannel, await dataGen(defaultData, gameFixtureData));
    }

    it("Should fail wrong round Id", async () => {
        return testHelper("inv roundId", (defaultData, _) => ({...defaultData, roundId: 0}));
    });

    it("Should fail wrong sig", async () => {
        return testHelper("inv sig", (defaultData, {user2}) => ({...defaultData, signer: user2}));
    });

    it("Should fail wrong user seed", async () => {
        return testHelper("inv userSeed", (defaultData, _) => ({...defaultData, userSeed: phash2}));
    });

    it("Should fail wrong game type", async () => {
        //@todo: change to inv gameType
        return testHelper("Invalid game type", (defaultData, _) => ({...defaultData, gameType: 0}));
    });

    it("Should fail too low balance", async () => {
        return testHelper("inv balance", (defaultData, {stake}) => ({...defaultData, balance: -stake - BigInt(1e9)}));
    });

    it("Should fail too high balance", async () => {
        return testHelper("inv balance", (defaultData, _) => ({...defaultData, balance: MAX_BALANCE + BigInt(1e9)}));
    });

    it("Should fail wrong contract address", async () => {
        return testHelper("inv sig", (defaultData, {other}) => ({...defaultData, contractAddress: other}));
    });

    it("Should fail with wrong user address", async () => {
        return testHelper("inv gameId", async (defaultData, gameFixtureData) => {
            const {gameChannel, server, user2, stake} = gameFixtureData;
            await createGame(gameChannel, server, user2, shash3, phash3, stake);
            return {...defaultData, from: user2};
        });
    });

    it("Should fail with wrong game id", async () => {
        return testHelper("inv gameId", async (defaultData, gameFixtureData) => {
            const {gameChannel, server, user2, stake} = gameFixtureData;
            await createGame(gameChannel, server, user2, shash3, phash3, stake);
            return {...defaultData, gameId: 2};
        });
    });

    InvalidGameTypes.forEach(({gameType, num}) => {
        it(`Should fail with gameType ${gameType} with num ${num}`, async () =>
            testHelper(
                "Invalid num", //@todo: change to inv num
                (defaultData, _) => ({...defaultData, gameType, num}),
            ));
    });

    const defaultData = {
        roundId: 10,
        gameType: 1,
        num: 80n,
        value: BET_VALUE,
        balance: MAX_BALANCE / 2n,
        serverHash: shash2,
        userHash: phash2,
        gameId: 1n,
        userSeed: phash1,
        serverSeed: shash1,
    };

    it("Should succeed after server called cancelActiveGame!", async () => {
        const {roundId, value, balance, serverHash, userHash, gameId, userSeed, gameType, num} = defaultData;
        const {gameChannel, server, user1: user} = await loadFixture(createGameFixture);

        await gameChannel.write.serverCancelActiveGame([user, gameId], {account: server});

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

        await checkGameStateAsync(
            gameChannel,
            gameId,
            GameStatus.USER_INITIATED_END,
            ReasonEnded.REGULAR_ENDED,
            GameType.DICE_LOWER,
            roundId,
            num,
            value,
            balance,
            userSeed,
            ZERO_SEED,
        );
    });

    it("Should succeed after server called conflict game with lower roundId!", async () => {
        const {roundId, value, balance, serverHash, userHash, gameId, userSeed, gameType, num} = defaultData;
        const {gameChannel, server, user1: user} = await loadFixture(createGameFixture);

        const userSig = await signData(
            roundId - 1,
            gameType,
            Number(num),
            value,
            balance,
            shash3,
            phash3,
            Number(gameId),
            gameChannel.address,
            user,
        );

        await gameChannel.write.serverEndGameConflict(
            [roundId - 1, gameType, num, value, balance, shash3, phash3, gameId, userSig, user, shash2, phash2],
            {account: server},
        );

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

        await checkGameStateAsync(
            gameChannel,
            gameId,
            GameStatus.USER_INITIATED_END,
            ReasonEnded.REGULAR_ENDED,
            GameType.DICE_LOWER,
            roundId,
            num,
            value,
            balance,
            userSeed,
            ZERO_SEED,
        );
    });

    ValidGameTypes.forEach(({gameType, num}) => {
        it(`Should succeed after user called conflict game with same roundId with gameType ${gameType} with num ${num}!`, async () => {
            const {gameChannel, server, user1: user, stake} = await loadFixture(createGameFixture);
            const {roundId, value, balance, serverHash, userHash, gameId, serverSeed, userSeed} = defaultData;

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

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.read.houseProfit();
            const houseStakeBefore = await gameChannel.read.houseStake();

            await gameChannel.write.userEndGameConflict(
                [roundId, gameType, num, value, balance, serverHash, userHash, gameId, serverSig, userSeed],
                {account: user},
            );

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter = await gameChannel.read.houseProfit();
            const houseStakeAfter = await gameChannel.read.houseStake();

            // check new balances (profit, stake, contract balance)
            const newBalance = maxBigInt(
                BigInt(
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
                ) - CONFLICT_END_FINE,
                -stake,
            );
            const payout = stake + newBalance;

            expect(contractBalanceAfter).to.eq(contractBalanceBefore - payout);
            expect(houseProfitAfter).to.eq(houseProfitBefore - newBalance);
            expect(houseStakeAfter).to.eq(houseStakeBefore - newBalance);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);
        });
    });
});
