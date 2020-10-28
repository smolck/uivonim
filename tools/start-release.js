'use strict'

const { go, run } = require('./runner')

go(async () => {
  // TODO(smolck): Maybe verify `npm run build` has been run first somehow?
  run('electron build/bootstrap/main.js', {
    shh: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })
})
