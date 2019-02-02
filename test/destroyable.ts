const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, getBalance, getTransactionCost, increaseTimeAsync, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

const DestroyTimeout = 20 * 24 * 60 * 60;


contract('Destroyable', accounts => {
    const owner = accounts[0];
    const notOwner = accounts[1];

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

    describe('destroy', () => {
        it('Should fail if owner calls not paused', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            return expect(gameChannel.destroy({from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should fail if owner calls paused with wrong timeout', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            await gameChannel.pause({from: owner});
            return expect(gameChannel.destroy({from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should fail if non owner calls with correct timeout', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            await gameChannel.pause({from: owner});
            await increaseTimeAsync(DestroyTimeout);
            return expect(gameChannel.destroy({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should succeed of owner call with correct timeout', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            await gameChannel.pause({from: owner});
            await increaseTimeAsync(DestroyTimeout);

            const contractBalance = await getBalance(gameChannel.address);
            const oldBalance = await getBalance(owner);

            const res = await gameChannel.destroy({from: owner});

            const newBalance = await getBalance(owner);
            const transactionCost = await getTransactionCost(res.receipt);

            expect(newBalance).to.eq.BN(oldBalance.add(contractBalance).sub(transactionCost));
        });
    });
});
