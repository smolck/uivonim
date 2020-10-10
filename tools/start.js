'use strict'

const { $, go, run, fromRoot } = require('./runner')
const { copyAll } = require('./build')
const fs = require('fs-extra')

go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))
  await copyAll()

  $`running babel stuff`
  await run("babel --extensions '.ts,.tsx' src -d build")

  run('electron build/bootstrap/main.js', {
    shh: true,
    env: {
      ...process.env,
      VEONIM_DEV: 42,
    },
  })
})
