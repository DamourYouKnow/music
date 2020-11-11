import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {uglify} from 'rollup-plugin-uglify';

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

export default function() {
    const prod = process.env.BUILD === 'production' ? true : false;
    console.log(`Building ${prod ? 'prod' : 'dev'}`);

    return {
        input: './src/client/app.ts',
        output: {
            input: 'src/client/app.ts',
            file: 'public/scripts/app.js',
            format: 'iife',
            sourcemap: prod ? undefined : 'inline'
        },
        plugins: [
            resolve({extensions}),
            commonjs(),
            typescript({
                module: 'es2015',
                target: 'es5',
                strict: true,
                moduleResolution: 'node',
                allowSyntheticDefaultImports: true,
                sourceMap: !prod,
                inlineSourceMap: !prod,
                inlineSources: !prod
            }),
            ...(prod ? [uglify()] : [])
        ],
    }
};