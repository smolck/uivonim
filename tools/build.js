'use strict'

const { $, go, run, fromRoot, getDirFiles } = require('./runner')
const path = require('path')
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
  hyperapp: () => {
    $`copying hyperapp`
    return fs.copy(
      fromRoot('src/ui/hyperapp.js'),
      fromRoot('build/ui/hyperapp.js')
    )
  },
}

const copyAll = () =>
  Promise.all([
    copy.index(),
    copy.processExplorer(),
    copy.assets(),
    copy.runtime(),
    copy.hyperapp(),
  ])

require.main === module &&
  go(async () => {
    $`cleaning build folder`
    await fs.emptyDir(fromRoot('build'))
    await copyAll()
    await run('babel --extensions \'.ts,.tsx\' src -d build')
  })

module.exports = { paths, copy, copyAll }
