'use strict'

const compareImages = require('resemblejs/compareImages')
const { Application } = require('spectron')
const { delay, pathExists } = require('../util')
const fs = require('fs-extra')
const path = require('path')

const snapshotMode = process.argv.includes('--snapshot')
console.log('snapshotMode', snapshotMode)

module.exports = async () => {
  const projectPath = path.join(__dirname, '../data')
  const resultsPath = path.join(__dirname, '../../results')
  const snapshotsPath = path.join(__dirname, '../snapshots')

  fs.ensureDir(resultsPath)
  if (snapshotMode) fs.emptyDir(snapshotsPath)

  const app = new Application({
    path: './node_modules/.bin/electron',
    args: [path.join(__dirname, '../../build/bootstrap/main.js')],
  })

  await app.start()
  await app.client.waitUntilWindowLoaded()
  await delay(500)

  app.input = async (m) => {
    await delay(100)
    await app.client.keys(m)
  }

  app.input.enter = () => app.input('Enter')
  app.input.esc = () => app.input('Escape')

  app.input.meta = async (m) => {
    await app.input('\uE03D')
    await app.input(m)
    await app.input('\uE03D')
  }

  app.veonimAction = async (cmd) => {
    await app.input(`:Veonim ${cmd}`)
    await app.input.enter()
  }

  app.screencap = async (name) => {
    await delay(200)
    const imageBuf = await app.browserWindow.capturePage().catch(console.error)
    if (!imageBuf) return console.error(`faild to screencap "${name}"`)
    const location = path.join(resultsPath, `${name}.png`)
    fs.writeFile(location, imageBuf)
    await delay(100)
    return imageBuf
  }

  app.snapshotTest = async (name) => {
    const imageBuf = await app.screencap(name)
    const snapshotLocation = path.join(snapshotsPath, `${name}.png`)

    if (snapshotMode) {
      fs.writeFile(snapshotLocation, imageBuf)
      return 0
    }

    const snapshotExists = await pathExists(snapshotLocation)
    if (!snapshotExists)
      throw new Error(
        `snapshot "${name}" does not exist. generate snapshots with "--snapshot" flag`
      )

    const diff = await compareImages(
      imageBuf,
      await fs.readFile(snapshotLocation)
    )

    if (diff.rawMisMatchPercentage > 0) {
      fs.writeFile(path.join(resultsPath, `${name}-diff.png`), diff.getBuffer())
    }

    return diff.rawMisMatchPercentage
  }

  await app.input(`:cd ${projectPath}`)
  await app.input.enter()

  return app
}
