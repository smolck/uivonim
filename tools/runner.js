'use strict'

const { spawn } = require('child_process')
const { promisify: P } = require('util')
const { join } = require('path')
const fs = require('fs')

const root = join(__dirname, '..')
const fromRoot = (...paths) => join(root, ...paths)

const run = (cmd, opts = {}) =>
  new Promise((done) => {
    console.log(cmd)

    const proc = spawn('npx', cmd.split(' '), {
      ...opts,
      cwd: root,
      shell: true,
    })
    const exit = () => (proc.kill(), process.exit())

    process.on('SIGBREAK', exit)
    process.on('SIGTERM', exit)
    process.on('SIGHUP', exit)
    process.on('SIGINT', exit)
    proc.on('exit', done)

    if (!opts.shh) {
      proc.stdout.pipe(process.stdout)
      proc.stderr.pipe(process.stderr)
    }

    if (opts.outputMatch)
      proc.stdout.on('data', (data) => {
        const outputHas = data
          .toString()
          .toLowerCase()
          .includes(opts.outputMatch)

        if (outputHas && typeof opts.onOutputMatch === 'function')
          opts.onOutputMatch()
      })
  })

const $ = (s, ...v) =>
  Array.isArray(s)
    ? console.log(s.map((s, ix) => s + (v[ix] || '')).join(''))
    : console.log(s)
const go = (fn) => fn().catch((e) => (console.error(e), process.exit(1)))
const createTask = () =>
  ((done = () => {}, promise = new Promise((m) => (done = m))) => ({
    done,
    promise,
  }))()

const fetchStream = (url, options = { method: 'GET' }) =>
  new Promise((done, fail) => {
    const { data, ...requestOptions } = options
    const opts = { ...require('url').parse(url), ...requestOptions }

    const { request } = url.startsWith('https://')
      ? require('https')
      : require('http')

    const req = request(opts, (res) =>
      done(
        res.statusCode >= 300 && res.statusCode < 400
          ? fetchStream(res.headers.location, options)
          : res
      )
    )

    req.on('error', fail)
    if (data) req.write(data)
    req.end()
  })

const fetch = (url, options = { method: 'GET' }) =>
  new Promise((done, fail) => {
    const { data, ...reqOpts } = options
    const { request } = require(url.match(/^(\w+):\/\//)[1])

    const req = request(
      {
        ...require('url').parse(url),
        ...reqOpts,
      },
      (res) => {
        let buffer = ''
        res.on('data', (m) => (buffer += m))

        res.on('end', () => {
          if (res.statusCode >= 300 && res.statusCode < 400) {
            return done(fetch(res.headers.location, options))
          }

          done({
            response: res,
            status: res.statusCode,
            headers: res.headers,
            data: buffer,
          })
        })
      }
    )

    req.on('error', fail)
    if (data) req.write(data)
    req.end()
  })

const getFSStat = async (path) => P(fs.stat)(path).catch(() => emptyStat)

const getDirFiles = async (path) => {
  const paths = await P(fs.readdir)(path).catch(() => [])
  const filepaths = paths.map((f) => ({ name: f, path: join(path, f) }))
  const filesreq = await Promise.all(
    filepaths.map(async (f) => ({
      path: f.path,
      name: f.name,
      stats: await getFSStat(f.path),
    }))
  )
  return filesreq
    .map(({ name, path, stats }) => ({
      name,
      path,
      dir: stats.isDirectory(),
      file: stats.isFile(),
    }))
    .filter((m) => m.dir || m.file)
}

const fromJSON = (m) => ({
  or: (defaultVal) => {
    try {
      return JSON.parse(m)
    } catch (_) {
      return defaultVal
    }
  },
})

module.exports = {
  $,
  go,
  run,
  root,
  fetch,
  fromRoot,
  createTask,
  fetchStream,
  getDirFiles,
  fromJSON,
}
