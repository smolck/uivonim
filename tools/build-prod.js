const { $, go, run, fromRoot } = require('./runner')
const { copyAll } = require('./build')
const fs = require('fs-extra')

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

  $`Compiling src/render`
  await run('npx webpack --config ./webpack.prod.js')
  $``
})
