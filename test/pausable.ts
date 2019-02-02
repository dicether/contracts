const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, TRANSACTION_ERROR} from './utils/util';

configureChai();
const expect = chai.expect;


contract('Pausable', accounts => {
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

    describe('pause', () => {
        it('Should fail if non owner calls pause', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            return expect(gameChannel.pause({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should pause contract', async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            await gameChannel.pause({from: owner});
            expect(await gameChannel.paused.call()).to.equal(true);
            // expect(await gameChannel.timePaused.call()).to.eq.BN();
        });
    });

    describe('unpause', () => {
        it("Should fail if non owner calls unpause", async () => {
            await gameChannel.activate({from: owner});
            return expect(gameChannel.unpause({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should fail if non activated', async () => {
            return expect(gameChannel.unpause({from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it("Should unpause contract", async () => {
            await gameChannel.activate({from: owner});
            await gameChannel.unpause({from: owner});
            expect(await gameChannel.paused.call()).to.equal(false);
            expect(await gameChannel.timePaused.call()).to.eq.BN(0);
        });
    });
});
