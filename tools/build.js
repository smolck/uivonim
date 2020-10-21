'use strict'

const { $, go, run, fromRoot, } = require('./runner')
const fs = require('fs-extra')

const paths = {
  index: 'src/bootstrap/index.html',
  processExplorer: 'src/bootstrap/process-explorer.html',
}

const copy = {
  index: () => {
    $`copying index html`
    return fs.copy(
      fromRoot(paths.index),
      fromRoot('build/bootstrap/index.html')
    )
  },
  processExplorer: () => {
    $`copying process-explorer html`
    return fs.copy(
      fromRoot(paths.processExplorer),
      fromRoot('build/bootstrap/process-explorer.html')
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
    await run("babel --extensions '.ts,.tsx' src -d build")
  })

module.exports = { paths, copy, copyAll }
