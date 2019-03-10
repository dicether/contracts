import {GameStatus, ReasonEnded} from '@dicether/state-channel';
import * as chai from 'chai';

import BlockchainLifecycle from '../utils/BlockchainLifecycle';
import {INITIAL_HOUSE_STAKE, MAX_STAKE, NOT_ENDED_FINE} from "../utils/config";
import {configureChai, createGame, getBalance, TRANSACTION_ERROR} from '../utils/util';
import {checkActiveGamesAsync, checkGameStatusAsync, phash3, shash3} from "./util";

const GameChannel = artifacts.require("./GameChannel.sol");


configureChai();
const expect = chai.expect;


contract('GameChannelConflict', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const user = accounts[2];
    const user2 = accounts[3];

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


    describe('serverCancelActiveGame', () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        beforeEach(async () => {
            await createGame(gameChannel, server, user, shash3, phash3, stake);

        });

        it("Should fail if wrong gameId", async () => {
            await createGame(gameChannel, server, user2, shash3, phash3, stake);

            return expect(gameChannel.serverCancelActiveGame(user, 2, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game status not active", async () => {
            await gameChannel.userCancelActiveGame(1, {from: user});

            return expect(gameChannel.userCancelActiveGame(2, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong user address", async () => {
            await createGame(gameChannel, server, user2, shash3, phash3, stake);

            return expect(gameChannel.serverCancelActiveGame(user2, 1, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed if already userCancelActiveGame called by user", async () => {
            await gameChannel.userCancelActiveGame(1, {from: user});

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await gameChannel.serverCancelActiveGame(user, gameId, {from: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(stake).add(NOT_ENDED_FINE));
            expect(houseProfitAfter).to.eq.BN(houseProfitBefore.add(NOT_ENDED_FINE));
            expect(houseStakeAfter).to.eq.BN(houseStakeBefore.add(NOT_ENDED_FINE));

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.CONFLICT_ENDED);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        it("Should succeed", async () => {
            await gameChannel.serverCancelActiveGame(user, gameId, {from: server});

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.SERVER_INITIATED_END, ReasonEnded.REGULAR_ENDED);
        });
    });

    describe('userCancelActiveGame', () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        beforeEach(async () => {
            await createGame(gameChannel, server, user, shash3, phash3, stake);
        });

        it("Should fail if wrong gameId", async () => {
            await gameChannel.userCancelActiveGame(gameId, {from: user});

            return expect(gameChannel.userCancelActiveGame(2, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game status not active", async () => {
            await gameChannel.userCancelActiveGame(gameId, {from: user});

            return expect(gameChannel.userCancelActiveGame(2, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed if already serverCancelActiveGame called by server", async () => {
            await gameChannel.serverCancelActiveGame(user, 1, {from: server});

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await gameChannel.userCancelActiveGame(gameId, {from: user});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(stake).add(NOT_ENDED_FINE));
            expect(houseProfitAfter).to.eq.BN(houseProfitBefore.add(NOT_ENDED_FINE));
            expect(houseStakeAfter).to.eq.BN(houseStakeBefore.add(NOT_ENDED_FINE));

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.CONFLICT_ENDED);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        it("Should succeed", async () => {
            await gameChannel.userCancelActiveGame(gameId, {from: user});

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.USER_INITIATED_END, ReasonEnded.REGULAR_ENDED);

            await checkActiveGamesAsync(gameChannel, 1);
        });
    });
});
