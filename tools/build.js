'use strict'

const { $, go, run, fromRoot } = require('./runner')
const fs = require('fs-extra')

const paths = {
  index: 'src/main/index.html',
  processExplorer: 'src/main/process-explorer.html',
}

const copy = {
  index: () => {
    $`copying index html`
    return fs.copy(fromRoot(paths.index), fromRoot('build/main/index.html'))
  },
  processExplorer: () => {
    $`copying process-explorer html`
    return fs.copy(
      fromRoot(paths.processExplorer),
      fromRoot('build/main/process-explorer.html')
    )
  },
  assets: () => {
    $`copying assets`
    return fs.copy(fromRoot('src/assets'), fromRoot('build/assets'))
  },
  runtime: () => {
    $`copying runtime files`
    return fs.copy(fromRoot('runtime'), fromRoot('build/runtime'))
  },
}

const copyAll = () =>
  Promise.all([
    copy.index(),
    copy.processExplorer(),
    copy.assets(),
    copy.runtime(),
  ])

require.main === module &&
  go(async () => {
    $`cleaning build folder`
    await fs.emptyDir(fromRoot('build'))
    await copyAll()

    $`Running babel`
    await run('babel --extensions .ts,.tsx src -d build')

    $`Running webpack`
    await run('npx webpack --config ./webpack.dev.js')
  })

module.exports = { paths, copy, copyAll }
