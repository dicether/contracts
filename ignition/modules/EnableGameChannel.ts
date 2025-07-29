import {buildModule} from "@nomicfoundation/hardhat-ignition/modules";

import GameChannelModule from "./GameChannelDeployment";

const EnableGameChannelModule = buildModule("EnableGameChannel", (m) => {
    const {gameChannel} = m.useModule(GameChannelModule);

    m.call(gameChannel, "addHouseStake", [], {value: m.getParameter("houseStake")});
    m.call(gameChannel, "activate");
    m.call(gameChannel, "unpause");

    return {gameChannel};
});

export default EnableGameChannelModule;
