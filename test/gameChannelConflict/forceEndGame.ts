import {
    calcUserProfit,
    GameStatus,
    ReasonEnded, fromWeiToGwei, fromGweiToWei
} from '@dicether/state-channel';
import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from '../utils/BlockchainLifecycle';
import {MAX_STAKE, NOT_ENDED_FINE, USER_TIMEOUT, SERVER_TIMEOUT} from "../utils/config";
import {signData} from "../utils/signUtil";
import {configureChai, createGame, increaseTimeAsync, TRANSACTION_ERROR} from '../utils/util';
import {
    BET_VALUE,
    checkActiveGamesAsync,
    checkGameStatusAsync,
    phash1,
    phash2,
    phash3,
    shash1,
    shash2,
    shash3
} from "./util";


const GameChannel = artifacts.require("./GameChannel.sol");


configureChai();
const expect = chai.expect;

const withData = leche.withData;


contract('GameChannelConflict-ForceEnd', accounts => {
    const server = accounts[1];
    const user = accounts[2];

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

    describe('serverForceGameEnd', async () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await createGame(gameChannel, server, user, shash3, phash3, stake);

        });

        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80,
            value: BET_VALUE,
            balance: stake.idiv(2),
            serverHash: shash2,
            userHash: phash2,
            gameId: 1,
            contractAddress: () => contractAddress,
            userAddress: user,
            serverSeed: shash1,
            userSeed: phash1,
            signer: user,
            from: server
        };

        it("Should fail if time span too low", async () => {
            const d = defaultData;
            const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                userSig,
                d.userAddress,
                d.serverSeed,
                d.userSeed,
                {from: d.from}
            );

            return expect(gameChannel.serverForceGameEnd(user, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong sender", async () => {
            const d = defaultData;
            const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                userSig,
                d.userAddress,
                d.serverSeed,
                d.userSeed,
                {from: d.from}
            );

            return expect(gameChannel.serverForceGameEnd(user, d.gameId, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game still active", async () => {
            const d = defaultData;
            return expect(gameChannel.serverForceGameEnd(user, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it("Should fail if user init end game!", async () => {
            const d = defaultData;
            const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), server);

            await gameChannel.userEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                serverSig,
                d.userSeed,
                {from: user}
            );

            await increaseTimeAsync(Math.max(SERVER_TIMEOUT, USER_TIMEOUT));

            return expect(gameChannel.serverForceGameEnd(user, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Force end should succeed", async () => {
            const d = defaultData;
            const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                userSig,
                d.userAddress,
                d.serverSeed,
                d.userSeed,
                {from: d.from}
            );

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await increaseTimeAsync(SERVER_TIMEOUT);
            await gameChannel.serverForceGameEnd(user, d.gameId, {from: server});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const newBalance = BigNumber.max(d.balance.sub(d.value).sub(NOT_ENDED_FINE), stake.negated());
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.SERVER_FORCED_END);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        // TODO: Add wrong game id check
    });

    describe('userForceGameEnd', async () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await createGame(gameChannel, server, user, shash3, phash3, stake);

        });

        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80,
            value: BET_VALUE,
            balance: stake.idiv(2),
            serverHash: shash2,
            userHash: phash2,
            gameId: 1,
            contractAddress: () => contractAddress,
            userAddress: user,
            serverSeed: shash1,
            userSeed: phash1,
            signer: server,
            from: user
        };

        it("Should fail if time span too low", async () => {
            const d = defaultData;
            const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.userEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                serverSig,
                d.userSeed,
                {from: d.from}
            );

            return expect(gameChannel.userForceGameEnd(d.gameId, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game still active", async () => {
            const d = defaultData;
            return expect(gameChannel.userForceGameEnd(d.gameId, {from: user})).to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it("Should fail if server init end game!", async () => {
            const d = defaultData;
            const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.userHash, d.gameId, d.contractAddress(), user);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.userHash,
                d.gameId,
                d.contractAddress(),
                userSig,
                d.userAddress,
                d.serverSeed,
                d.userSeed,
                {from: server}
            );

            await increaseTimeAsync(Math.max(SERVER_TIMEOUT, USER_TIMEOUT));

            return expect(gameChannel.userForceGameEnd(d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        withData({
                'game type 1': {
                    ...defaultData, gameType: 1
                },
                'game type 2': {
                    ...defaultData, gameType: 2
                },
            }, (d: typeof defaultData)  => {

            it("should succeed", async () => {
                const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                    d.userHash, d.gameId, d.contractAddress(), d.signer);

                console.log("Game type", d.gameType);
                await gameChannel.userEndGameConflict(
                    d.roundId,
                    d.gameType,
                    d.num,
                    d.value,
                    d.balance,
                    d.serverHash,
                    d.userHash,
                    d.gameId,
                    d.contractAddress(),
                    serverSig,
                    d.userSeed,
                    {from: d.from}
                );

                await increaseTimeAsync(USER_TIMEOUT);

                const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

                await gameChannel.userForceGameEnd(d.gameId, {from: user});

                const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = BigNumber.max(
                    d.balance.add(fromGweiToWei(calcUserProfit(d.gameType, d.num, fromWeiToGwei(d.value), true)))
                        .add(NOT_ENDED_FINE),
                    stake.negated()
                );
                const payout = stake.add(newBalance);

                expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
                expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
                expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

                await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.USER_FORCED_END);

                await checkActiveGamesAsync(gameChannel, 0);
            });
        });
    });
});
