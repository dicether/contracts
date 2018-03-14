const GameChannel = artifacts.require("./GameChannel.sol");
import BigNumber from 'bignumber.js';
import * as chai from 'chai';
import * as leche from 'leche';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {
    calcNewBalance,
    GameStatus,
    GameType,
    MAX_BALANCE,
    MIN_STAKE,
    NOT_ENDED_FINE,
    PLAYER_TIMEOUT,
    ReasonEnded,
    SERVER_TIMEOUT,
    signData
} from './utils/stateChannel';
import {configureChai, increaseTimeAsync, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

const withData = leche.withData;


const ZERO_SEED = "0x0000000000000000000000000000000000000000000000000000000000000000";

const phash1 = web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000001",
        {encoding: "hex"});
const phash2 = web3.sha3(phash1,
        {encoding: "hex"});
const phash3 = web3.sha3(phash2,
        {encoding: "hex"});

const shash1 = web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000002",
        {encoding: "hex"});
const shash2 = web3.sha3(shash1,
        {encoding: "hex"});
const shash3 = web3.sha3(shash2,
        {encoding: "hex"});



async function checkGameStatusAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number) {
      // check game session state
    const game = await gameChannel.gameIdGame.call(gameId);
    const status = game[0].toNumber();
    const reasonEnded = game[1].toNumber();

    expect(status).to.equal(statusRef);
    expect(reasonEnded).to.equal(reasonEndedRef);
}


async function checkGameStateAsync(gameChannel: any, gameId: number, statusRef: number, reasonEndedRef: number,
                                   gameTypeRef: number, roundIdRef: number, numRef: number, betValueRef: BigNumber,
                                   balanceRef: BigNumber, playerSeedRef: string, serverSeedRef: string) {
    const game = await gameChannel.gameIdGame.call(gameId);

    const status = game[0].toNumber();
    const reasonEnded = game[1].toNumber();
    const gameType = game[3].toNumber();
    const roundId = game[4].toNumber();
    const betNum = game[5].toNumber();
    const betValue = game[6];
    const balance = game[7];
    const playerSeed = game[8];
    const serverSeed = game[9];

    expect(status).to.equal(statusRef);
    expect(reasonEnded).to.equal(reasonEndedRef);
    expect(gameType).to.equal(gameTypeRef);
    expect(roundId).to.equal(roundIdRef);
    expect(betNum).to.equal(numRef);
    expect(betValue).to.be.bignumber.equal(betValueRef);
    expect(balance).to.be.bignumber.equal(balanceRef);
    expect(playerSeed).to.equal(playerSeedRef);
    expect(serverSeed).to.equal(serverSeedRef);
}

async function checkActiveGamesAsync(gameChannel: any, activeGamesRef: number) {
    const activeGames = await gameChannel.activeGames.call();
    expect(activeGames).to.be.bignumber.equal(activeGamesRef);
}


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
        const stake = MIN_STAKE;

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
            value: new BigNumber('1e17'),
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
                GameType.DICE,
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
                GameType.DICE,
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
                GameType.DICE,
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
        const stake = MIN_STAKE;

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
            value: new BigNumber('1e17'),
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
                GameType.DICE,
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
                GameType.DICE,
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

    describe('serverCancelActiveGame', () => {
        const gameId = 1;
        const stake = MIN_STAKE;

        beforeEach(async () => {
            await gameChannel.createGame(phash3, {from: player, value: stake});
            await gameChannel.acceptGame(player, gameId, shash3, {from: server});

        });

        it("Should fail if wrong gameId", async () => {
            await gameChannel.createGame(phash3, {from: player2, value: stake});
            await gameChannel.acceptGame(player2, 2, shash3, {from: server});

            return expect(gameChannel.serverCancelActiveGame(player, 2, {from: server})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if game status not active", async () => {
            await gameChannel.playerCancelActiveGame(1, {from: player});

            return expect(gameChannel.playerCancelActiveGame(2, {from: player})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong player address", async () => {
            await gameChannel.createGame(phash3, {from: player2, value: stake});
            await gameChannel.acceptGame(player2, 2, shash3, {from: server});

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
        const stake = MIN_STAKE;
        
        beforeEach(async () => {
            await gameChannel.createGame(phash3, {from: player, value: stake});
            await gameChannel.acceptGame(player, gameId, shash3, {from: server});
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
            const reasonEnded = game[1].toNumber();

            expect(status).to.equal(3); // player initiated end
            expect(reasonEnded).to.equal(0); // not ended

            await checkGameStatusAsync(gameChannel, gameId, GameStatus.PLAYER_INITIATED_END, ReasonEnded.REGULAR_ENDED);

            await checkActiveGamesAsync(gameChannel, 1);
        });
    });

    describe('serverForceGameEnd', async () => {
        const gameId = 1;
        const stake = MIN_STAKE;

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
            value: new BigNumber('1e17'),
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
        const stake = MIN_STAKE;

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
            value: new BigNumber('1e17'),
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

        it("Force end should succeed", async () => {
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

            await increaseTimeAsync(PLAYER_TIMEOUT);

            const contractBalanceBefore = await web3.eth.getBalance(gameChannel.address);
            const houseProfitBefore = await gameChannel.houseProfit.call();
            const houseStakeBefore = await gameChannel.houseStake.call();

            await gameChannel.playerForceGameEnd(d.gameId, {from: player});

            const contractBalanceAfter = await web3.eth.getBalance(gameChannel.address);
            const houseProfitAfter= await gameChannel.houseProfit.call();
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

        // TODO: Add wrong game id check
    });
});
