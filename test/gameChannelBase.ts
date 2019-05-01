const GameChannel = artifacts.require("./GameChannel.sol");
import BN from 'bn.js';
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {
    INITIAL_HOUSE_STAKE,
    MAX_STAKE,
    MIN_STAKE,
    PROFIT_TRANSFER_TIMESPAN,
    PROFIT_TRANSFER_TIMESPAN_MAX,
    PROFIT_TRANSFER_TIMESPAN_MIN,
    WITHDRAW_ALL_TIMEOUT,
} from './utils/config';
import {signData} from "./utils/signUtil";
import {
    configureChai,
    createGame,
    getBalance,
    getTransactionCost,
    increaseTimeAsync,
    TRANSACTION_ERROR
} from './utils/util';



configureChai();
const expect = chai.expect;


const hash = '0x0000000000000000000000000000000000000000000000000000000000000001';

const PROFIT = MIN_STAKE;


const createProfitAsync = async (gameChannel: any, user: string, server: string, profit: BN,  createBefore?: number) => {
    const contractAddress = gameChannel.address;
    const gameType = 0;
    const num = 0;
    const value = new BN(0);
    const serverHash = hash;
    const userHash = hash;
    const roundId = 10;
    const balance = profit.neg();

    const result = await createGame(gameChannel, server, user, hash, hash, profit.abs(), createBefore);
    const gameId = result.logs[0].args.gameId.toNumber();


    const sig = await signData(roundId, gameType, num, value, balance, serverHash, userHash, gameId,
            contractAddress, user);

    await gameChannel.serverEndGame(roundId, balance, serverHash, userHash, gameId,
        contractAddress, user, sig, {from: server});
};


contract('GameChannelBase', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const user = accounts[2];
    const notOwner = accounts[3];

    const blockchainLifecycle = new BlockchainLifecycle(web3.currentProvider);

    let gameChannel: any;

    before(async () => {
        gameChannel = await GameChannel.deployed();
        await gameChannel.addHouseStake({from: owner, value: INITIAL_HOUSE_STAKE});
    });

    beforeEach(async () => {
        await blockchainLifecycle.takeSnapshotAsync();
    });

    afterEach(async () => {
        await blockchainLifecycle.revertSnapShotAsync();
    });

    describe('setGameIdCntr', () => {
        it("Should fail if not called by owner", async () => {
            return expect(gameChannel.setGameIdCntr(10, {from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if activated", async () => {
           await gameChannel.activate({from: owner});
           return expect(gameChannel.setGameIdCntr(10, {from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed", async () => {
           await gameChannel.setGameIdCntr(10, {from: owner});
           expect(await gameChannel.gameIdCntr.call()).to.eq.BN(10);
        });
    });


    describe('activated contract tests', () => {
        before(async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
        });

        describe('transferProfitToHouse', () => {
            it("Should fail if wrong timeout 1!", async () => {
                await createProfitAsync(gameChannel, user, server, PROFIT);

                return expect(gameChannel.transferProfitToHouse({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should fail if wrong timeout 2!", async () => {
                await createProfitAsync(gameChannel, user, server, PROFIT);

                await increaseTimeAsync(PROFIT_TRANSFER_TIMESPAN);
                await gameChannel.transferProfitToHouse({from: notOwner});

                await createProfitAsync(gameChannel, user, server, PROFIT, PROFIT_TRANSFER_TIMESPAN + Math.floor(Date.now() / 1000) + 120 * 60);
                return expect(gameChannel.transferProfitToHouse({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should transfer nothing if negative profit", async () => {
                await createProfitAsync(gameChannel, user, server, PROFIT.neg());
                await increaseTimeAsync(PROFIT_TRANSFER_TIMESPAN);

                const houseAddress = await gameChannel.houseAddress.call();

                const prevBalance = await getBalance(houseAddress);
                await gameChannel.transferProfitToHouse({from: notOwner});
                const newBalance = await getBalance(houseAddress);

                expect(newBalance).to.eq.BN(prevBalance);
            });

            it("Should succeed!", async () => {
                const profit = PROFIT;
                const timeSpan = PROFIT_TRANSFER_TIMESPAN;

                await createProfitAsync(gameChannel, user, server, profit);

                const houseAddress = await gameChannel.houseAddress.call();
                const prevBalance = await getBalance(houseAddress);

                await increaseTimeAsync(timeSpan);  // 30days
                await gameChannel.transferProfitToHouse({from: notOwner});

                const newBalance = await getBalance(houseAddress);
                expect(newBalance).to.eq.BN(prevBalance.add(profit));

                const newProfit = await gameChannel.houseProfit.call();
                expect(newProfit).to.eq.BN(0);
            });
        });

        describe('setProfitTransferTimespan', () => {
            const newTimeSpan = (PROFIT_TRANSFER_TIMESPAN_MAX + PROFIT_TRANSFER_TIMESPAN_MIN) / 2;

            it("Should fail if not owner", async () => {
                return expect(gameChannel.setProfitTransferTimeSpan(newTimeSpan, {from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should fail if too low time span", async () => {
                return expect(gameChannel.setProfitTransferTimeSpan(PROFIT_TRANSFER_TIMESPAN_MIN - 1, {from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should fail if too high time span", async () => {
                return expect(gameChannel.setProfitTransferTimeSpan(PROFIT_TRANSFER_TIMESPAN_MAX + 1, {from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should succeed!", async () => {
                await gameChannel.setProfitTransferTimeSpan(newTimeSpan, {from: owner});

                const newTimeSpanSet = await gameChannel.profitTransferTimeSpan.call();
                expect(newTimeSpanSet).to.eq.BN(newTimeSpan);
            });
        });

        describe('withdrawHouseStake', async () => {
            it("Should fail if not owner", async () => {
                return expect(gameChannel.withdrawHouseStake(new BN(1e18.toString()), {from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it('Should fail if below min house stake', async () => {
                await createGame(gameChannel, server, user, hash, hash, MAX_STAKE);
                return expect(gameChannel.withdrawHouseStake(INITIAL_HOUSE_STAKE, {from: owner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it('Should fail if house profit not backed', async () => {
                const profit = PROFIT.neg();
                await createProfitAsync(gameChannel, user, server, profit);

                return expect(gameChannel.withdrawHouseStake(INITIAL_HOUSE_STAKE, {from: owner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it('Should succeed', async () => {
                const prevBalance = await getBalance(owner);
                await gameChannel.withdrawHouseStake(INITIAL_HOUSE_STAKE, {from: owner});
                const afterBalance = await getBalance(owner);

                expect(afterBalance).to.be.gt.BN(prevBalance.add(INITIAL_HOUSE_STAKE)
                    .sub(new BN(1e17.toString()))); // gas price

                const newHouseStake = await gameChannel.houseStake.call();
                expect(newHouseStake).to.eq.BN(0);
            })
        });

        describe('withdrawAll', async () => {
            it("Should fail if not owner", async () => {
                await gameChannel.pause({from: owner});
                await increaseTimeAsync(WITHDRAW_ALL_TIMEOUT);
                return expect(gameChannel.withdrawAll({from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it("Should fail if not paused long enough", async () => {
                await gameChannel.pause({from: owner});
                await increaseTimeAsync(WITHDRAW_ALL_TIMEOUT - 10);
                return expect(gameChannel.withdrawAll({from: owner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it('Should succeed', async () => {
                await gameChannel.pause({from: owner});
                await increaseTimeAsync(WITHDRAW_ALL_TIMEOUT);

                const prevBalanceOwner = await getBalance(owner);
                const prevStakeContract = await gameChannel.houseStake.call();

                const res = await gameChannel.withdrawAll({from: owner});

                const afterBalanceOwner = await getBalance(owner);
                const transactionCost = await getTransactionCost(res.receipt);

                expect(afterBalanceOwner).to.eq.BN(prevBalanceOwner.add(prevStakeContract).sub(transactionCost));

                const newHouseStake = await gameChannel.houseStake.call();
                expect(newHouseStake).to.eq.BN(0);

                const newHouseProfit = await gameChannel.houseProfit.call();
                expect(newHouseProfit).to.eq.BN(0);
            })
        });

        describe('setHouseAddress', async () => {
            it("Should fail if not owner", async () => {
                return expect(gameChannel.setHouseAddress(notOwner, {from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should succeed", async () => {
                await gameChannel.setHouseAddress(notOwner, {from: owner});
                const newHouseAddress = await gameChannel.houseAddress.call();
                expect(newHouseAddress).to.equal(notOwner);
            });
        });

        describe('setStakeRequirements', () => {
            const newMinStake = new BN(1e16.toString());
            const newMaxStake = new BN(1e19.toString());

            it("Should fail if not owner", async () => {
                return expect(gameChannel.setStakeRequirements(newMinStake, newMaxStake, {from: notOwner}))
                    .to.be.rejectedWith(TRANSACTION_ERROR)
            });

            it("Should succeed", async () => {
                await gameChannel.setStakeRequirements(newMinStake, newMaxStake, {from: owner});

                const minStake = await gameChannel.minStake.call();
                const maxStake = await gameChannel.maxStake.call();

                expect(minStake).to.eq.BN(newMinStake);
                expect(maxStake).to.eq.BN(newMaxStake);
            });
        });

        describe('addHouseStake', () => {
            const houseStakeToAdd = new BN('100e18');
            it("Should fail if not owner", async () => {
                return expect(gameChannel.addHouseStake({from: notOwner, value: houseStakeToAdd}))
                    .to.be.rejectedWith(TRANSACTION_ERROR);
            });

            it("Should succeed", async () => {
                const prevHouseStake = await gameChannel.houseStake.call();
                await gameChannel.addHouseStake({from: owner, value: houseStakeToAdd});
                const newHouseStake = await gameChannel.houseStake.call();

                expect(newHouseStake).to.eq.BN(prevHouseStake.add(houseStakeToAdd));
            });
        });
    });

});
