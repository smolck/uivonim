'use strict'

const { deepStrictEqual: eq } = require('assert')
const launch = require('./launcher')
const { delay } = require('../util')

const snapshotTester = (m) => async (name) => {
  const diffAmount = await m.snapshotTest(name)
  eq(
    diffAmount < 1,
    true,
    `${name} image snapshot is different by ${diffAmount}% (diff of <1% is ok)`
  )
}

describe('features', () => {
  let m
  let testSnapshot

  before(async () => {
    m = await launch()
    testSnapshot = snapshotTester(m)
  })

  after(() => m.stop())

  it('fuzzy file finder', async () => {
    await m.veonimAction('files')
    await testSnapshot('files')
    await m.input.esc()
  })

  it('explorer', async () => {
    await m.veonimAction('explorer')
    await testSnapshot('explorer')
    await m.input.esc()
  })

  it('change dir', async () => {
    await m.veonimAction('change-dir')
    await testSnapshot('change-dir')
    await m.input.esc()
  })
})
