const GameChannel = artifacts.require("./GameChannel.sol");
import * as chai from 'chai';

import BlockchainLifecycle from './utils/BlockchainLifecycle';
import {configureChai, increaseTimeAsync, TRANSACTION_ERROR} from './utils/util';


configureChai();
const expect = chai.expect;

const ConflictResUpdateMinTimeout = 3 * 24 * 60 * 60;
const ConflictResUpdateMaxTimeout = 6 * 24 * 60 * 60;


contract('ConflictResolutionManager', accounts => {
    const owner = accounts[0];
    const notOwner = accounts[1];
    const newConflictResolutionContractAddress1 = accounts[4];
    const newConflictResolutionContractAddress2 = accounts[5];

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

    describe('update ConflictResolution', () => {
        it('Should fail if non owner updates conflict resolution contract', async () => {
            return expect(gameChannel.updateConflictResolution(newConflictResolutionContractAddress1, {from: notOwner}))
                .to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('New conflict resolution address should be settable by owner', async () => {
            await gameChannel.updateConflictResolution(newConflictResolutionContractAddress1, {from: owner});
            expect(await gameChannel.newConflictRes.call()).to.equal(newConflictResolutionContractAddress1);
        });

    });

    describe('activate ConflictResolution', () => {
        it('Should fail if owner activates before min timeout', async () => {
            await gameChannel.updateConflictResolution(newConflictResolutionContractAddress1, {from: owner});
            return expect(gameChannel.activateConflictResolution({from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should fail if non owner activates after min timeout', async () => {
            await gameChannel.updateConflictResolution(newConflictResolutionContractAddress1, {from: owner});
            await increaseTimeAsync(ConflictResUpdateMinTimeout);
            return expect(gameChannel.activateConflictResolution({from: notOwner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('Should fail if owner activates after max timeout', async () => {
            await gameChannel.updateConflictResolution(newConflictResolutionContractAddress1, {from: owner});
            await increaseTimeAsync(ConflictResUpdateMaxTimeout + 1);
            return expect(gameChannel.activateConflictResolution({from: owner})).to.be.rejectedWith(TRANSACTION_ERROR);
        });

        it('New conflict resolution address can be activated by owner', async () => {
            await gameChannel.updateConflictResolution(newConflictResolutionContractAddress2, {from: owner});
            await increaseTimeAsync(ConflictResUpdateMinTimeout + 1);
            await gameChannel.activateConflictResolution({from: owner});
            expect(await gameChannel.conflictRes.call()).to.equal(newConflictResolutionContractAddress2);
        });
    });
});
