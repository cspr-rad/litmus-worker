import {process_query_proofs} from 'casper-litmus-wasm';

export async function validateMerkleProof(merkleProof: string): Promise<any> {
    return process_query_proofs(merkleProof, []);
}