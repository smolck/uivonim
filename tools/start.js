'use strict'

const { $, go, run, fromRoot, createTask } = require('./runner')
const { copy, copyAll, fixTypescript } = require('./build')
const fs = require('fs-extra')

go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))
  await copyAll()

  const tsc = createTask()

  run('tsc -p src/tsconfig.json --watch --preserveWatchOutput', {
    outputMatch: 'watching for file changes',
    onOutputMatch: async () => {
      await fixTypescript()
      copy.index()
      copy.processExplorer()
      tsc.done()
    },
  })

  await tsc.promise

  run('electron build/bootstrap/main.js', {
    shh: true,
    env: {
      ...process.env,
      VEONIM_DEV: 42,
    },
  })
})
