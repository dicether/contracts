const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

contract('Ownable', accounts => {
    const owner = accounts[0];
    const notOwner = accounts[1];
    const newOwner = accounts[2];

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

    it('Initial owner should be set', async () => {
        return expect(await gameChannel.owner.call()).to.equal(owner);
    });

    it('Should fail if non owner sets new owner', async () => {
        return expect(gameChannel.setOwner(newOwner, {from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it('New owner should be settable by owner', async () => {
        await gameChannel.setOwner(newOwner, {from: owner});
        expect(await gameChannel.owner.call()).to.equal(newOwner);
    })
});
