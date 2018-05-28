const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, TRANSACTION_ERROR, ZERO_ADDRESS} from './utils/util';


configureChai();
const expect = chai.expect;

contract('Ownable', accounts => {
    const owner = accounts[0];
    const notOwner = accounts[1];
    const newOwner1 = accounts[2];
    const newOwner2 = accounts[3];


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
        expect(await gameChannel.owner.call()).to.equal(owner);
    });

    it('Initial pending owner should be set to 0 ', async () => {
        expect(await gameChannel.pendingOwner.call()).to.equal(ZERO_ADDRESS);
    });

    it('Should fail if non owner sets new pending owner', async () => {
        return expect(gameChannel.transferOwnership(newOwner1, {from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it('New pending owner should be settable by owner', async () => {
        await gameChannel.transferOwnership(newOwner1, {from: owner});
        expect(await gameChannel.pendingOwner.call()).to.equal(newOwner1);
        await gameChannel.transferOwnership(newOwner2, {from: owner});
        expect(await gameChannel.pendingOwner.call()).to.equal(newOwner2);
    });

    it('Non pending owner should not be able to claim ownership', async () => {
        await gameChannel.transferOwnership(newOwner1, {from: owner});
        return expect(gameChannel.claimOwnership({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
    });

    it('Pending owner should be able to claim ownership', async () => {
        await gameChannel.transferOwnership(newOwner1, {from: owner});
        await gameChannel.claimOwnership({from: newOwner1});
        expect(await gameChannel.owner.call()).to.equal(newOwner1);
        expect(await gameChannel.pendingOwner.call()).to.equal(ZERO_ADDRESS);
    })
});
