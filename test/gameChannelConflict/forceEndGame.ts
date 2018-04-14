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
import {configureChai, increaseTimeAsync, TRANSACTION_ERROR} from '../utils/util';

const GameChannel = artifacts.require("./GameChannel.sol");


configureChai();
const expect = chai.expect;

const withData = leche.withData;


contract('GameChannelConflict-ForceEnd', accounts => {
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

    describe('serverForceGameEnd', async () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await gameChannel.createGame(phash3, {from: player, value: stake});
            await gameChannel.acceptGame(player, gameId, shash3, {from: server});

        });

        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80,
            value: BET_VALUE,
            balance: stake.idiv(2),
            serverHash: shash2,
            playerHash: phash2,
            gameId: 1,
            contractAddress: () => contractAddress,
            playerAddress: player,
            serverSeed: shash1,
            playerSeed: phash1,
            signer: player,
            from: server
        };

        it("Should fail if time span too low", async () => {
            const d = defaultData;
            const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                playerSig,
                d.playerAddress,
                d.serverSeed,
                d.playerSeed,
                {from: d.from}
            );

            return expect(gameChannel.serverForceGameEnd(player, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong sender", async () => {
            const d = defaultData;
            const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                playerSig,
                d.playerAddress,
                d.serverSeed,
                d.playerSeed,
                {from: d.from}
            );

            return expect(gameChannel.serverForceGameEnd(player, d.gameId, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game still active", async () => {
            const d = defaultData;
            return expect(gameChannel.serverForceGameEnd(player, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it("Should fail if player init end game!", async () => {
            const d = defaultData;
            const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), server);

            await gameChannel.playerEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                serverSig,
                d.playerSeed,
                {from: player}
            );

            await increaseTimeAsync(Math.max(SERVER_TIMEOUT, PLAYER_TIMEOUT));

            return expect(gameChannel.serverForceGameEnd(player, d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Force end should succeed", async () => {
            const d = defaultData;
            const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                playerSig,
                d.playerAddress,
                d.serverSeed,
                d.playerSeed,
                {from: d.from}
            );

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await increaseTimeAsync(SERVER_TIMEOUT);
            await gameChannel.serverForceGameEnd(player, d.gameId, {from: server});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const newBalance = BigNumber.max(d.balance.sub(d.value).sub(NOT_ENDED_FINE), stake.negated());
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.END_FORCED_BY_SERVER);

            await checkActiveGamesAsync(gameChannel, 0);
        });

        // TODO: Add wrong game id check
    });

    describe('playerForceGameEnd', async () => {
        const gameId = 1;
        const stake = MAX_STAKE;

        let contractAddress: string;

        beforeEach(async () => {
            contractAddress = gameChannel.address;
            await gameChannel.createGame(phash3, {from: player, value: stake});
            await gameChannel.acceptGame(player, gameId, shash3, {from: server});

        });

        const defaultData = {
            roundId: 10,
            gameType: 1,
            num: 80,
            value: BET_VALUE,
            balance: stake.idiv(2),
            serverHash: shash2,
            playerHash: phash2,
            gameId: 1,
            contractAddress: () => contractAddress,
            playerAddress: player,
            serverSeed: shash1,
            playerSeed: phash1,
            signer: server,
            from: player
        };

        it("Should fail if time span too low", async () => {
            const d = defaultData;
            const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), d.signer);

            await gameChannel.playerEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                serverSig,
                d.playerSeed,
                {from: d.from}
            );

            return expect(gameChannel.playerForceGameEnd(d.gameId, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game still active", async () => {
            const d = defaultData;
            return expect(gameChannel.playerForceGameEnd(d.gameId, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it("Should fail if server init end game!", async () => {
            const d = defaultData;
            const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), player);

            await gameChannel.serverEndGameConflict(
                d.roundId,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                d.serverHash,
                d.playerHash,
                d.gameId,
                d.contractAddress(),
                playerSig,
                d.playerAddress,
                d.serverSeed,
                d.playerSeed,
                {from: server}
            );

            await increaseTimeAsync(Math.max(SERVER_TIMEOUT, PLAYER_TIMEOUT));

            return expect(gameChannel.playerForceGameEnd(d.gameId, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
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
                const d = defaultData;
                const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                    d.playerHash, d.gameId, d.contractAddress(), d.signer);

                console.log("Game type", d.gameType);
                await gameChannel.playerEndGameConflict(
                    d.roundId,
                    d.gameType,
                    d.num,
                    d.value,
                    d.balance,
                    d.serverHash,
                    d.playerHash,
                    d.gameId,
                    d.contractAddress(),
                    serverSig,
                    d.playerSeed,
                    {from: d.from}
                );

                await increaseTimeAsync(PLAYER_TIMEOUT);

                const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

                await gameChannel.playerForceGameEnd(d.gameId, {from: player});

                const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = BigNumber.max(calcNewBalance(d.gameType, d.num, d.value, d.serverSeed, d.playerSeed, d.balance)
                        .add(NOT_ENDED_FINE),
                    stake.negated()
                );
                const payout = stake.add(newBalance);

                expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
                expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
                expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

                await checkGameStatusAsync(gameChannel, gameId, GameStatus.ENDED, ReasonEnded.END_FORCED_BY_PLAYER);

                await checkActiveGamesAsync(gameChannel, 0);
            });
        });

        // TODO: Add wrong game id check
    });
});