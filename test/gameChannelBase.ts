import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import hre from "hardhat";
import {ContractTypesMap} from "hardhat/types";
import {Address, decodeEventLog} from "viem";

import {enableGameChannelFixture, gameChannelFixture} from "./gameChannelFixture";
import {
    INITIAL_HOUSE_STAKE,
    MAX_STAKE,
    MIN_STAKE,
    PROFIT_TRANSFER_TIMESPAN,
    PROFIT_TRANSFER_TIMESPAN_MAX,
    PROFIT_TRANSFER_TIMESPAN_MIN,
    WITHDRAW_ALL_TIMEOUT,
} from "./utils/config";
import {signData} from "./utils/signUtil";
import {createGame, getBalance, getTransactionCost} from "./utils/util";

const hash = "0x0000000000000000000000000000000000000000000000000000000000000001";
const REVERT_WITHOUT_REASON = "Transaction reverted without a reason";

const PROFIT = MIN_STAKE;

const createProfitAsync = async (
    gameChannel: ContractTypesMap["GameChannel"],
    user: Address,
    server: Address,
    profit: bigint,
    createBefore?: bigint,
) => {
    const contractAddress = gameChannel.address;
    const gameType = 0;
    const num = 0;
    const value = 0n;
    const serverHash = hash;
    const userHash = hash;
    const roundId = 10;
    const balance = -profit;

    const transactionHash = await createGame(
        gameChannel,
        server,
        user,
        hash,
        hash,
        profit < 0n ? -profit : profit,
        createBefore,
    );
    const client = await hre.viem.getPublicClient();
    const receipt = await client.getTransactionReceipt({hash: transactionHash});

    const decoded = decodeEventLog({
        abi: gameChannel.abi,
        eventName: "LogGameCreated",
        data: receipt.logs[0].data,
        topics: receipt.logs[0].topics,
    });
    const gameId = decoded.args.gameId;

    const sig = await signData(
        roundId,
        gameType,
        num,
        value,
        balance,
        serverHash,
        userHash,
        Number(gameId),
        contractAddress,
        user,
    );

    await gameChannel.write.serverEndGame(
        [roundId, balance, serverHash, userHash, gameId, contractAddress, user, sig],
        {
            account: server,
        },
    );
};

describe("GameChannelBase", () => {
    before(async () => {
        await hre.network.provider.send("hardhat_reset");
    });

    describe("setGameIdCntr", () => {
        it("Should fail if not called by owner", async () => {
            const {gameChannel, other} = await loadFixture(gameChannelFixture);
            await expect(gameChannel.write.setGameIdCntr([10n], {account: other})).to.be.rejectedWith(
                REVERT_WITHOUT_REASON,
            );
        });

        it("Should fail if activated", async () => {
            const {gameChannel, owner} = await loadFixture(gameChannelFixture);
            await gameChannel.write.activate({account: owner});
            await expect(gameChannel.write.setGameIdCntr([10n], {account: owner})).to.be.rejectedWith(
                REVERT_WITHOUT_REASON,
            );
        });

        it("Should succeed", async () => {
            const {gameChannel, owner} = await loadFixture(gameChannelFixture);
            await gameChannel.write.setGameIdCntr([10n], {account: owner});
            expect(await gameChannel.read.gameIdCntr()).to.eq(10n);
        });
    });

    describe("activated contract tests", () => {
        describe("transferProfitToHouse", () => {
            it("Should fail if wrong timeout 1!", async () => {
                const {gameChannel, other2: user, server, other} = await loadFixture(enableGameChannelFixture);
                await createProfitAsync(gameChannel, user, server, PROFIT);

                await expect(gameChannel.write.transferProfitToHouse({account: other})).to.be.rejectedWith(
                    REVERT_WITHOUT_REASON,
                );
            });

            it("Should fail if wrong timeout 2!", async () => {
                const {gameChannel, other2: user, server, other} = await loadFixture(enableGameChannelFixture);
                await createProfitAsync(gameChannel, user, server, PROFIT);

                await time.increase(PROFIT_TRANSFER_TIMESPAN);
                await gameChannel.write.transferProfitToHouse({account: other});

                await createProfitAsync(
                    gameChannel,
                    user,
                    server,
                    PROFIT,
                    BigInt(PROFIT_TRANSFER_TIMESPAN + Math.floor(Date.now() / 1000) + 120 * 60),
                );
                await expect(gameChannel.write.transferProfitToHouse({account: other})).to.be.rejectedWith(
                    REVERT_WITHOUT_REASON,
                );
            });

            it("Should transfer nothing if negative profit", async () => {
                const {gameChannel, other2: user, server, other} = await loadFixture(enableGameChannelFixture);
                await createProfitAsync(gameChannel, user, server, -PROFIT);
                await time.increase(PROFIT_TRANSFER_TIMESPAN);

                const houseAddress = await gameChannel.read.houseAddress();

                const prevBalance = await getBalance(houseAddress);
                await gameChannel.write.transferProfitToHouse({account: other});
                const newBalance = await getBalance(houseAddress);

                expect(newBalance).to.eq(prevBalance);
            });

            it("Should succeed!", async () => {
                const {gameChannel, other2: user, server, other} = await loadFixture(enableGameChannelFixture);
                const profit = PROFIT;
                const timeSpan = PROFIT_TRANSFER_TIMESPAN;

                await createProfitAsync(gameChannel, user, server, profit);

                const houseAddress = await gameChannel.read.houseAddress();
                const prevBalance = await getBalance(houseAddress);

                await time.increase(timeSpan); // 30days
                await gameChannel.write.transferProfitToHouse({account: other});

                const newBalance = await getBalance(houseAddress);
                expect(newBalance).to.eq(prevBalance + profit);

                const newProfit = await gameChannel.read.houseProfit();
                expect(newProfit).to.eq(0n);
            });
        });

        describe("setProfitTransferTimespan", () => {
            const newTimeSpan = BigInt((PROFIT_TRANSFER_TIMESPAN_MAX + PROFIT_TRANSFER_TIMESPAN_MIN) / 2);

            it("Should fail if not owner", async () => {
                const {gameChannel, other} = await loadFixture(enableGameChannelFixture);
                await expect(
                    gameChannel.write.setProfitTransferTimeSpan([newTimeSpan], {account: other}),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should fail if too low time span", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await expect(
                    gameChannel.write.setProfitTransferTimeSpan([BigInt(PROFIT_TRANSFER_TIMESPAN_MIN - 1)], {
                        account: owner,
                    }),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should fail if too high time span", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await expect(
                    gameChannel.write.setProfitTransferTimeSpan([BigInt(PROFIT_TRANSFER_TIMESPAN_MAX + 1)], {
                        account: owner,
                    }),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should succeed!", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.setProfitTransferTimeSpan([newTimeSpan], {account: owner});

                const newTimeSpanSet = await gameChannel.read.profitTransferTimeSpan();
                expect(newTimeSpanSet).to.eq(newTimeSpan);
            });
        });

        describe("withdrawHouseStake", () => {
            it("Should fail if not owner", async () => {
                const {gameChannel, other} = await loadFixture(enableGameChannelFixture);
                await expect(gameChannel.write.withdrawHouseStake([BigInt(1e18)], {account: other})).to.be.rejectedWith(
                    REVERT_WITHOUT_REASON,
                );
            });

            it("Should fail if below min house stake", async () => {
                const {gameChannel, owner, server, other: user} = await loadFixture(enableGameChannelFixture);
                await createGame(gameChannel, server, user, hash, hash, MAX_STAKE);
                await expect(
                    gameChannel.write.withdrawHouseStake([INITIAL_HOUSE_STAKE], {account: owner}),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should fail if house profit not backed", async () => {
                const {gameChannel, owner, server, other: user} = await loadFixture(enableGameChannelFixture);
                const profit = -PROFIT;
                await createProfitAsync(gameChannel, user, server, profit);

                await expect(
                    gameChannel.write.withdrawHouseStake([INITIAL_HOUSE_STAKE], {account: owner}),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should succeed", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                const prevBalance = await getBalance(owner);
                await gameChannel.write.withdrawHouseStake([INITIAL_HOUSE_STAKE], {account: owner});
                const afterBalance = await getBalance(owner);

                expect(afterBalance > prevBalance + INITIAL_HOUSE_STAKE - BigInt(1e17)).to.be.true; // gas price

                const newHouseStake = await gameChannel.read.houseStake();
                expect(newHouseStake).to.eq(0n);
            });
        });

        describe("withdrawAll", () => {
            it("Should fail if not owner", async () => {
                const {gameChannel, owner, other} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.pause({account: owner});
                await time.increase(WITHDRAW_ALL_TIMEOUT);
                await expect(gameChannel.write.withdrawAll({account: other})).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should fail if not paused long enough", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.pause({account: owner});
                await time.increase(WITHDRAW_ALL_TIMEOUT - 10);
                await expect(gameChannel.write.withdrawAll({account: owner})).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should succeed", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.pause({account: owner});
                await time.increase(WITHDRAW_ALL_TIMEOUT);

                const prevBalanceOwner = await getBalance(owner);
                const prevStakeContract = await gameChannel.read.houseStake();

                const res = await gameChannel.write.withdrawAll({account: owner});

                const afterBalanceOwner = await getBalance(owner);
                const transactionCost = await getTransactionCost(res);

                expect(afterBalanceOwner).to.eq(prevBalanceOwner + prevStakeContract - transactionCost);

                const newHouseStake = await gameChannel.read.houseStake();
                expect(newHouseStake).to.eq(0n);

                const newHouseProfit = await gameChannel.read.houseProfit();
                expect(newHouseProfit).to.eq(0n);
            });
        });

        describe("setHouseAddress", () => {
            it("Should fail if not owner", async () => {
                const {gameChannel, other, other2} = await loadFixture(enableGameChannelFixture);
                await expect(gameChannel.write.setHouseAddress([other2], {account: other})).to.be.rejectedWith(
                    REVERT_WITHOUT_REASON,
                );
            });

            it("Should succeed", async () => {
                const {gameChannel, other, owner} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.setHouseAddress([other], {account: owner});
                const newHouseAddress = await gameChannel.read.houseAddress();
                expect(newHouseAddress).to.equal(other);
            });
        });

        describe("setStakeRequirements", () => {
            const newMinStake = BigInt(1e16);
            const newMaxStake = BigInt(1e19);

            it("Should fail if not owner", async () => {
                const {gameChannel, other} = await loadFixture(enableGameChannelFixture);
                await expect(
                    gameChannel.write.setStakeRequirements([newMinStake, newMaxStake], {account: other}),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should succeed", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                await gameChannel.write.setStakeRequirements([newMinStake, newMaxStake], {account: owner});

                const minStake = await gameChannel.read.minStake();
                const maxStake = await gameChannel.read.maxStake();

                expect(minStake).to.eq(newMinStake);
                expect(maxStake).to.eq(newMaxStake);
            });
        });

        describe("addHouseStake", () => {
            const houseStakeToAdd = 100n * 10n ** 18n;
            it("Should fail if not owner", async () => {
                const {gameChannel, other} = await loadFixture(enableGameChannelFixture);
                await expect(
                    gameChannel.write.addHouseStake({account: other, value: houseStakeToAdd}),
                ).to.be.rejectedWith(REVERT_WITHOUT_REASON);
            });

            it("Should succeed", async () => {
                const {gameChannel, owner} = await loadFixture(enableGameChannelFixture);
                const prevHouseStake = await gameChannel.read.houseStake();
                await gameChannel.write.addHouseStake({account: owner, value: houseStakeToAdd});
                const newHouseStake = await gameChannel.read.houseStake();

                expect(newHouseStake).to.eq(prevHouseStake + houseStakeToAdd);
            });
        });
    });
});
