'use strict'

// TODO: we should probably just move this file to @veonim/neovim repo
// that way the generate API typings match the package version installed
const {
  encode,
  decode,
  createEncodeStream,
  createDecodeStream,
} = require('msgpack-lite')
const { createWriteStream } = require('fs')
const { spawn } = require('child_process')
const { join } = require('path')

let Neovim
if (process.platform === 'darwin')
  Neovim = require('@veonim/neovim-mac').default
if (process.platform === 'win32') Neovim = require('@veonim/neovim-win').default
if (process.platform === 'linux')
  Neovim = require('@veonim/neovim-linux').default

const out = createWriteStream(join(__dirname, '../src/neovim/protocol.ts'))
const leftPad = (str, amt) => Array(amt).fill(' ').join('') + str
const write = (m = '', pad = 0) => out.write(leftPad(`${m}\n`, pad))
const mix = (...a) => Object.assign({}, ...a)

const { stdin, stdout } = Neovim(['--embed', '-u', 'NORC'])
const stupidEncoder = createEncodeStream()
const encoder = stupidEncoder.pipe(stdin)
const toVim = (m) => encoder.write(encode(m))

const decoder = createDecodeStream()
stdout.pipe(decoder)

const param = (p) => {
  const res = []
  for (let ix = 0; ix < p.length; ix += 2) {
    res.push(`${p[ix]}: ${p[ix + 1]}`)
  }
  return res
}

const wildcard = (t) => {
  if (t.includes('ArrayOf(Integer')) return 'number[]'
  if (t.includes('ArrayOf(String')) return 'string[]'
  if (t.includes('ArrayOf(Dictionary')) return 'object[]'
  // using ext container because need to keep it RAW in webworker
  if (t.includes('ArrayOf(Window')) return 'ExtContainer[]'
  if (t.includes('ArrayOf(Tabpage')) return 'ExtContainer[]'
  if (t.includes('ArrayOf(Buffer')) return 'ExtContainer[]'
  //if (t.includes('ArrayOf(Window')) return 'Window[]'
  //if (t.includes('ArrayOf(Tabpage')) return 'Tabpage[]'
  //if (t.includes('ArrayOf(Buffer')) return 'Buffer[]'
  else return t
}

const toJSTypes = (type) =>
  ({
    Object: 'any',
    Array: 'any[]',
    Integer: 'number',
    Boolean: 'boolean',
    String: 'string',
    Dictionary: 'object',
  }[type] || wildcard(type))

const extTypeMaybe = (type) =>
  ({
    Buffer: 'ExtContainer',
    Window: 'ExtContainer',
    Tabpage: 'ExtContainer',
  }[type] || type)

const asPromise = (m) => (m === 'void' ? m : `Promise<${extTypeMaybe(m)}>`)

const group = (fns, prefix) =>
  fns
    .filter((m) => m.name.startsWith(prefix))
    .map((m) => {
      const nn = m.name
        .split(prefix)[1]
        .split('_')
        .map((s, ix) => (ix ? s[0].toUpperCase() + s.slice(1) : s))
        .join('')

      return mix(m, { name: nn })
    })
    .map((m) => ({
      name: m.name,
      params: m.parameters.map(([type, name]) => ({
        name,
        type: toJSTypes(type),
      })),
      returns: asPromise(toJSTypes(m.return_type)),
    }))

const asParam = ({ name, type }) => `${name}: ${type}`
const fmt = ({ name, params, returns }) =>
  `${name}(${params.map(asParam).join(', ')}): ${returns}`
const asUIParam = ([type, name]) => `${name}: ${toJSTypes(extTypeMaybe(type))}`

decoder.on('data', (raw) => {
  const [type, id, err, res] = raw
  const [
    chid,
    {
      version: { major, minor, patch },
      error_types,
      types,
      functions,
      ui_events,
    },
  ] = res

  //ui_events.forEach(a => console.log(a))
  write('// AUTO-GENERATED! This file automagically generated with gen-api.js')
  write(`// ${new Date().toGMTString()}`)
  write(`// Neovim version: ${major}.${minor}.${patch}`)
  write()

  const extraTypes = Object.keys(types).map((k) => ({
    name: k,
    id: types[k].id,
    prefix: types[k].prefix,
  }))

  write(`export interface ExtContainer {
  extContainer: boolean,
  kind: number,
  id: any,
}\n`)

  write(`export interface Events {`)
  ui_events.forEach((e) => {
    const fn = e.name
    const params = `(${e.parameters.map(asUIParam).join(', ')})`
    write(fn + params + ': void,', 2)
  })
  write(`}\n`)

  write(`export interface Api {`)

  const coreFns = functions.filter(
    (m) => !extraTypes.find((t) => m.name.startsWith(t.prefix))
  )
  group(coreFns, 'nvim_')
    .map(fmt)
    .forEach((c) => write(c + ',', 2))

  extraTypes.forEach(({ name }) => write(`${name.toLowerCase()}: ${name},`, 2))

  write(`}`)

  extraTypes.forEach(({ name, prefix }) => {
    write()
    write(`export interface ${name} {`)

    const fns = functions.filter((m) => m.name.startsWith(prefix))
    group(fns, prefix)
      .map(fmt)
      .forEach((c) => write(c + ',', 2))

    write('}')
  })

  write('')
  write('export const Prefixes = {')
  write(`Core: 'nvim_' ,`, 2)
  extraTypes.forEach((t) => write(`${t.name}: '${t.prefix}',`, 2))
  write('}')

  write('')
  write('export enum ExtType {')
  extraTypes.forEach((t) => write(t.name + ',', 2))
  write('}')

  setTimeout((m) => process.exit(0), 2e3)
})

toVim([0, 1, 'nvim_get_api_info', []])
