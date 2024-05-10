import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    mode: 'production',
    entry: './src/service-worker.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.wasm$/,
                type: 'asset/resource',
            },
        ],
    },
    experiments: {
        outputModule: true,
        asyncWebAssembly: true,
        syncWebAssembly: false
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        publicPath: 'auto',
        filename: 'service-worker.js',
        path: path.resolve(__dirname, 'dist'),
        chunkFormat: 'array-push',
        clean: true
    },
    target: 'webworker'
};
