import BigNumber from 'bignumber.js';
import * as ethSigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';


export const RANGE = 100;
export const HOUSE_EDGE = 150;
export const HOUSE_EDGE_DIVISOR = 10000;

export enum GameStatus {
    ENDED = 0,
    ACTIVE = 1,
    WAITING_FOR_SERVER = 2,
    PLAYER_INITIATED_END = 3,
    SERVER_INITIATED_END = 4
}

export enum ReasonEnded {
    REGULAR_ENDED = 0,
    END_FORCED_BY_SERVER = 1,
    END_FORCED_BY_PLAYER = 2,
    REJECTED_BY_SERVER = 3,
    CANCELLED_BY_PLAYER = 4
}

export enum GameType {
   NO_GAME = 0,
   DICE = 1
}

export const HOUSE_STAKE = new BigNumber('100e18');
export const MIN_STAKE = new BigNumber('1e17');
export const MAX_STAKE = new BigNumber('1e18');
export const MIN_VALUE = new BigNumber('1e13');
export const MAX_VALUE = new BigNumber('2e16');
export const MAX_BALANCE = MAX_VALUE.mul(500);

export const NOT_ENDED_FINE = new BigNumber('1e15');

export const SERVER_TIMEOUT = 2 * 24 * 3600;
export const PLAYER_TIMEOUT = 2 * 24 * 3600;

const publicPrivateKeyMap: {[id: string]: string} = {
    '0x26006236eab6409d9fdecb16ed841033d6b4a6bc': '0x1ce6a4cc4c9941a4781349f988e129accdc35a55bb3d5b1a7b342bc2171db484',
    '0xa8d5f39f3ccd4795b0e38feacb4f2ee22486ca44': '0xc7ab5af90a9373bdd03d5708cfba1a4117dbd204237b90d55e9842c71e631d97',
    '0x3596ddf5181c9f6aa1bce87d967bf227dde70ddf': '0xa4471ac58369b9df99f5d9e4ff4170e5a068db13ee23a0c5af8731245fc174c2',
    '0x79182b3fa375ce9c8a4c3c611594aaf38a508477': '0xdcaf0add96529d56e5411e4108f17fdb30dfe64bb1575229c8dfa325ceb6c045',
    '0x3c9a6014424cbdeea0d75cbaa752fc0a1fefe327': '0x2c88b2e35ce934d91a9fe78be093471eb66ee78a9fe7499a247c465c80446879'
};


export function createTypedData(roundId: number, gameType: number, num: number, value: BigNumber, balance: BigNumber,
                                serverHash: string, playerHash: string, gameId: number, contractAddress: string) {
    return [
        {
            'type': 'uint32',
            'name': "Round Id",
            'value': roundId
        },
        {
            'type': 'uint8',
            'name': 'Game Type',
            'value': gameType
        },
        {
            'type': 'uint16',
            'name': 'Number',
            'value': num
        },
        {
            'type': 'uint',
            'name': 'Value (Wei)',
            'value': value.toString()
        },
        {
            'type': 'int',
            'name': 'Current Balance (Wei)',
            'value': balance.toString()
        },
        {
            'type': 'bytes32',
            'name': 'Server Hash',
            'value': ethUtil.toBuffer(serverHash)
        },
        {
            'type': 'bytes32',
            'name': 'Player Hash',
            'value': ethUtil.toBuffer(playerHash)
        },
        {
            'type': 'uint',
            'name': 'Game Id',
            'value': gameId.toString()
        },
        {
            'type': 'address',
            'name': 'Contract Address',
            'value': contractAddress
        }
    ];
}


export function calcResultNumber(gameType: number, serverSeed: string, playerSeed: string): number {
    const serverSeedBuf = ethUtil.toBuffer(serverSeed);
    const playerSeedBuf = ethUtil.toBuffer(playerSeed);

    const seed = ethUtil.sha3(Buffer.concat([serverSeedBuf, playerSeedBuf]));
    const hexSeed = seed.toString('hex');
    const rand = new BigNumber(hexSeed, 16);

    return rand.mod(new BigNumber(RANGE)).toNumber();
}


export function calcPlayerProfit(gameType: number, betValue: BigNumber, num: number, won: boolean): BigNumber {
    if (won) {
        // player won
        const betValueGwei = betValue.idiv(new BigNumber('1e9')); // calculate in gwei

        const totalWon = betValueGwei.mul(new BigNumber(RANGE)).idiv(new BigNumber(num));
        const houseEdge = totalWon.mul(new BigNumber(HOUSE_EDGE)).idiv(new BigNumber(HOUSE_EDGE_DIVISOR));

        return totalWon.sub(houseEdge).sub(betValueGwei).mul(1e9);
    } else {
        return betValue.negated();
    }
}

export function calcNewBalance(gameType: number, num: number, betValue: BigNumber, serverSeed: string, playerSeed: string,
                               oldBalance: BigNumber): BigNumber {
    const resultNum = calcResultNumber(gameType, serverSeed, playerSeed);

    // calculated in gwei
    const profit = calcPlayerProfit(gameType, betValue, num, resultNum < num);

    return profit.add(oldBalance);
}

export function signData(roundId: number, gameType: number, num: number, value: BigNumber, balance: BigNumber,
                         serverHash: string, playerHash: string, gameId: number, contractAddress: string,
                         account: string): string {
    const typedData = createTypedData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId, contractAddress);
    const msgParams = {data: typedData};

    if (!(account in publicPrivateKeyMap)) {
        throw Error("Invalid account! You need to run ganache with --mnemonic \"test\"");
    }
    const privKey = publicPrivateKeyMap[account];

    return ethSigUtil.signTypedData(ethUtil.toBuffer(privKey), msgParams);
}

export function recoverData(roundId: number, gameType: number, num: number, value: BigNumber, balance: BigNumber,
                            serverHash: string, playerHash: string, gameId: number, contractAddress: string,
                            signature: string): string {
    const typedData = createTypedData(roundId, gameType, num, value, balance, serverHash, playerHash, gameId, contractAddress);

    return ethSigUtil.recoverTypedData({data: typedData, sig: signature});
}
