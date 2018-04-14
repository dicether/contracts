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


    describe('serverEndConflict', () => {
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

        withData({
                'not server': {
                    ...defaultData, from: player2
                },
                'wrong round Id': {
                    ...defaultData, roundId: 0
                },
                'wrong sig': {
                    ...defaultData, signer: player2
                },
                'wrong player seed': {
                    ...defaultData, playerSeed: phash2,
                },
                'wrong server seed': {
                    ...defaultData, serverSeed: shash2,
                },
                'wrong game type': {
                    ...defaultData, gameType: 0,
                },
                'too low number': {
                    ...defaultData, num: 0,
                },
                'too high number': {
                    ...defaultData, num: 100,
                },
                'too low balance': {
                    ...defaultData, balance: stake.negated().sub(1)
                },
                'too high balance': {
                    ...defaultData, balance: MAX_BALANCE.add(1)
                },
                'wrong contract address': {
                    ...defaultData, contractAddress: () => accounts[4],
                },
            }, (d: typeof defaultData) => {
                it("Should fail", async () => {
                    const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.playerHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.serverEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        withData({
                'wrong player address': {
                    ...defaultData, playerAddress: player2
                },
                'wrong game id': {
                    ...defaultData, gameId: 2
                },
            }, (d: typeof defaultData)  => {
                it("Should fail", async () => {
                    await gameChannel.createGame(phash3, {from: player2, value: stake});
                    await gameChannel.acceptGame(player2, 2, shash3, {from: server});
                    const playerSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.playerHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.serverEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        it("Should succeed", async () => {
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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.SERVER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.playerSeed,
                d.serverSeed
            );
        });

        it("Should succeed after player called cancelActiveGame!", async () => {
            const d = defaultData;

            await gameChannel.playerCancelActiveGame(d.gameId, {from: player});

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.SERVER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.playerSeed,
                d.serverSeed
            );
        });

        it("Should succeed after player called conflict game with lower roundId!", async () => {
            const d = defaultData;

            const serverSig = signData(d.roundId -1, d.gameType, d.num, d.value, d.balance, shash3,
                phash3, d.gameId, d.contractAddress(), server);

            await gameChannel.playerEndGameConflict(
                d.roundId - 1,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                shash3,
                phash3,
                d.gameId,
                d.contractAddress(),
                serverSig,
                phash2,
                {from: player}
            );

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.SERVER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.playerSeed,
                d.serverSeed
            );
        });

        it("Should succeed after player called conflict game with same roundId!", async () => {
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

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

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

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const newBalance = BigNumber.max(
                calcNewBalance(d.gameType, d.num, d.value, d.serverSeed, d.playerSeed, d.balance),
                stake.negated()
            );
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

            await checkGameStatusAsync(gameChannel, d.gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);
        })
    });

    describe('playerEndConflict', () => {
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
            playerSeed: phash1,
            serverSeed: shash1,
            signer: server,
            from: player
        };

        withData({
                'wrong player': {
                    ...defaultData, from: player2
                },
                'wrong round Id': {
                    ...defaultData, roundId: 0
                },
                'wrong sig': {
                    ...defaultData, signer: player2
                },
                'wrong player seed': {
                    ...defaultData, playerSeed: phash2,
                },
                'wrong game type': {
                    ...defaultData, gameType: 0,
                },
                'too low number': {
                    ...defaultData, num: 0,
                },
                'too high number': {
                    ...defaultData, num: 100,
                },
                'too low balance': {
                    ...defaultData, balance: stake.negated().add(1)
                },
                'too high balance': {
                    ...defaultData, balance: MAX_BALANCE.add(1)
                },
                'wrong contract address': {
                    ...defaultData, contractAddress: () => accounts[4],
                },
            }, (d: typeof defaultData)  => {
                it("Should fail", async () => {
                    const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.playerHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.playerEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        it("Should succeed after server called cancelActiveGame!", async () => {
            const d = defaultData;

            await gameChannel.serverCancelActiveGame(player, d.gameId, {from: server});

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.PLAYER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.playerSeed,
                ZERO_SEED
            );
        });

        it("Should succeed after server called conflict game with lower roundId!", async () => {
            const d = defaultData;

            const playerSig = signData(d.roundId -1, d.gameType, d.num, d.value, d.balance, shash3,
                phash3, d.gameId, d.contractAddress(), player);

            await gameChannel.serverEndGameConflict(
                d.roundId - 1,
                d.gameType,
                d.num,
                d.value,
                d.balance,
                shash3,
                phash3,
                d.gameId,
                d.contractAddress(),
                playerSig,
                player,
                shash2,
                phash2,
                {from: server}
            );

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.PLAYER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.playerSeed,
                ZERO_SEED
            );
        });

        it("Should succeed after player called conflict game with same roundId!", async () => {
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
                player,
                d.serverSeed,
                d.playerSeed,
                {from: server}
            );

            const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                d.playerHash, d.gameId, d.contractAddress(), d.signer);

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

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

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
            const houseStakeAfter = await gameChannel.houseStake.call();

            // check new balances (profit, stake, contract balance)
            const newBalance = BigNumber.max(
                calcNewBalance(d.gameType, d.num, d.value, d.serverSeed, d.playerSeed, d.balance),
                stake.negated()
            );
            const payout = stake.add(newBalance);

            expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(payout));
            expect(houseProfitAfter).to.be.bignumber.equal(houseProfitBefore.sub(newBalance));
            expect(houseStakeAfter).to.be.bignumber.equal(houseStakeBefore.sub(newBalance));

            await checkGameStatusAsync(gameChannel, d.gameId, GameStatus.ENDED, ReasonEnded.REGULAR_ENDED);
        })
    });
});
