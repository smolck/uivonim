// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require('webpack')
const path = require('path')

module.exports = {
  // target: "web", // Our app can run without electron
  entry: './src/renderer/index.ts',
  module: {
    rules: [
      // loads .ts/tsx files
      {
        test: /\.tsx?$/,
        // include: [path.resolve(__dirname, "src/renderer")],
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      /*// loads .css files
      {
        test: /\.css$/,
        include: [
          path.resolve(__dirname, "app/src"),
          path.resolve(__dirname, "node_modules/"),
        ],
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader"
        ],
        resolve: {
          extensions: [".css"]
        }
      }*/
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts'],
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
