import {
    calcUserProfit,
    GameStatus,
    ReasonEnded, fromWeiToGwei, fromGweiToWei, calcMaxUserProfit, calcNewBalance
} from '@dicether/state-channel';
import BN from 'bn.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from '../utils/BlockchainLifecycle';
import {
    MAX_STAKE,
    NOT_ENDED_FINE,
    USER_TIMEOUT,
    SERVER_TIMEOUT,
    INITIAL_HOUSE_STAKE,
    MAX_BALANCE
} from "../utils/config";
import {signData} from "../utils/signUtil";
import {configureChai, createGame, getBalance, increaseTimeAsync, max, TRANSACTION_ERROR} from '../utils/util';
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
    const owner = accounts[0];
    const server = accounts[1];
    const user = accounts[2];

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
            balance: MAX_BALANCE,
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
            const userSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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
            const userSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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
            const serverSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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
            const userSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await increaseTimeAsync(SERVER_TIMEOUT);
            await gameChannel.serverForceGameEnd(user, d.gameId, {from: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const regularNewBalance = new BN(fromGweiToWei(calcNewBalance(
                d.gameType,
                d.num,
                fromWeiToGwei(d.value.toString()),
                d.serverSeed,
                d.userSeed,
                fromWeiToGwei(d.balance.toString())
            )));
            const newBalance = max(regularNewBalance.sub(NOT_ENDED_FINE), stake.neg());
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.eq.BN(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.eq.BN(houseStakeBefore.sub(newBalance));

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.SERVER_FORCED_END);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        it("Force end should succeed after cancelActiveGame", async () => {
            const d = defaultData;

            await gameChannel.serverCancelActiveGame(user, gameId, {from: server});

            const contractBalanceBefore = await getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await increaseTimeAsync(SERVER_TIMEOUT);
            await gameChannel.serverForceGameEnd(user, d.gameId, {from: server});

            const contractBalanceAfter = await getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const newBalance = max(NOT_ENDED_FINE.neg(), stake.neg());
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.eq.BN(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.eq.BN(houseStakeBefore.sub(newBalance));

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
            balance: MAX_BALANCE.divn(2),
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
            const serverSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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
            const userSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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
                'game type 1 num 1': {
                    ...defaultData, gameType: 1, num: 1
                },
                'game type 1 num 98': {
                    ...defaultData, gameType: 1, num: 98
                },
                'game type 2 num 1': {
                    ...defaultData, gameType: 2, num: 1
                },
                'game type 2 num 98': {
                    ...defaultData, gameType: 2, num: 98
                },
                'game type 3 num 1': {
                    ...defaultData, gameType: 3, num: 1,
                },
                'game type 3 num 2^12 - 2': {
                    ...defaultData, gameType: 3, num: Math.pow(2,12) - 2,
                },
                'game type 4 num 0': {
                    ...defaultData, gameType: 4, num: 0,
                },
                'game type 4 num 1': {
                    ...defaultData, gameType: 4, num: 1,
                },
                'game type 5 num 1': {
                ...defaultData, gameType: 5, num: 1,
                },
                'game type 5 num 1098437885952': {
                    ...defaultData, gameType: 5, num: "1098437885952",
                },
                'game type 6 num 110': {
                    ...defaultData, gameType: 6, num: 110,
                },
                'game type 6 num 320': {
                    ...defaultData, gameType: 6, num: 320,
                },
            }, (d: typeof defaultData)  => {

            it("should succeed", async () => {
                const serverSig = await signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
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

                await increaseTimeAsync(USER_TIMEOUT);

                const contractBalanceBefore = await getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

                await gameChannel.userForceGameEnd(d.gameId, {from: user});

                const contractBalanceAfter = await getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = max(
                    d.balance
                        .add(new BN(fromGweiToWei(calcMaxUserProfit(d.gameType, d.num, fromWeiToGwei(d.value.toString())))))
                        .add(NOT_ENDED_FINE),
                    stake.neg()
                );
                const payout = stake.add(newBalance);

                expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(payout));
                expect(houseProfitAfter).to.eq.BN(houseProfitBefore.sub(newBalance));
                expect(houseStakeAfter).to.eq.BN(houseStakeBefore.sub(newBalance));

                await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.USER_FORCED_END);

                await checkActiveGamesAsync(gameChannel, 0);
            })

            it("should succeed after cancelActiveGame", async () => {
                await gameChannel.userCancelActiveGame(gameId, {from: user});

                await increaseTimeAsync(USER_TIMEOUT);

                const contractBalanceBefore = await getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

                await gameChannel.userForceGameEnd(d.gameId, {from: user});

                const contractBalanceAfter = await getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = NOT_ENDED_FINE;
                const payout = stake.add(newBalance);

                expect(contractBalanceAfter).to.eq.BN(contractBalanceBefore.sub(payout));
                expect(houseProfitAfter).to.eq.BN(houseProfitBefore.sub(newBalance));
                expect(houseStakeAfter).to.eq.BN(houseStakeBefore.sub(newBalance));

                await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.USER_FORCED_END);

                await checkActiveGamesAsync(gameChannel, 0);
            });
        });
    });
});
