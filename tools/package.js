'use strict'

const { $, go, run, fromRoot } = require('./runner')
const { copy, remove, ensureDir } = require('fs-extra')
const { build } = require('electron-builder')

const config = {
  productName: 'uivonim',
  appId: 'com.uivonim.uivonim',
  directories: {
    buildResources: 'art',
  },
  files: ['build/**', '!**/*.map', '!**/.bin'],
  mac: {
    target: ['dmg', 'zip'],
  },
  linux: {
    target: ['appimage', 'zip'],
  },
  win: {
    target: ['portable', 'zip'],
  },
  asar: false,
  publish: false,
}

go(async () => {
  $`cleaning dist (release) folder`
  await remove(fromRoot('dist'))

  $`building uivonim binary for operating system: ${process.platform}`
  await build({ config }).catch(console.error)

  $`fin dist pack`
})
