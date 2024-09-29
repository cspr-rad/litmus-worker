import type {Config} from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    testMatch: ['**/tests/**/*.test.(ts|js)'],
    moduleNameMapper: {
        '^litmus-wasm$': '<rootDir>/../litmus-wasm/pkg/casper_litmus_wasm.js'
    }
};

export default config;
