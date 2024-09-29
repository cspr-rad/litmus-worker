import { getAccountBalanceData, getAccountInfo, getBlockByHash, getBlockByHeight, getLastBlock } from './fetch';
import wasmInit, { process_query_proofs } from 'casper-litmus-wasm';
import { convertMotesToCSPR, saveAndBroadcast } from './utils';
import { Block } from './interfaces';

wasmInit();

export async function validateAccount(account: string, blockId: string): Promise<void> {
    // Clear previous saved account data
    await saveAndBroadcast({
        account: null,
        balance_motes: null,
        balance_CSPR: null,
        account_state_root_hash: null,
    });
    let block: Block;
    if (blockId) {
        const hexRegex = new RegExp(`^[0-9a-fA-F]{${64}}$`);
        if (hexRegex.test(blockId)) {
            block = await getBlockByHash(blockId);
        } else if (Number.isInteger(Number(blockId))) {
            block = await getBlockByHeight(Number(blockId));
        } else {
            throw Error('Invalid block identifier provided');
        }
    } else {
        block = await getLastBlock();
    }
    const stateRootHash = block.header.state_root_hash;
    const accountResult = await getAccountInfo(account, block.hash);
    const mainPurseURef = await getAccountMainPurse(accountResult);
    const balanceData = await getAccountBalanceData('balance' + mainPurseURef.slice(4, -4), stateRootHash);
    const balance = getBalanceFromMerkleProof(balanceData);
    await saveAndBroadcast({
        account: account,
        balance_motes: balance,
        balance_CSPR: convertMotesToCSPR(BigInt(balance)),
        account_state_root_hash: stateRootHash,
    });
}

export async function getAccountMainPurse(accountData: any): Promise<string> {
    const result = process_query_proofs(accountData.result.merkle_proof, []);
    if (result && result.size > 0) {
        const accountMap = result.get('value')?.get('Account');
        if (accountMap && accountMap.size > 0) {
            const mainPurseURef = accountMap.get('main_purse');
            if (mainPurseURef) {
                return mainPurseURef;
            } else {
                throw Error('Failed to extract main_purse from account data');
            }
        } else {
            throw Error('Failed to extract account information from result');
        }
    } else {
        throw Error('Failed to process Merkle proof or no result data');
    }
}

export function getBalanceFromMerkleProof(balanceData: any): string {
    const result = process_query_proofs(balanceData.result.merkle_proof, []);
    return result.get('value')?.get('CLValue')?.get('parsed');
}
