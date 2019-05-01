import {createTypedData, signBet} from "@dicether/state-channel";
import BN from "bn.js";
import * as ethSigUtil from "eth-sig-util";
import * as ethAbi from "ethereumjs-abi";
import * as ethUtil from "ethereumjs-util";
import {promisify} from "util";

const publicPrivateKeyMap: {[id: string]: string} = {
    '0x26006236eaB6409D9FDECb16ed841033d6B4A6bC': '0x1ce6a4cc4c9941a4781349f988e129accdc35a55bb3d5b1a7b342bc2171db484',
    '0xA8D5f39F3ccD4795B0E38FeAcb4f2EE22486CA44': '0xc7ab5af90a9373bdd03d5708cfba1a4117dbd204237b90d55e9842c71e631d97',
    '0x3596ddf5181c9F6Aa1bcE87D967Bf227DDE70ddf': '0xa4471ac58369b9df99f5d9e4ff4170e5a068db13ee23a0c5af8731245fc174c2',
    '0x79182b3fa375cE9c8A4C3c611594aaf38A508477': '0xdcaf0add96529d56e5411e4108f17fdb30dfe64bb1575229c8dfa325ceb6c045',
    '0x3C9a6014424cBdeea0D75CBaa752FC0A1fEfe327': '0x2c88b2e35ce934d91a9fe78be093471eb66ee78a9fe7499a247c465c80446879'
};

export async function signData(roundId: number, gameType: number, num: number, value: BN, balance: BN,
                         serverHash: string, userHash: string, gameId: number, contractAddress: string,
                         account: string): Promise<string> {
    const bet =  {
        roundId,
        gameType,
        num,
        value: value.div(new BN(1e9)).toNumber(), // bet data is stored in gwei
        balance: balance.div(new BN(1e9)).toNumber(), // bet data is stored in gwei
        serverHash,
        userHash,
        gameId,
    };

    const typedData = createTypedData(bet, 123456789, contractAddress, 2);
    const send = promisify(web3.currentProvider.send);
    const res: any = await send({
        jsonrpc: '2.0',
        method: "eth_signTypedData",
        params: [account, typedData],
        id: 42
    });

    return res.result;
}

export function signStartData(contractAddress: string,
                              user: string,
                              lastGameId: number,
                              createBefore: number,
                              serverEndHash: string,
                              serverAccount: string): string {
    const hash = ethAbi.soliditySHA3(
        ['address', 'address', 'uint', 'uint', 'bytes32'],
        [contractAddress, user, lastGameId, createBefore, ethUtil.toBuffer(serverEndHash)]
    );

    if (!(serverAccount in publicPrivateKeyMap)) {
        throw Error("Invalid account! You need to run ganache with --mnemonic \"test\"");
    }

    const privKey = publicPrivateKeyMap[serverAccount];

    const sig = ethUtil.ecsign(hash, ethUtil.toBuffer(privKey));
    return ethSigUtil.concatSig(sig.v, sig.r, sig.s);
}