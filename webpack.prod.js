// See webpack confs in https://github.com/reZach/secure-electron-template
const webpack = require('webpack')
const path = require('path')

module.exports = {
  mode: 'production',
  devtool: 'nosources-source-map',
  target: 'web',
  entry: './src/renderer/index.ts',
  module: {
    rules: [
      {
        test: [/\.tsx?$/],
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-typescript'],
              plugins: [
                ['babel-plugin-inferno', { imports: true }],
                '@babel/plugin-proposal-object-rest-spread',
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-transform-modules-commonjs',
              ],
              ignore: ['**/legacy/', '**/future/'],
            },
          },
          'ts-loader',
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        include: [path.resolve(__dirname, 'node_modules/')],
        resolve: {
          extensions: ['.js', '.jsx', '.json'],
        },
      },
      {
        // For loading frag and vertex shaders via imports in src/renderer/render/webgl
        test: /\.glsl$/,
        type: 'asset/source',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      // TODO(smolck): This'll probably break things in src/renderer, need an
      // actual fix/polyfill/whatever
      fs: false,
      path: require.resolve('path-browserify'),
      util: false,
      net: false,
      child_process: false,
      os: false,
      stream: false,
      dns: false,
    },
  },
  output: {
    path: path.resolve(__dirname, 'build/renderer'),
    filename: 'bundle.js', // The name of the webpack bundle that's generated
  },
}
