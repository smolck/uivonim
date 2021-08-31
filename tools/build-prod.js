const { $, go, run, fromRoot } = require('./runner')
const { copyAll } = require('./build')
const fs = require('fs-extra')

go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))
  await copyAll()

  $`Compiling src/render`
  await run('npx webpack --config ./webpack.prod.js')
  $``
})
