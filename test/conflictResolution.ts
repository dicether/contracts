const ConflictResolution = artifacts.require("./ConflictResolution.sol");

import {fromGweiToWei, fromWeiToGwei, maxBetFromProbability, PROBABILITY_DIVISOR} from "@dicether/state-channel";
import * as chai from 'chai';

import {MIN_BANKROLL} from "./utils/config";
import {configureChai} from "./utils/util";


configureChai();
const expect = chai.expect;

contract('ConflictResolution', accounts => {
    let conflictResolution: any;

    before(async () => {
        conflictResolution = await ConflictResolution.deployed();
    });

    describe('maxBet', async () => {
        it("Should return correct result", async () => {
             for (let i = 1; i < 99; i++) {
                const winProbability = Math.round(i * 0.01 * PROBABILITY_DIVISOR);

                const maxBet = await conflictResolution.maxBet.call(winProbability);
                const maxBetShouldBe = maxBetFromProbability(winProbability, fromWeiToGwei(MIN_BANKROLL), 1);

                expect(maxBet).to.be.bignumber.equal(fromGweiToWei(maxBetShouldBe));
             }
        });
    });
});
