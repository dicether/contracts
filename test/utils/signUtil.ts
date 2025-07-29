import {createTypedData} from "@dicether/state-channel";
import hre from "hardhat";
import {HardhatNetworkHDAccountsConfig} from "hardhat/types/config";
import {Address, Hash, Hex, keccak256, encodePacked} from "viem";
import {mnemonicToAccount} from "viem/accounts";

export async function signData(
    roundId: number,
    gameType: number,
    num: number,
    value: bigint,
    balance: bigint,
    serverHash: Hex,
    userHash: Hex,
    gameId: number,
    contractAddress: Address,
    account: Address,
): Promise<Hex> {
    const bet = {
        roundId,
        gameType,
        num,
        value: Number(value / BigInt(1e9)), // bet data is stored in gwei
        balance: Number(balance / BigInt(1e9)), // bet data is stored in gwei
        serverHash,
        userHash,
        gameId,
    };

    const walletClient = await hre.viem.getWalletClient(account);
    const chainId = await walletClient.getChainId();

    const typedData = createTypedData(bet, chainId, contractAddress, 2);
    const signature = await walletClient.signTypedData({account, ...typedData});

    return signature;
}

export async function signStartData(
    contractAddress: Address,
    user: Address,
    lastGameId: bigint,
    createBefore: bigint,
    serverEndHash: Hash,
    serverAccount: Hash,
): Promise<Hex> {
    const walletClient = await hre.viem.getWalletClient(serverAccount);
    const chainId = await walletClient.getChainId();
    const hash = keccak256(
        encodePacked(
            ["uint", "address", "address", "uint", "uint", "bytes32"],
            [BigInt(chainId), contractAddress, user, lastGameId, createBefore, serverEndHash],
        ),
    );

    const accounts = hre.config.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig;
    if (accounts.mnemonic === undefined) {
        throw new Error("Hardhat network accounts are not configured with a mnemonic");
    }

    for (let i = 0; i < 10; i++) {
        const account = mnemonicToAccount(accounts.mnemonic, {addressIndex: i});
        if (account.address === serverAccount) {
            return account.sign({hash});
        }
    }

    throw new Error(`Server account ${serverAccount} not found in mnemonic accounts`);
}
