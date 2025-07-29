import {buildModule} from "@nomicfoundation/hardhat-ignition/modules";

const ConflictResolutionModule = buildModule("ConflictResolution", (m) => {
    const diceLower = m.contract("DiceLower");
    const diceHigher = m.contract("DiceHigher");
    const chooseFrom12 = m.contract("ChooseFrom12");
    const flipACoin = m.contract("FlipACoin");
    const keno = m.contract("Keno");
    const wheel = m.contract("Wheel");
    const plinko = m.contract("Plinko");

    const conflictResolution = m.contract("ConflictResolution", [
        [diceLower, diceHigher, chooseFrom12, flipACoin, keno, wheel, plinko],
    ]);

    return {conflictResolution};
});

export default ConflictResolutionModule;
