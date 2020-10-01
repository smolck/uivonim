'use strict'

const { deepStrictEqual: same } = require('assert')
const proxyquire = require('proxyquire').noCallThru()
const Module = require('module')
const os = require('os')
const path = require('path')
const fs = require('fs')
const originalModuleLoader = Module._load

const relativeFakes = (obj) =>
  Object.keys(obj).reduce((res, key) => {
    const val = Reflect.get(obj, key)
    Reflect.set(res, `../${key}`, val)
    return res
  }, {})

const requireModule = (name, freshLoad) => {
  const modPath = require.resolve(`../build/${name}`)
  delete require.cache[modPath]
  return require(modPath)
}

const src = (name, fake, { noRelativeFake = false } = {}) =>
  fake
    ? proxyquire(
        `../build/${name}`,
        noRelativeFake ? fake : relativeFakes(fake)
      )
    : requireModule(name)

const resetModule = (name) => {
  delete require.cache[require.resolve(`../build/${name}`)]
}

const globalProxy = (name, implementation) => {
  Module._load = (request, ...args) =>
    request === name ? implementation : originalModuleLoader(request, ...args)

  return () => (Module._load = originalModuleLoader)
}

const delay = (time) => new Promise((fin) => setTimeout(fin, time))

const pathExists = (path) => new Promise((m) => fs.access(path, (e) => m(!e)))

const spy = (returnValue) => {
  const spyFn = (...args) => (spyFn.calls.push(args), returnValue)
  spyFn.calls = []
  return spyFn
}

global.localStorage = {
  getItem: () => {},
  setItem: () => {},
}

const testDataPath = path.join(process.cwd(), 'test', 'data')

const CreateTask = () =>
  ((done = () => {}, promise = new Promise((m) => (done = m))) => ({
    done,
    promise,
  }))()

const uuid = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (a) =>
    (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
  )

const getPipeName = (name) =>
  process.platform === 'win32'
    ? `\\\\.\\pipe\\${name}${uuid()}-sock`
    : path.join(os.tmpdir(), `${name}${uuid()}.sock`)

module.exports = {
  src,
  same,
  globalProxy,
  delay,
  pathExists,
  spy,
  resetModule,
  testDataPath,
  getPipeName,
  CreateTask,
}
