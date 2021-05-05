const { $, go, run, fromRoot } = require('./runner')
const { copyAll } = require('./build')
const fs = require('fs-extra')

go(async () => {
  $`cleaning build folder`
  await fs.emptyDir(fromRoot('build'))
  await copyAll()

  $`Running babel`
  await run('babel --extensions .ts,.tsx src -d build')

  $`Running webpack`
  await run('npx webpack --config ./webpack.prod.js')
})
