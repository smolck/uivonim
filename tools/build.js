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

    $`Compiling src/main`
    await run('babel --extensions .ts,.tsx src/main -d build/main')
    $``

    $`Compiling src/common`
    await run('babel --extensions .ts,.tsx src/common -d build/common')
    $``

    $`Running webpack`
    await run('npx webpack --config ./webpack.dev.js')
    $``
  })

module.exports = { paths, copy, copyAll }
