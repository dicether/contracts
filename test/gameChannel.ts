const GameChannel = artifacts.require("./GameChannel.sol");
import BN from 'bn.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {INITIAL_HOUSE_STAKE, MAX_BALANCE, MAX_STAKE, MIN_STAKE} from './utils/config';
import {signData, signStartData} from "./utils/signUtil";
import {configureChai, createGame, getBalance, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

const withData = leche.withData;

const hash = "0x0000000000000000000000000000000000000000000000000000000000000001"; // dummy hash


contract('GameChannel', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const user = accounts[2];
    const user2 = accounts[3];
    const notServer = accounts[4];

    const blockchainLifecycle = new BlockchainLifecycle(web3.currentProvider);
    let gameChannel: any;

    before(async () => {
        gameChannel = await GameChannel.deployed();
        await gameChannel.addHouseStake({from: owner, value: INITIAL_HOUSE_STAKE});
        await gameChannel.activate({from: owner});
        await gameChannel.unpause({from: owner});
    });

    beforeEach(async () => {
        await blockchainLifecycle.takeSnapshotAsync();
    });

    afterEach(async () => {
        await blockchainLifecycle.revertSnapShotAsync();
    });

    describe('createGame', () => {
        it("Should fail if house stake too low", async () => {
            await gameChannel.withdrawHouseStake(INITIAL_HOUSE_STAKE, {from: owner});

            return expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if value too low", async () => {
            return expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE.subn(1))).to.be.rejectedWith(TRANSACTION_ERROR);

        });

        it("Should fail if value too high", async () => {
            return expect(createGame(gameChannel, server, user, hash, hash, MAX_STAKE.addn(1))).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game paused", async () => {
            await gameChannel.pause({from: owner});
            return expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game not ended", async () => {
            await createGame(gameChannel, server, user, hash, hash, MIN_STAKE);
            return expect(createGame(gameChannel, server, user, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid signature", async () => {
            const createBefore = Math.round(Date.now() / 1000) + 5 * 60;
            const sig = signStartData(gameChannel.address, user, 0, createBefore, hash, user);

            return expect(gameChannel.createGame(hash, 0, createBefore, hash, sig, {from: user, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid create time", async () => {
            const createBefore = Math.round(Date.now() / 1000);
            const sig = signStartData(gameChannel.address, server, 0, createBefore, hash, server);

            return expect(gameChannel.createGame(hash, 0, createBefore, hash, sig, {from: user, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid  game id", async () => {
            const createBefore = Math.round(Date.now() / 1000);
            const sig = signStartData(gameChannel.address, server, 1, createBefore, hash, server);

            return expect(gameChannel.createGame(hash, 1, createBefore, hash, sig, {from: user, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Create game should succeed", async () => {
            const contractBalanceBefore = await getBalance(gameChannel.address);
            await createGame(gameChannel, server, user, hash, hash, MIN_STAKE);
            const game = await gameChannel.gameIdGame.call(1);
            const contractBalanceAfter = await getBalance(gameChannel.address);

            const status = game[0].toNumber();
            const stake = game[1];

            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.add(MIN_STAKE));
            expect(status).to.equal(1); // active
            expect(stake).to.eq.BN(MIN_STAKE);

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.eq.BN(1);
        })
    });

    describe('serverEndGame', () => {
        const gameId = 1;
        const stake = MIN_STAKE;

        const roundId = 10;
        const gameType = 0;
        const num = 0;
        const value = new BN(0);
        const balance = stake.divn(2);
        const serverHash = hash;
        const userHash = hash;
        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            // await gameChannel.createGame(hash, {from: user, value: stake});
            // await gameChannel.acceptGame(user, gameId, hash, {from: server});
            await createGame(gameChannel, server, user, hash, hash, stake);

        });

        const defaultData = {
            roundId,
            gameType,
            num,
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            contractAddress: () => contractAddress,
            user,
            server,
            signer: user
        };

        withData({
            'invalid sig': {
                ...defaultData, signer: user2
            },
            'invalid gameType': {
                ...defaultData, gameType: 1
            },
            'invalid num': {
                    ...defaultData, num: 1
                },
            'invalid value': {
                    ...defaultData, value: new BN(1e9)
            },
            'invalid contract address': {
                    ...defaultData, contractAddress: () => accounts[5]
            },
            'invalid user address': {
                    ...defaultData, user: user2
            },
            'invalid round id': {
                    ...defaultData, roundId: 0
            },
            'not server': {
                ...defaultData, server: notServer
            },
            'balance too low': {
                ...defaultData, balance: stake.neg().subn(1)
            },
            'balance too high': {
                ...defaultData, balance: MAX_BALANCE.addn(1)
            }
        }, (d: typeof defaultData) => {
            it("Should fail", async () => {
                const sig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash, d.userHash,
                    d.gameId, d.contractAddress(), d.signer);

                return expect(
                    gameChannel.serverEndGame(d.roundId, d.balance, d.serverHash,
                        d.userHash, d.gameId, d.contractAddress(), d.user, sig, {from: d.server})
                ).to.to.rejectedWith(TRANSACTION_ERROR);
            });
        });

        it("Should fail if invalid game id", async () => {
            // tslint:disable-next-line:no-shadowed-variable
            const gameId = 2;
            // await gameChannel.createGame(hash, {from: user2, value: stake});
            // await gameChannel.acceptGame(user2, gameId, hash, {from: server});
            await createGame(gameChannel, server, user2, hash, hash, stake);

            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, user);

            return expect(
                gameChannel.serverEndGame(roundId, balance, serverHash, userHash, gameId,
                    contractAddress, user, sig, {from: user})
            ).to.to.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game session status not active", async () => {
            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, user);

            await gameChannel.userCancelActiveGame(gameId, {from: user});

            return expect(
                gameChannel.serverEndGame(roundId, balance, serverHash, userHash, gameId,
                    contractAddress, user, sig, {from: server})
            ).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("serverEndGame should succeed", async () => {
            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, user);

            const contractBalanceBefore = await getBalance(gameChannel.address);
            await gameChannel.serverEndGame(roundId, balance, serverHash, userHash, gameId,
                contractAddress, user, sig, {from: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);

            const game = await gameChannel.gameIdGame.call(gameId);

            const status = game[0].toNumber();

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(stake).sub(balance));

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.eq.BN(0);
        });
    });

    describe('userEndGame', () => {
        const gameId = 1;
        const stake = MIN_STAKE;

        const roundId = 10;
        const gameType = 0;
        const num = 0;
        const value = new BN(0);
        const balance = stake.divn(2);
        const serverHash = hash;
        const userHash = hash;
        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await createGame(gameChannel, server, user, hash, hash, stake);

        });

        const defaultData = {
            roundId,
            gameType,
            num,
            value,
            balance,
            serverHash,
            userHash,
            gameId,
            contractAddress: () => contractAddress,
            user,
            server,
            signer: server
        };

        withData({
            'invalid sig': {
                ...defaultData, signer: user
            },
            'invalid gameType': {
                ...defaultData, gameType: 1
            },
            'invalid num': {
                    ...defaultData, num: 1
            },
            'invalid value': {
                    ...defaultData, value: new BN(1e9)
            },
            'invalid contract address': {
                    ...defaultData, contractAddress: () => accounts[5]
            },
            'invalid user': {
                    ...defaultData, user: user2
            },
            'invalid round id': {
                    ...defaultData, roundId: 0
            },
            'balance too low': {
                ...defaultData, balance: stake.neg().subn(1)
            },
            'balance too high': {
                ...defaultData, balance: MAX_BALANCE.addn(1)
            }
        }, (d: typeof defaultData) => {
            it("Should fail", async () => {
                const sig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash, d.userHash,
                    d.gameId, d.contractAddress(), d.signer);

                return expect(
                    gameChannel.userEndGame(d.roundId, d.balance, d.serverHash,
                        d.userHash, d.gameId, d.contractAddress(), sig, {from: d.user})
                ).to.to.rejectedWith(TRANSACTION_ERROR);
            });
        });

        it("Should fail if invalid game id", async () => {
            const gameId = 2; // tslint:disable-line:no-shadowed-variable
            await createGame(gameChannel, server, user2, hash, hash, stake);

            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, server);

            return expect(
                gameChannel.userEndGame(roundId, balance, serverHash, userHash, gameId,
                    contractAddress, sig, {from: user})
            ).to.to.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game session status not active", async () => {
            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, server);

            await gameChannel.userCancelActiveGame(gameId, {from: user});

            return expect(
                gameChannel.userEndGame(roundId, balance, serverHash, userHash, gameId,
                    contractAddress, sig, {from: user})
            ).to.rejectedWith(TRANSACTION_ERROR);
        });

        it("userEndGame should succeed", async () => {
            const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
                gameChannel.address, server);

            const contractBalanceBefore = await getBalance(gameChannel.address);
            await gameChannel.userEndGame(roundId, balance, serverHash, userHash, gameId,
                contractAddress, sig, {from: user});

            const contractBalanceAfter = await getBalance(gameChannel.address);

            const game = await gameChannel.gameIdGame.call(gameId);

            const status = game[0].toNumber();

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(stake).sub(balance));

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.eq.BN(0);
        });
    });
});
