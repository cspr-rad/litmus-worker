import Dexie from 'dexie';

export interface LitmusDatabase extends Dexie {
    switch_blocks: Dexie.Table<SwitchBlockHeight, number>;
    validator_weights: Dexie.Table<ValidatorWeight, [number, string]>;
}

export interface ValidatorWeight {
    era?: number;
    validator: string;
    weight: string;
}

export interface SwitchBlockHeight {
    era: number;
    block_height: number;
    validated: number;
}

export interface Block {
    hash: string;
    header: {
        era_id: number;
        height: number;
        era_end: {
            next_era_validator_weights: ValidatorWeight[]
        }
        state_root_hash: string;
    };
}

export interface ProcessContext {
    processed_count: number;
    total_blocks: number;
    average_time_per_block: number;
    start_time: number;
    blocks?: Block[];
}

export interface RpcRequest {
    jsonrpc: string;
    id: number;
    method: string;
    params: RpcParams;
}

export type RpcParams = {
    block_identifier: {
        Hash?: string;
        Height?: number;
    }
}

export type ValidatorWeightRecord = {
    validator: string;
    weight: string;
};

export type ValidatorWeightsMap = {
    [key: string]: string;
};
