const GameChannel = artifacts.require("./GameChannel.sol");
import BigNumber from 'bignumber.js';
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {HOUSE_STAKE, MAX_STAKE, MIN_STAKE, signData} from './utils/stateChannel';
import {configureChai, increaseTimeAsync, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;


const hash = '0x0000000000000000000000000000000000000000000000000000000000000001';

const PROFIT = MIN_STAKE;


const createProfitAsync = async (gameChannel: any, player: string, server: string, profit: BigNumber) => {
    const contractAddress = gameChannel.address;
    const gameType = 0;
    const num = 0;
    const value = new BigNumber(0);
    const serverHash = hash;
    const playerHash = hash;
    const roundId = 10;
    const balance = profit.negated();

    const result = await gameChannel.createGame(hash, {from: player, value: profit.abs()});
    const gameId = result.logs[0].args.gameId;
    await gameChannel.acceptGame(player, gameId, hash, {from: server});

    const sig = signData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
            contractAddress, player);

    await gameChannel.serverEndGame(roundId, gameType, num, value, balance, serverHash, playerHash, gameId,
        contractAddress, player, sig, {from: server});
};


contract('GameChannelBase', accounts => {
    const owner = accounts[0];
    const server = accounts[1];
    const player = accounts[2];
    const notOwner = accounts[3];

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

    describe('transferProfitToHouse', () => {
        it("Should fail if wrong timeout 1!", async () => {
            await createProfitAsync(gameChannel, player, server, PROFIT);

            return expect(gameChannel.transferProfitToHouse({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if wrong timeout 2!", async () => {
            await createProfitAsync(gameChannel, player, server, PROFIT);

            await increaseTimeAsync(3 * 30 * 24 * 60 * 60);  // 30days
            await gameChannel.transferProfitToHouse({from: notOwner});

            await createProfitAsync(gameChannel, player, server, PROFIT);
            return expect(gameChannel.transferProfitToHouse({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should transfer nothing if negative profit", async () => {
            await createProfitAsync(gameChannel, player, server, PROFIT.negated());
            await increaseTimeAsync(3 * 30 * 24 * 60 * 60);  // 30days

            const houseAddress = await gameChannel.houseAddress.call();

            const prevBalance = await web3.eth.getBalance(houseAddress);
            await gameChannel.transferProfitToHouse({from: notOwner});
            const newBalance = await web3.eth.getBalance(houseAddress);

            expect(newBalance).to.be.bignumber.equal(prevBalance);
        });

        // it("Should fail if house stake too low!", async () => {
        //
        // });

        it("Should succeed!", async () => {
            const profit = PROFIT;
            const timeSpan = 3 * 30 * 24 * 60 * 60;

            await createProfitAsync(gameChannel, player, server, profit);

            const houseAddress = await gameChannel.houseAddress.call();
            const prevBalance = await web3.eth.getBalance(houseAddress);

            await increaseTimeAsync(timeSpan);  // 30days
            await gameChannel.transferProfitToHouse({from: notOwner});

            const newBalance = await web3.eth.getBalance(houseAddress);
            expect(newBalance).to.be.bignumber.equal(prevBalance.add(profit));

            const newProfit = await gameChannel.houseProfit.call();
            expect(newProfit).to.be.bignumber.equal(0);
        });
    });

    describe('setProfitTransferTimespan', () => {
        const MIN_TIME_SPAN = 30 * 24 * 60 * 60;
        const MAX_TIME_SPAN = 6 * 30 * 24 * 60 * 60;

        it("Should fail if not owner", async () => {
            return expect(gameChannel.setProfitTransferTimeSpan(3 * 30 * 24 * 60 * 60, {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if too low time span", async () => {
            return expect(gameChannel.setProfitTransferTimeSpan(MIN_TIME_SPAN - 1, {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should fail if too high time span", async () => {
            return expect(gameChannel.setProfitTransferTimeSpan(MAX_TIME_SPAN + 1, {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed!", async () => {
            const newTimeSpan = 30 * 24 * 60 * 60;
            await gameChannel.setProfitTransferTimeSpan(newTimeSpan, {from: owner});

            const newTimeSpanSet = await gameChannel.profitTransferTimeSpan.call();
            expect(newTimeSpanSet).to.be.bignumber.equal(newTimeSpan);
        });
    });

    describe('withdrawHouseStake', async () => {
        it("Should fail if not owner", async () => {
            return expect(gameChannel.withdrawHouseStake(new BigNumber('1e18'), {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it('Should fail if below min house stake', async () => {
            await gameChannel.createGame(hash, {from: player, value: MAX_STAKE});
            return expect(gameChannel.withdrawHouseStake(HOUSE_STAKE, {from: owner}))
                .to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it('Should fail if house profit not backed', async () => {
            const profit = PROFIT.negated();
            await createProfitAsync(gameChannel, player, server, profit);

            return expect(gameChannel.withdrawHouseStake(HOUSE_STAKE, {from: owner}))
                .to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it('Should succeed', async () => {
            const prevBalance = await web3.eth.getBalance(owner);
            await gameChannel.withdrawHouseStake(HOUSE_STAKE, {from: owner});
            const afterBalance = await web3.eth.getBalance(owner);

            expect(afterBalance).to.be.bignumber.greaterThan(prevBalance.add(HOUSE_STAKE)
                .sub('0.1e18').toNumber()); // gas price

            const newHouseStake = await gameChannel.houseStake.call();
            expect(newHouseStake).to.be.bignumber.equal(0);
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
        const newMinStake = new BigNumber('1e16');
        const newMaxStake = new BigNumber('1e19');

        it("Should fail if not owner", async () => {
            return expect(gameChannel.setStakeRequirements(newMinStake, newMaxStake, {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR)
        });

        it("Should succeed", async () => {
            await gameChannel.setStakeRequirements(newMinStake, newMaxStake, {from: owner});

            const minStake = await gameChannel.minStake.call();
            const maxStake = await gameChannel.maxStake.call();

            expect(minStake).to.be.bignumber.equal(newMinStake);
            expect(maxStake).to.be.bignumber.equal(newMaxStake);
        });
    });

    describe('addHouseStake', () => {
        const houseStakeToAdd = new BigNumber('100e18');
        it("Should fail if not owner", async () => {
            return expect(gameChannel.addHouseStake({from: notOwner, value: houseStakeToAdd}))
                .to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should succeed", async () => {
            const prevHouseStake = await gameChannel.houseStake.call();
            await gameChannel.addHouseStake({from: owner, value: houseStakeToAdd});
            const newHouseStake = await gameChannel.houseStake.call();

            expect(newHouseStake).to.be.bignumber.equal(prevHouseStake.add(houseStakeToAdd));
        });
    });
});
