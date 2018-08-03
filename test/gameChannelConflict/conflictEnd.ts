import {
    calcNewBalance,
    GameStatus,
    GameType,
    ReasonEnded,
    fromWeiToGwei,
    fromGweiToWei
} from '@dicether/state-channel';
import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from '../utils/BlockchainLifecycle';
import {CONFLICT_END_FINE, HOUSE_STAKE, MAX_BALANCE, MAX_STAKE} from "../utils/config";
import {signData} from "../utils/signUtil";
import {configureChai, createGame, TRANSACTION_ERROR} from '../utils/util';

import {
    BET_VALUE,
    checkGameStateAsync,
    checkGameStatusAsync,
    phash1,
    phash2,
    phash3,
    shash1,
    shash2,
    shash3,
    ZERO_SEED
} from "./util";


const GameChannel = artifacts.require("./GameChannel.sol");


configureChai();
const expect = chai.expect;

const withData = leche.withData;


contract('GameChannelConflict', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const user = accounts[2];
    const user2 = accounts[3];

    const blockchainLifecycle = new BlockchainLifecycle(web3.currentProvider);
    let gameChannel: any;

    before(async () => {
        gameChannel = await GameChannel.deployed();
        await gameChannel.addHouseStake({from: owner, value: HOUSE_STAKE});
        await gameChannel.activate({from: owner});
        await gameChannel.unpause({from: owner});
    });

    beforeEach(async () => {
        await blockchainLifecycle.takeSnapshotAsync();
    });

    afterEach(async () => {
        await blockchainLifecycle.revertSnapShotAsync();
    });


    describe('serverEndConflict', () => {
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

        withData({
                'not server': {
                    ...defaultData, from: user2
                },
                'wrong round Id': {
                    ...defaultData, roundId: 0
                },
                'wrong sig': {
                    ...defaultData, signer: user2
                },
                'wrong user seed': {
                    ...defaultData, userSeed: phash2,
                },
                'wrong server seed': {
                    ...defaultData, serverSeed: shash2,
                },
                'wrong game type': {
                    ...defaultData, gameType: 0,
                },
                'too low number game type 1': {
                    ...defaultData, gameType: 1, num: 0,
                },
                'too high number game type 1': {
                    ...defaultData, gameType: 1, num: 99,
                },
                'too low number game type 2': {
                    ...defaultData, gameType: 1, num: 0,
                },
                'too high number game type 2': {
                    ...defaultData, gameType: 1, num: 99,
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
                    const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.userHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.serverEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        withData({
                'wrong user address': {
                    ...defaultData, userAddress: user2
                },
                'wrong game id': {
                    ...defaultData, gameId: 2
                },
            }, (d: typeof defaultData) => {
                it("Should fail", async () => {
                    await createGame(gameChannel, server, user2, shash3, phash3, stake);
                    const userSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.userHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.serverEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        it("Should succeed", async () => {
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
                d.userSeed,
                d.serverSeed
            );
        });

        it("Should succeed after user called cancelActiveGame!", async () => {
            const d = defaultData;

            await gameChannel.userCancelActiveGame(d.gameId, {from: user});

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
                d.userSeed,
                d.serverSeed
            );
        });

        it("Should succeed after user called conflict game with lower roundId!", async () => {
            const d = defaultData;

            const serverSig = signData(d.roundId - 1, d.gameType, d.num, d.value, d.balance, shash3,
                phash3, d.gameId, d.contractAddress(), server);

            await gameChannel.userEndGameConflict(
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
                {from: user}
            );

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
                d.userSeed,
                d.serverSeed
            );
        });

        withData({
            'game type 1 num 1': {
                ...defaultData, gameType: 1, num: 1
            },
            'game type 2 num 1': {
                ...defaultData, gameType: 2, num: 1
            },
            'game type 1 num 98': {
                ...defaultData, gameType: 1, num: 98
            },
            'game type 2 num 98': {
                ...defaultData, gameType: 2, num: 98
            }
        }, (d: typeof defaultData) => {
            it("Should succeed after user called conflict game with same roundId!", async () => {

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

                const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

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

                const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = BigNumber.max(
                    fromGweiToWei(calcNewBalance(
                        d.gameType,
                        d.num,
                        fromWeiToGwei(d.value),
                        d.serverSeed,
                        d.userSeed,
                        fromWeiToGwei(d.balance)
                    )).sub(CONFLICT_END_FINE),
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

    describe('userEndConflict', () => {
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
            userSeed: phash1,
            serverSeed: shash1,
            signer: server,
            from: user
        };

        withData({
                'wrong user': {
                    ...defaultData, from: user2
                },
                'wrong round Id': {
                    ...defaultData, roundId: 0
                },
                'wrong sig': {
                    ...defaultData, signer: user2
                },
                'wrong user seed': {
                    ...defaultData, userSeed: phash2,
                },
                'wrong game type': {
                    ...defaultData, gameType: 0,
                },
                'too low number game type 1': {
                    ...defaultData, gameType: 1, num: 0,
                },
                'too high number game type 1': {
                    ...defaultData, gameType: 1, num: 99,
                },
                'too low number game type 2': {
                    ...defaultData, gameType: 1, num: 0,
                },
                'too high number game type 2': {
                    ...defaultData, gameType: 1, num: 99,
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
            }, (d: typeof defaultData) => {
                it("Should fail", async () => {
                    const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                        d.userHash, d.gameId, d.contractAddress(), d.signer);

                    return expect(gameChannel.userEndGameConflict(
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
                    )).to.be.rejectedWith(TRANSACTION_ERROR);
                });
            }
        );

        it("Should succeed after server called cancelActiveGame!", async () => {
            const d = defaultData;

            await gameChannel.serverCancelActiveGame(user, d.gameId, {from: server});

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.USER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.userSeed,
                ZERO_SEED
            );
        });

        it("Should succeed after server called conflict game with lower roundId!", async () => {
            const d = defaultData;

            const userSig = signData(d.roundId - 1, d.gameType, d.num, d.value, d.balance, shash3,
                phash3, d.gameId, d.contractAddress(), user);

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
                userSig,
                user,
                shash2,
                phash2,
                {from: server}
            );

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

            await checkGameStateAsync(
                gameChannel,
                d.gameId,
                GameStatus.USER_INITIATED_END,
                ReasonEnded.REGULAR_ENDED,
                GameType.DICE_LOWER,
                d.roundId,
                d.num,
                d.value,
                d.balance,
                d.userSeed,
                ZERO_SEED
            );
        });

        withData({
            'game type 1 num 1': {
                ...defaultData, gameType: 1, num: 1
            },
            'game type 2 num 1': {
                ...defaultData, gameType: 2, num: 1
            },
            'game type 1 num 98': {
                ...defaultData, gameType: 1, num: 98
            },
            'game type 2 num 98': {
                ...defaultData, gameType: 2, num: 98
            }
        }, (d: typeof defaultData) => {
            it("Should succeed after user called conflict game with same roundId!", async () => {
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
                    user,
                    d.serverSeed,
                    d.userSeed,
                    {from: server}
                );

                const serverSig = signData(d.roundId, d.gameType, d.num, d.value, d.balance, d.serverHash,
                    d.userHash, d.gameId, d.contractAddress(), d.signer);

                const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
                const houseProfitBefore = await gameChannel.houseProfit.call();
                const houseStakeBefore = await gameChannel.houseStake.call();

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

                const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
                const houseProfitAfter = await gameChannel.houseProfit.call();
                const houseStakeAfter = await gameChannel.houseStake.call();

                // check new balances (profit, stake, contract balance)
                const newBalance = BigNumber.max(
                    fromGweiToWei(calcNewBalance(
                        d.gameType,
                        d.num,
                        fromWeiToGwei(d.value),
                        d.serverSeed,
                        d.userSeed,
                        fromWeiToGwei(d.balance)
                    )).sub(CONFLICT_END_FINE),
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
});
