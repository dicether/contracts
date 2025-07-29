import {buildModule} from "@nomicfoundation/hardhat-ignition/modules";

import ConflictResolutionModule from "./ConflictResolutionDeployment";

const GameChannelModule = buildModule("GameChannel", (m) => {
    const {conflictResolution} = m.useModule(ConflictResolutionModule);
    const gameChannel = m.contract("GameChannel", [
        m.getAccount(1),
        m.getParameter("minStake"),
        m.getParameter("maxStake"),
        conflictResolution,
        m.getAccount(2),
    ]);
    return {gameChannel};
});

export default GameChannelModule;
