import {promisify} from "util";
import {HttpProvider as Provider} from "web3-core";

export default class BlockchainLifecycle {
    private currentProvider: Provider;
    private snapShotIds: number[];

    constructor(currentProvider: any) {
        this.currentProvider = currentProvider;
        this.snapShotIds = [];
    }

    async takeSnapshotAsync(): Promise<void> {
        const send = promisify(this.currentProvider.send);
        const res: any = await send({
            jsonrpc: "2.0",
            method: "evm_snapshot",
            params: [],
            id: 42,
        });
        const snapShotId = res.result;

        this.snapShotIds.push(snapShotId);
    }

    async revertSnapShotAsync(): Promise<void> {
        const snapshotId = this.snapShotIds.pop();
        const send = promisify(this.currentProvider.send);
        const res: any = await send({
            jsonrpc: "2.0",
            method: "evm_revert",
            params: [snapshotId],
            id: 42,
        });
        const didRevert = res.result;

        if (!didRevert) {
            throw new Error(`Snapshot with id #${snapshotId} failed to revert!`);
        }
    }
}
