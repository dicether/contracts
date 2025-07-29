import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";
import {Address, Hash} from "viem";

import {signStartData} from "./signUtil";

export async function getTransactionCost(hash: Hash): Promise<bigint> {
    const client = await hre.viem.getPublicClient();
    const tx = await client.getTransaction({hash});
    const txReceipt = await client.getTransactionReceipt({hash});

    const gasPrice = tx.gasPrice!;
    const gasUsed = txReceipt.gasUsed;

    return gasPrice * gasUsed;
}

export async function createGame(
    contract: ContractTypesMap["GameChannel"],
    serverAddress: Address,
    userAddress: Address,
    serverEndHash: Hash,
    userEndHash: Hash,
    userStake: bigint,
    createBefore = BigInt(Math.floor(Date.now() / 1000) + 120 * 60),
): Promise<Hash> {
    const lastGameId = await contract.read.userGameId([userAddress]);

    const sig = await signStartData(
        contract.address,
        userAddress,
        lastGameId,
        createBefore,
        serverEndHash,
        serverAddress,
    );

    return contract.write.createGame([userEndHash, lastGameId, createBefore, serverEndHash, sig], {
        account: userAddress,
        value: userStake,
    });
}

export async function getBalance(address: Address): Promise<bigint> {
    return await (await hre.viem.getPublicClient()).getBalance({address: address});
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function maxBigInt(...args: bigint[]): bigint {
    return args.reduce((max, val) => (max < val ? val : max), args[0]);
}
