import type {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "chai-as-promised";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.11",
        settings: {
            optimizer: {
                runs: 200,
                enabled: true,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 123456789,
        },
        intTest: {
            url: "http://localhost:8546",
        },
    },
};

export default config;
