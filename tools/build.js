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

const typescriptThing =
  'Object.defineProperty(exports, "__esModule", { value: true });'

const fixTypescript = async () => {
  const dirs = await getDirFiles(fromRoot('build'))
  const filesReq = dirs.reduce((files, dir) => {
    return [...files, getDirFiles(dir.path)]
  }, [])

  const dirfiles = await Promise.all(filesReq)
  const files = dirfiles.reduce((files, fileGroup) => {
    return [...files, ...fileGroup.map((f) => f.path)]
  }, [])

  const jsFiles = files.filter((f) => path.extname(f) === '.js')

  const requests = jsFiles.map(async (f) => {
    const filedata = await fs.readFile(f, 'utf8')
    const fixed = filedata.replace(typescriptThing, '')
    return fs.writeFile(f, fixed)
  })

  return Promise.all(requests)
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
    await run('ttsc -p src/tsconfig.json')
    await fixTypescript()
    await copyAll()
  })

module.exports = { paths, copy, copyAll, fixTypescript }
