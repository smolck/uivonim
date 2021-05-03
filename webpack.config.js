// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require('webpack')
const path = require('path')

module.exports = {
  mode: 'development',
  stats: {
    errorDetails: true
  },
  target: "web", // Our app can run without electron
  entry: './src/renderer/index.ts',
  module: {
    rules: [
      // loads .ts/tsx files
      {
        test: [/\.tsx?$/],
        // include: [path.resolve(__dirname, "src/renderer")],
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // loads .js files
      {
        test: /\.js$/,
        include: [path.resolve(__dirname, 'node_modules/')],
        resolve: {
          extensions: [".js", ".jsx", ".json"]
        }
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      // TODO(smolck): This'll probably break things in src/renderer, need an
      // actual fix/polyfill/whatever
      fs: false,
      path: false,
      util: false,
      net: false,
      child_process: false,
      os: false,
      stream: false,
      dns: false,
      'process/browser.js': false,
    },
  },
  output: {
    path: path.resolve(__dirname, 'build/renderer'),
    filename: 'bundle.js', // The name of the webpack bundle that's generated
  },
  plugins: [
    // fix "process is not defined" error;
    // https://stackoverflow.com/a/64553486/1837080
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
    }),
  ],
}