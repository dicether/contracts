import {loadFixture, reset} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import {expect} from "chai";
import {Address, Hex} from "viem";

import {createGameFixture, CreateGameFixtureReturn, phash2, shash2} from "./gameChannelConflict/util";
import {enableGameChannelFixture} from "./gameChannelFixture";
import {INITIAL_HOUSE_STAKE, MAX_BALANCE, MAX_STAKE, MIN_STAKE} from "./utils/config";
import {signData, signStartData} from "./utils/signUtil";
import {createGame, getBalance} from "./utils/util";

// configureChai();
// const expect = chai.expect;

// const withData = leche.withData;

const hash = "0x0000000000000000000000000000000000000000000000000000000000000001"; // dummy hash

describe("GameChannel", () => {
    before(async () => {
        await reset();
    });

    describe("createGame", () => {
        it("Should fail if house stake too low", async () => {
            const {gameChannel, owner, server, other: user} = await loadFixture(enableGameChannelFixture);
            await gameChannel.write.withdrawHouseStake([INITIAL_HOUSE_STAKE], {account: owner});

            await expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith(
                "inv houseStake",
            );
        });

        it("Should fail if value too low", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            await expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE - 1n)).to.be.rejectedWith(
                "inv stake",
            );
        });

        it("Should fail if value too high", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            await expect(createGame(gameChannel, server, user, hash, hash, MAX_STAKE + 1n)).to.be.rejectedWith(
                "inv stake",
            );
        });

        it("Should fail if game paused", async () => {
            const {gameChannel, owner, server, other: user} = await loadFixture(enableGameChannelFixture);
            await gameChannel.write.pause({account: owner});
            await expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith("paused");
        });

        it("Should fail if game not ended", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            await createGame(gameChannel, server, user, hash, hash, MIN_STAKE);
            await expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith(
                "prev game not ended",
            );
        });

        it("Should fail if invalid signature", async () => {
            const {gameChannel, other: user} = await loadFixture(enableGameChannelFixture);
            const createBefore = BigInt(Math.round(Date.now() / 1000) + 5 * 60);
            const sig = await signStartData(gameChannel.address, user, 0n, createBefore, hash, user);

            await expect(
                gameChannel.write.createGame([hash, 0n, createBefore, hash, sig], {account: user, value: MIN_STAKE}),
            ).to.be.rejectedWith("inv sig");
        });

        it("Should fail if invalid create time", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            const createBefore = BigInt(Math.round(Date.now() / 1000));
            const sig = await signStartData(gameChannel.address, server, 0n, createBefore, hash, server);

            await expect(
                gameChannel.write.createGame([hash, 0n, createBefore, hash, sig], {account: user, value: MIN_STAKE}),
            ).to.be.rejectedWith("expired");
        });

        it("Should fail if invalid game id", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            const createBefore = BigInt(Math.round(Date.now() / 1000));
            const sig = await signStartData(gameChannel.address, server, 1n, createBefore, hash, server);

            await expect(
                gameChannel.write.createGame([hash, 1n, createBefore, hash, sig], {account: user, value: MIN_STAKE}),
            ).to.be.rejectedWith("inv gamePrevGameId");
        });

        it("Create game should succeed", async () => {
            const {gameChannel, server, other: user} = await loadFixture(enableGameChannelFixture);
            const contractBalanceBefore = await getBalance(gameChannel.address);
            await createGame(gameChannel, server, user, hash, hash, MIN_STAKE);
            const game = await gameChannel.read.gameIdGame([1n]);
            const contractBalanceAfter = await getBalance(gameChannel.address);

            const status = game[0];
            const stake = game[1];

            expect(contractBalanceAfter).to.eq(contractBalanceBefore + MIN_STAKE);
            expect(status).to.equal(1); // active
            expect(stake).to.eq(MIN_STAKE);

            const activeGames = await gameChannel.read.activeGames();
            expect(activeGames).to.eq(1n);
        });
    });

    describe("serverEndGame", () => {
        const stake = MIN_STAKE;

        interface DefaultData {
            gameType: number;
            num: bigint;
            value: bigint;
            roundId: number;
            balance: bigint;
            serverHash: Hex;
            userHash: Hex;
            gameId: bigint;
            contractAddress: Address;
            userAddress: Address;
            signer: Address;
            from: Address;
        }
        async function testHelper(
            error: string,
            dataGen: (
                testData: DefaultData,
                gameFixtureData: CreateGameFixtureReturn,
            ) => Promise<DefaultData> | DefaultData,
        ) {
            const gameFixtureData = await loadFixture(createGameFixture);
            const defaultData: DefaultData = {
                gameType: 0,
                num: 0n,
                value: 0n,
                roundId: 10,
                balance: MAX_BALANCE / 2n,
                serverHash: shash2,
                userHash: phash2,
                gameId: gameFixtureData.gameId,
                contractAddress: gameFixtureData.gameChannel.address,
                userAddress: gameFixtureData.user1,
                signer: gameFixtureData.user1,
                from: gameFixtureData.server,
            };
            const gameChannel = gameFixtureData.gameChannel;

            const {
                gameType,
                num,
                value,
                roundId,
                balance,
                serverHash,
                userHash,
                gameId,
                contractAddress,
                signer,
                userAddress,
                from,
            } = await dataGen(defaultData, gameFixtureData);

            const sig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                contractAddress,
                signer,
            );

            await expect(
                gameChannel.write.serverEndGame(
                    [roundId, balance, serverHash, userHash, gameId, contractAddress, userAddress, sig],
                    {account: from},
                ),
            ).to.to.rejectedWith(error);

            //return await serverEndConfigFailTest(error, gameChannel, await dataGen(defaultData, gameFixtureData));
        }

        it("Should fail with invalid sig", async () => {
            return testHelper("inv sig", (defaultData, {user2}) => ({...defaultData, signer: user2}));
        });

        it("Should fail with invalid game type", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, gameType: 1}));
        });

        it("Should fail with invalid num", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, num: 1n}));
        });

        it("Should fail with invalid value", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, value: 10n ** 16n}));
        });

        it("Should fail with invalid contract address", async () => {
            return testHelper("inv contractAddress", (defaultData, {user2}) => ({
                ...defaultData,
                contractAddress: user2,
            }));
        });

        it("Should fail with invalid user", async () => {
            return testHelper("inv sig", (defaultData, {user2}) => ({...defaultData, userAddress: user2}));
        });

        it("Should fail with invalid round id", async () => {
            return testHelper("inv roundId", (defaultData) => ({...defaultData, roundId: 0}));
        });

        it("Should fail with not server", async () => {
            return testHelper("reverted without a reason", (defaultData, {user1}) => ({...defaultData, from: user1}));
        });

        it("Should fail with balance too low", async () => {
            return testHelper("inv balance", (defaultData, {stake}) => ({
                ...defaultData,
                balance: -stake - BigInt(1e9),
            }));
        });

        it("Should fail with balance too high", async () => {
            return testHelper("inv balance", (defaultData) => ({...defaultData, balance: MAX_BALANCE + BigInt(1e9)}));
        });

        const roundId = 10;
        const gameType = 0;
        const num = 0n;
        const value = 0n;
        const balance = stake / 2n;
        const serverHash = hash;
        const userHash = hash;

        it("Should fail if invalid game id", async () => {
            const {gameChannel, server, user1: user, user2} = await loadFixture(createGameFixture);
            const gameId = 2n;
            // await gameChannel.createGame(hash, {from: user2, value: stake});
            // await gameChannel.acceptGame(user2, gameId, hash, {from: server});
            await createGame(gameChannel, server, user2, hash, hash, stake);

            const sig = await signData(
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

            await expect(
                gameChannel.write.serverEndGame(
                    [roundId, balance, serverHash, userHash, gameId, gameChannel.address, user, sig],
                    {
                        account: server,
                    },
                ),
            ).to.to.rejectedWith("inv gameId");
        });

        it("Should fail if game session status not active", async () => {
            const {gameChannel, server, user1: user, gameId} = await loadFixture(createGameFixture);
            const sig = await signData(
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

            await gameChannel.write.userCancelActiveGame([gameId], {account: user});

            await expect(
                gameChannel.write.serverEndGame(
                    [roundId, balance, serverHash, userHash, gameId, gameChannel.address, user, sig],
                    {
                        account: server,
                    },
                ),
            ).to.be.rejectedWith("inv status");
        });

        it("Should succeed", async () => {
            const {gameChannel, server, user1: user, gameId, stake} = await loadFixture(createGameFixture);
            const sig = await signData(
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

            const contractBalanceBefore = await getBalance(gameChannel.address);
            await gameChannel.write.serverEndGame(
                [roundId, balance, serverHash, userHash, gameId, gameChannel.address, user, sig],
                {account: server},
            );

            const contractBalanceAfter = await getBalance(gameChannel.address);

            const game = await gameChannel.read.gameIdGame([gameId]);

            const status = game[0];

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.eq(contractBalanceBefore - stake - balance);

            const activeGames = await gameChannel.read.activeGames();
            expect(activeGames).to.eq(0n);
        });
    });

    describe("userEndGame", () => {
        interface DefaultData {
            gameType: number;
            num: bigint;
            value: bigint;
            roundId: number;
            balance: bigint;
            serverHash: Hex;
            userHash: Hex;
            gameId: bigint;
            contractAddress: Address;
            signer: Address;
            from: Address;
        }

        async function testHelper(
            error: string,
            dataGen: (
                testData: DefaultData,
                gameFixtureData: CreateGameFixtureReturn,
            ) => Promise<DefaultData> | DefaultData,
        ) {
            const gameFixtureData = await loadFixture(createGameFixture);
            const defaultData: DefaultData = {
                gameType: 0,
                num: 0n,
                value: 0n,
                roundId: 10,
                balance: MAX_BALANCE / 2n,
                serverHash: shash2,
                userHash: phash2,
                gameId: gameFixtureData.gameId,
                contractAddress: gameFixtureData.gameChannel.address,
                signer: gameFixtureData.server,
                from: gameFixtureData.user1,
            };
            const gameChannel = gameFixtureData.gameChannel;

            const {
                gameType,
                num,
                value,
                roundId,
                balance,
                serverHash,
                userHash,
                gameId,
                contractAddress,
                signer,
                from,
            } = await dataGen(defaultData, gameFixtureData);

            const sig = await signData(
                roundId,
                gameType,
                Number(num),
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                contractAddress,
                signer,
            );

            await expect(
                gameChannel.write.userEndGame([roundId, balance, serverHash, userHash, gameId, contractAddress, sig], {
                    account: from,
                }),
            ).to.to.rejectedWith(error);

            //return await serverEndConfigFailTest(error, gameChannel, await dataGen(defaultData, gameFixtureData));
        }

        it("Should fail with invalid sig", async () => {
            return testHelper("inv sig", (defaultData, {user2}) => ({...defaultData, signer: user2}));
        });

        it("Should fail with invalid game type", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, gameType: 1}));
        });

        it("Should fail with invalid num", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, num: 1n}));
        });

        it("Should fail with invalid value", async () => {
            return testHelper("inv sig", (defaultData) => ({...defaultData, value: 10n ** 16n}));
        });

        it("Should fail with invalid contract address", async () => {
            return testHelper("inv contractAddress", (defaultData, {user2}) => ({
                ...defaultData,
                contractAddress: user2,
            }));
        });

        it("Should fail with invalid round id", async () => {
            return testHelper("inv roundId", (defaultData) => ({...defaultData, roundId: 0}));
        });

        it("Should fail with wrong user", async () => {
            return testHelper("inv gameId", (defaultData, {user2}) => ({...defaultData, from: user2}));
        });

        it("Should fail with balance too low", async () => {
            return testHelper("inv balance", (defaultData, {stake}) => ({
                ...defaultData,
                balance: -stake - BigInt(1e9),
            }));
        });

        it("Should fail with balance too high", async () => {
            return testHelper("inv balance", (defaultData) => ({...defaultData, balance: MAX_BALANCE + BigInt(1e9)}));
        });

        const stake = MIN_STAKE;

        const roundId = 10;
        const gameType = 0;
        const num = 0;
        const value = 0n;
        const balance = stake / 2n;
        const serverHash = hash;
        const userHash = hash;

        it("Should fail if invalid game id", async () => {
            const {gameChannel, server, user1: user, user2} = await loadFixture(createGameFixture);
            const gameId = 2n;
            await createGame(gameChannel, server, user2, hash, hash, stake);

            const sig = await signData(
                roundId,
                gameType,
                num,
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                server,
            );

            await expect(
                gameChannel.write.userEndGame(
                    [roundId, balance, serverHash, userHash, gameId, gameChannel.address, sig],
                    {
                        account: user,
                    },
                ),
            ).to.to.rejectedWith("inv gameId");
        });

        it("Should fail if game session status not active", async () => {
            const {gameChannel, gameId, server, user1: user} = await loadFixture(createGameFixture);
            const sig = await signData(
                roundId,
                gameType,
                num,
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                server,
            );

            await gameChannel.write.userCancelActiveGame([gameId], {account: user});

            await expect(
                gameChannel.write.userEndGame(
                    [roundId, balance, serverHash, userHash, gameId, gameChannel.address, sig],
                    {
                        account: user,
                    },
                ),
            ).to.rejectedWith("inv status");
        });

        it("Should succeed", async () => {
            const {gameChannel, gameId, server, user1: user, stake} = await loadFixture(createGameFixture);
            const sig = await signData(
                roundId,
                gameType,
                num,
                value,
                balance,
                serverHash,
                userHash,
                Number(gameId),
                gameChannel.address,
                server,
            );

            const contractBalanceBefore = await getBalance(gameChannel.address);
            await gameChannel.write.userEndGame(
                [roundId, balance, serverHash, userHash, gameId, gameChannel.address, sig],
                {
                    account: user,
                },
            );

            const contractBalanceAfter = await getBalance(gameChannel.address);

            const game = await gameChannel.read.gameIdGame([gameId]);

            const status = game[0];

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.eq(contractBalanceBefore - stake - balance);

            const activeGames = await gameChannel.read.activeGames();
            expect(activeGames).to.eq(0n);
        });
    });
});
