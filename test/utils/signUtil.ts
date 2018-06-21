import {signBet} from "@dicether/state-channel";
import BigNumber from "bignumber.js";
import * as ethSigUtil from "eth-sig-util";
import * as ethAbi from "ethereumjs-abi";
import * as ethUtil from "ethereumjs-util";

const publicPrivateKeyMap: {[id: string]: string} = {
    '0x26006236eab6409d9fdecb16ed841033d6b4a6bc': '0x1ce6a4cc4c9941a4781349f988e129accdc35a55bb3d5b1a7b342bc2171db484',
    '0xa8d5f39f3ccd4795b0e38feacb4f2ee22486ca44': '0xc7ab5af90a9373bdd03d5708cfba1a4117dbd204237b90d55e9842c71e631d97',
    '0x3596ddf5181c9f6aa1bce87d967bf227dde70ddf': '0xa4471ac58369b9df99f5d9e4ff4170e5a068db13ee23a0c5af8731245fc174c2',
    '0x79182b3fa375ce9c8a4c3c611594aaf38a508477': '0xdcaf0add96529d56e5411e4108f17fdb30dfe64bb1575229c8dfa325ceb6c045',
    '0x3c9a6014424cbdeea0d75cbaa752fc0a1fefe327': '0x2c88b2e35ce934d91a9fe78be093471eb66ee78a9fe7499a247c465c80446879'
};

export function signData(roundId: number, gameType: number, num: number, value: BigNumber, balance: BigNumber,
                         serverHash: string, userHash: string, gameId: number, contractAddress: string,
                         account: string): string {

    if (!(account in publicPrivateKeyMap)) {
        throw Error("Invalid account! You need to run ganache with --mnemonic \"test\"");
    }
    const privKey = publicPrivateKeyMap[account] as string;

    const bet =  {
        roundId,
        gameType,
        num,
        value: value.dividedToIntegerBy(1e9).toNumber(), // bet data is stored in gwei
        balance: balance.dividedToIntegerBy(1e9).toNumber(), // bet data is stored in gwei
        serverHash,
        userHash,
        gameId,
    };

    const privKeyBuf = ethUtil.toBuffer(privKey);
    return signBet(bet, 123456789, contractAddress, privKeyBuf, 1);

}

export function signStartData(contractAddress: string,
                              player: string,
                              lastGameId: number,
                              createBefore: number,
                              serverEndHash: string,
                              serverAccount: string): string {
    const hash = ethAbi.soliditySHA3(
        ['address', 'address', 'uint', 'uint', 'bytes32'],
        [contractAddress, player, lastGameId, createBefore, ethUtil.toBuffer(serverEndHash)]
    );

    if (!(serverAccount in publicPrivateKeyMap)) {
        throw Error("Invalid account! You need to run ganache with --mnemonic \"test\"");
    }

    const privKey = publicPrivateKeyMap[serverAccount];

    const sig = ethUtil.ecsign(hash, ethUtil.toBuffer(privKey));
    return ethSigUtil.concatSig(sig.v, sig.r, sig.s);
}