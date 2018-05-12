import { ZERO_SEED,
    checkActiveGamesAsync, checkGameStateAsync, checkGameStatusAsync, BET_VALUE,
    phash1, phash2, phash3, shash1,  shash2, shash3
} from "./util";
import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from '../utils/BlockchainLifecycle';
import {
    calcNewBalance, GameStatus, GameType, MAX_BALANCE, MAX_STAKE, NOT_ENDED_FINE, PLAYER_TIMEOUT, ReasonEnded,
    SERVER_TIMEOUT, signData
} from '../utils/stateChannel';
import {configureChai, createGame, increaseTimeAsync, TRANSACTION_ERROR} from '../utils/util';

const GameChannel = artifacts.require("./GameChannel.sol");


configureChai();
const expect = chai.expect;

const withData = leche.withData;


contract('GameChannelConflict', accounts => {
    const server = accounts[1];
    const player = accounts[2];
    const player2 = accounts[3];

    const blockchainLifecycle = new BlockchainLifecycle(web3.currentProvider);
    let gameChannel: any;

    before(async () => {
        gameChannel = await GameChannel.deployed();
    });

    beforeEach(async () => {
        await blockchainLifecycle.takeSnapshotAsync();
        // gameChannel = await GameChannel.new();
    });

    afterEach(async () => {
        await blockchainLifecycle.revertSnapShotAsync();
    });


    describe('serverCancelActiveGame', () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        beforeEach(async () => {
            await createGame(gameChannel, server, player, shash3, phash3, stake);
            // await gameChannel.createGame(phash3, {from: player, value: stake});
            // await gameChannel.acceptGame(player, gameId, shash3, {from: server});

        });

        it("Should fail if wrong gameId", async () => {
            // await gameChannel.createGame(phash3, {from: player2, value: stake});
            // await gameChannel.acceptGame(player2, 2, shash3, {from: server});
            await createGame(gameChannel, server, player2, shash3, phash3, stake);

            return expect(gameChannel.serverCancelActiveGame(player, 2, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game status not active", async () => {
            await gameChannel.playerCancelActiveGame(1, {from: player});

            return expect(gameChannel.playerCancelActiveGame(2, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong player address", async () => {
            // await gameChannel.createGame(phash3, {from: player2, value: stake});
            // await gameChannel.acceptGame(player2, 2, shash3, {from: server});
            await createGame(gameChannel, server, player2, shash3, phash3, stake);

            return expect(gameChannel.serverCancelActiveGame(player2, 1, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed if already playerCancelActiveGame called by player", async () => {
            await gameChannel.playerCancelActiveGame(1, {from: player});

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await gameChannel.serverCancelActiveGame(player, gameId, {from: server});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(stake));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore);
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        it("Should succeed", async () => {
            await gameChannel.serverCancelActiveGame(player, gameId, {from: server});

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.SERVER_INITIATED_END, ReasonEnded.REGULAR_ENDED);
        });
    });

    describe('playerCancelActiveGame', () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        beforeEach(async () => {
            await createGame(gameChannel, server, player, shash3, phash3, stake);
            // await gameChannel.createGame(phash3, {from: player, value: stake});
            // await gameChannel.acceptGame(player, gameId, shash3, {from: server});
        });

        it("Should fail if wrong gameId", async () => {
            await gameChannel.playerCancelActiveGame(gameId, {from: player});
            const game = await gameChannel.gameIdGame.call(gameId);

            return expect(gameChannel.playerCancelActiveGame(2, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game status not active", async () => {
            await gameChannel.playerCancelActiveGame(gameId, {from: player});

            return expect(gameChannel.playerCancelActiveGame(2, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed if already serverCancelActiveGame called by server", async () => {
            await gameChannel.serverCancelActiveGame(player, 1, {from: server});

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await gameChannel.playerCancelActiveGame(gameId, {from: player});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(stake));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore);
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore);

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        it("Should succeed", async () => {
            await gameChannel.playerCancelActiveGame(gameId, {from: player});
            const game = await gameChannel.gameIdGame.call(gameId);

            const status = game[0].toNumber();

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.PLAYER_INITIATED_END, ReasonEnded.REGULAR_ENDED);

            await checkActiveGamesAsync(gameChannel, 1);
        });
    });
});
