export default class BlockchainLifecycle {
    private currentProvider: any;
    private snapShotIds: number[];

    constructor(currentProvider: any) {
        this.currentProvider = currentProvider;
        this.snapShotIds = [];
    }

    async takeSnapshotAsync() {
        const snapShotId = await this.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_snapshot',
            params: [],
            id: 42
        }).result;

        this.snapShotIds.push(snapShotId);

    }

    async revertSnapShotAsync() {
        const snapshotId = this.snapShotIds.pop();
        const didRevert =  this.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_revert',
            params: [snapshotId],
            id: 42
        }).result;
        if (!didRevert) {
            throw new Error(`Snapshot with id #${snapshotId} failed to revert!`);
        }
    }
}
