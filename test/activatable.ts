const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, TRANSACTION_ERROR} from './utils/util';

configureChai();
const expect = chai.expect;


contract('Activatable', accounts => {
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

    describe('activate', () => {
        it('Should initial not be activated', async () => {
            expect(await gameChannel.activated.call()).to.equal(false);
        });

        it('Should fail if non owner calls activate', async () => {
            return expect(gameChannel.activate({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should succeed', async () => {
            await gameChannel.activate({from: owner});
            expect(await gameChannel.activated.call()).to.equal(true);
        });
    });
});
