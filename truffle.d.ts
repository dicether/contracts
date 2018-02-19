declare interface Contract<T> {
    "new"(): Promise<T>,

    deployed(): Promise<T>,

    at(address: string): T,
}

interface Artifacts {
    require(name: string): Contract<any>
}

declare const artifacts: Artifacts;

declare type _contractTest = (accounts: string[]) => void;

declare function contract(name: string, test: _contractTest): void;
