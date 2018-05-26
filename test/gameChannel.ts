const GameChannel = artifacts.require("./GameChannel.sol");
import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {HOUSE_STAKE, MAX_BALANCE, MAX_STAKE, MIN_STAKE, signData, signStartData} from './utils/stateChannel';
import {configureChai, createGame, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

const withData = leche.withData;

const hash = "0x0000000000000000000000000000000000000000000000000000000000000001"; // dummy hash


contract('GameChannel', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const player = accounts[2];
    const player2 = accounts[3];
    const notServer = accounts[4];

    const blockchainLifecycle = new BlockchainLifecycle(web3.currentProvider);
    let gameChannel: any;

    before(async () => {
        gameChannel = await GameChannel.deployed();
    });

    beforeEach(async () => {
        await blockchainLifecycle.takeSnapshotAsync();
    });

    afterEach(async () => {
        await blockchainLifecycle.revertSnapShotAsync();
    });

    describe('createGame', () => {
        it("Should fail if house stake too low", async () => {
            await gameChannel.withdrawHouseStake(HOUSE_STAKE, {from: owner});

            return expect(createGame(gameChannel, server, player, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if value too low", async () => {
            return expect(createGame(gameChannel, server, player, hash, hash, MIN_STAKE.sub(1))).to.be.rejectedWith(TRANSACTION_ERROR);

        });

        it("Should fail if value too high", async () => {
            return expect(createGame(gameChannel, server, player, hash, hash, MAX_STAKE.add(1))).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game paused", async () => {
            await gameChannel.pause({from: owner});
            return expect(createGame(gameChannel, server, player, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game not ended", async () => {
            await createGame(gameChannel, server, player, hash, hash, MIN_STAKE);
            return expect(createGame(gameChannel, server, player, hash, hash, MIN_STAKE)).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid signature", async () => {
            const createBefore = Math.round(Date.now() / 1000) + 5 * 60;
            const sig = signStartData(gameChannel.address, player, 0, createBefore, hash, player);

            return expect(gameChannel.createGame(hash, 0, createBefore, hash, sig, {from: player, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid create time", async () => {
            const createBefore = Math.round(Date.now() / 1000);
            const sig = signStartData(gameChannel.address, server, 0, createBefore, hash, server);

            return expect(gameChannel.createGame(hash, 0, createBefore, hash, sig, {from: player, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if invalid  game id", async () => {
            const createBefore = Math.round(Date.now() / 1000);
            const sig = signStartData(gameChannel.address, server, 1, createBefore, hash, server);

            return expect(gameChannel.createGame(hash, 1, createBefore, hash, sig, {from: player, value: MIN_STAKE})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Create game should succeed", async () => {
            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            await createGame(gameChannel, server, player, hash, hash, MIN_STAKE);
            const game = await gameChannel.gameIdGame.call(1);
            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);

            const status = game[0].toNumber();
            const stake = game[1];

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.add(MIN_STAKE));
            expect(status).to.equal(1); // active
            expect(stake).to.be.bignumber.equal(MIN_STAKE);

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.be.bignumber.equal(1);
        })
    });

    describe('serverEndGame', () => {
        const gameId = 1;
        const stake = MIN_STAKE;

        const roundId = 10;
        const gameType = 0;
        const num = 0;
        const value = new BigNumber(0);
        const balance = stake.div(2);
        const serverHash = hash;
        const playerHash = hash;
        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            // await gameChannel.createGame(hash, {from: player, value: stake});
            // await gameChannel.acceptGame(player, gameId, hash, {from: server});
            await createGame(gameChannel, server, player, hash, hash, stake);

        });

        const defaultData = {
            roundId,
            gameType,
            num,
            value,
            balance,
            serverHash,
            playerHash,
            gameId,
            contractAddress: () => contractAddress,
            player,
            server,
            signer: player
        };

        withData({
            'invalid sig': {
                ...defaultData, signer: player2
            },
            'invalid gameType': {
                ...defaultData, gameType: 1
            },
            'invalid num': {
                    ...defaultData, num: 1
                },
            'invalid value': {
                    ...defaultData, value: 1
            },
            'invalid contract address': {
                    ...defaultData, contractAddress: () => accounts[5]
            },
            'invalid player address': {
                    ...defaultData, player: player2
            },
            'invalid round id': {
                    ...defaultData, roundId: 0
            },
            'not server': {
                ...defaultData, server: notServer
            },
            'balance too low': {
                ...defaultData, balance: stake.negated().sub(1)
            },
            'balance too high': {
                ...defaultData, balance: MAX_BALANCE.add(1)
            }
        }, (d: typeof defaultData) => {
            it("Should fail", async () => {
                const sig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash, d.playerHash,
                    d.gameId, d.contractAddress(), d.signer);

                return expect(
                    gameChannel.serverEndGame(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.playerHash, d.gameId, d.contractAddress(), d.player, sig, {from: d.server})
                ).to.to.rejectedWith(TRANSACTION_ERROR);
            });
        });

        it("Should fail if invalid game id", async () => {
            // tslint:disable-next-line:no-shadowed-variable
            const gameId = 2;
            // await gameChannel.createGame(hash, {from: player2, value: stake});
            // await gameChannel.acceptGame(player2, gameId, hash, {from: server});
            await createGame(gameChannel, server, player2, hash, hash, stake);

            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, player);

            return expect(
                gameChannel.serverEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                    contractAddress, player, sig, {from: player})
            ).to.to.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game session status not active", async () => {
            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, player);

            await gameChannel.playerCancelActiveGame(gameId, {from: player});

            return expect(
                gameChannel.serverEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                    contractAddress, player, sig, {from: server})
            ).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("serverEndGame should succeed", async () => {
            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, player);

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            await gameChannel.serverEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                contractAddress, player, sig, {from: server});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);

            const game = await gameChannel.gameIdGame.call(gameId);

            const status = game[0].toNumber();

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(stake).sub(balance));

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.be.bignumber.equal(0);
        });
    });

    describe('playerEndGame', () => {
        const gameId = 1;
        const stake = MIN_STAKE;

        const roundId = 10;
        const gameType = 0;
        const num = 0;
        const value = new BigNumber(0);
        const balance = stake.div(2);
        const serverHash = hash;
        const playerHash = hash;
        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await createGame(gameChannel, server, player, hash, hash, stake);

        });

        const defaultData = {
            roundId,
            gameType,
            num,
            value,
            balance,
            serverHash,
            playerHash,
            gameId,
            contractAddress: () => contractAddress,
            player,
            server,
            signer: server
        };

        withData({
            'invalid sig': {
                ...defaultData, signer: player
            },
            'invalid gameType': {
                ...defaultData, gameType: 1
            },
            'invalid num': {
                    ...defaultData, num: 1
            },
            'invalid value': {
                    ...defaultData, value: 1
            },
            'invalid contract address': {
                    ...defaultData, contractAddress: () => accounts[5]
            },
            'invalid player': {
                    ...defaultData, player: player2
            },
            'invalid round id': {
                    ...defaultData, roundId: 0
            },
            'balance too low': {
                ...defaultData, balance: stake.negated().sub(1)
            },
            'balance too high': {
                ...defaultData, balance: MAX_BALANCE.add(1)
            }
        }, (d: typeof defaultData) => {
            it("Should fail", async () => {
                const sig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash, d.playerHash,
                    d.gameId, d.contractAddress(), d.signer);

                return expect(
                    gameChannel.playerEndGame(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.playerHash, d.gameId, d.contractAddress(), sig, {from: d.player})
                ).to.to.rejectedWith(TRANSACTION_ERROR);
            });
        });

        it("Should fail if invalid game id", async () => {
            const gameId = 2; // tslint:disable-line:no-shadowed-variable
            await createGame(gameChannel, server, player2, hash, hash, stake);

            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, server);

            return expect(
                gameChannel.playerEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                    contractAddress, sig, {from: player})
            ).to.to.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game session status not active", async () => {
            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, server);

            await gameChannel.playerCancelActiveGame(gameId, {from: player});

            return expect(
                gameChannel.playerEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                    contractAddress, sig, {from: player})
            ).to.rejectedWith(TRANSACTION_ERROR);
        });

        it("playerEndGame should succeed", async () => {
            const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                gameChannel.address, server);

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            await gameChannel.playerEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
                contractAddress, sig, {from: player});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);

            const game = await gameChannel.gameIdGame.call(gameId);

            const status = game[0].toNumber();

            expect(status).to.equal(0); // active
            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(stake).sub(balance));

            const activeGames = await gameChannel.activeGames.call();
            expect(activeGames).to.be.bignumber.equal(0);
        });
    });
});
