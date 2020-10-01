import {
  dirname,
  basename,
  join,
  extname,
  resolve,
  sep,
  parse,
  normalize,
  relative,
} from 'path'
import { createConnection } from 'net'
// TODO: in the near future we can use require('fs').promises
import { promisify as P } from 'util'
import { EventEmitter } from 'events'
import { exec } from 'child_process'
import { homedir, tmpdir } from 'os'
import { Transform } from 'stream'
import * as fs from 'fs'
export { watchFile } from '../support/fs-watch'

export interface Task<T> {
  done: (value: T) => void
  promise: Promise<T>
}

process.on('unhandledRejection', (e) => console.error(e))

type TypeChecker = (thing: any) => boolean
interface Types {
  string: TypeChecker
  number: TypeChecker
  array: TypeChecker
  object: TypeChecker
  null: TypeChecker
  asyncfunction: TypeChecker
  function: TypeChecker
  promise: TypeChecker
  map: TypeChecker
  set: TypeChecker
}

export const $HOME = homedir()
export const configPath =
  process.env.XDG_CONFIG_HOME ||
  (process.platform === 'win32' ? `${$HOME}/AppData/Local` : `${$HOME}/.config`)

const snakeCase = (m: string) =>
  m
    .split('')
    .map((ch) => (/[A-Z]/.test(ch) ? '_' + ch.toLowerCase() : ch))
    .join('')
export const type = (m: any) =>
  (Object.prototype.toString.call(m).match(/^\[object (\w+)\]/) ||
    [])[1].toLowerCase()
export const within = (target: number, tolerance: number) => (
  candidate: number
) => Math.abs(target - candidate) <= tolerance
export const objToMap = (obj: object, map: Map<any, any>) =>
  Object.entries(obj).forEach(([k, v]) => map.set(k, v))
export const listof = (count: number, fn: () => any) =>
  [...Array(count)].map(fn)
export const fromJSON = (m: string) => ({
  or: (defaultVal: any) => {
    try {
      return JSON.parse(m)
    } catch (_) {
      return defaultVal
    }
  },
})
export const prefixWith = (prefix: string) => (m: string) =>
  `${prefix}${snakeCase(m)}`
export const merge = Object.assign
export const cc = (...a: any[]) => Promise.all(a)
export const delay = (t: number) => new Promise((d) => setTimeout(d, t))
export const ID = (val = 0) => ({ next: () => (val++, val) })
export const $ = <T>(...fns: Function[]) => (...a: any[]) =>
  (fns.reduce((res, fn, ix) => (ix ? fn(res) : fn(...res)), a) as unknown) as T
export const is = new Proxy<Types>({} as Types, {
  get: (_, key) => (val: any) => type(val) === key,
})
export const onProp = <T>(cb: (name: PropertyKey) => void): T =>
  new Proxy({}, { get: (_, name) => cb(name) }) as T
export const onFnCall = <T>(cb: (name: string, args: any[]) => void): T =>
  new Proxy(
    {},
    { get: (_, name) => (...args: any[]) => cb(name as string, args) }
  ) as T
export const pascalCase = (m: string) => m[0].toUpperCase() + m.slice(1)
export const camelCase = (m: string) => m[0].toLowerCase() + m.slice(1)
export const hasUpperCase = (m: string) => m.toLowerCase() !== m
export const proxyFn = (cb: (name: string, data?: any) => void) =>
  new Proxy(
    {},
    { get: (_, name) => (data?: any) => cb(name as string, data) }
  ) as { [index: string]: (data?: any) => void }
export const uriToPath = (m: string) => m.replace(/^\S+:\/\//, '')
export const uriAsCwd = (m = '') => dirname(uriToPath(m))
export const uriAsFile = (m = '') => basename(uriToPath(m))
export const CreateTask = <T>(): Task<T> =>
  ((done = (_: T) => {}, promise = new Promise<T>((m) => (done = m))) => ({
    done,
    promise,
  }))()
export const uuid = (): string =>
  (<any>[1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (a: any) =>
    (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
  )
export const shell = (cmd: string, opts?: object): Promise<string> =>
  new Promise((fin) => exec(cmd, opts, (_, out) => fin(out + '')))
export const getPipeName = (name: string) =>
  process.platform === 'win32'
    ? `\\\\.\\pipe\\${name}${uuid()}-sock`
    : join(tmpdir(), `${name}${uuid()}.sock`)

export const arrReplace = <T>(
  arr: T[],
  matcher: (val: T) => any,
  patch: Partial<T>
): T[] | undefined => {
  const foundIndex = arr.findIndex(matcher)
  if (!~foundIndex) return
  const copy = [...arr]
  const itemToPatch = copy[foundIndex]
  const patchedItem = { ...itemToPatch, ...patch }
  copy.splice(foundIndex, 1, patchedItem)
  return copy
}

// TODO: remove listof because it's not as performant
export const genList = <T>(count: number, fn: (index: number) => T) => {
  const resultList: T[] = []
  for (let ix = 0; ix < count; ix++) {
    resultList.push(fn(ix))
  }
  return resultList
}

export const minmax = (min: number, max: number) => (...numbers: number[]) => {
  return Math.min(max, Math.max(min, ...numbers))
}

export const pathRelativeToHome = (path: string) =>
  path.includes($HOME) ? path.replace($HOME, '~') : path

export const pathRelativeToCwd = (path: string, cwd: string) =>
  path.includes(cwd) ? path.replace(cwd, '').replace(/^\//, '') : path

// TODO: i don't think this does what you think it does. try giving ./relative/path
export const absolutePath = (path: string) =>
  resolve(path.replace(/^~\//, `${homedir()}/`))

export const resolvePath = (path: string, dir: string) => {
  if (path.startsWith('/')) return resolve(path)
  if (path.startsWith('~/'))
    return resolve(path.replace(/^~\//, `${homedir()}/`))
  if (path.startsWith('./') || path.startsWith('../')) return join(dir, path)
}

export const simplifyPath = (fullpath: string, cwd: string) =>
  fullpath.includes(cwd)
    ? fullpath.split(cwd + '/')[1]
    : fullpath.includes($HOME)
    ? fullpath.replace($HOME, '~')
    : fullpath

export const pathReducer = (p = '') =>
  ((p, levels = 0) => ({
    reduce: () =>
      levels
        ? basename(join(p, '../'.repeat(levels++)))
        : (levels++, basename(p)),
  }))(p)

export const matchOn = (val: any) => (opts: object): any =>
  (Reflect.get(opts, val) || (() => {}))()

export const isOnline = (host = 'google.com') =>
  new Promise((fin) => {
    require('dns').lookup(host, (e: any) => fin(!(e && e.code === 'ENOTFOUND')))
  })

export const findIndexRight = (
  line: string,
  pattern: RegExp,
  start: number
) => {
  for (let ix = start || line.length; ix > 0; ix--) {
    if (pattern.test(line[ix])) return ix
  }
}

export const asColor = (color?: number) =>
  color
    ? '#' +
      [16, 8, 0]
        .map((shift) => {
          const mask = 0xff << shift
          const hex = ((color & mask) >> shift).toString(16)
          return hex.length < 2 ? '0' + hex : hex
        })
        .join('')
    : undefined

export const exists = (path: string): Promise<boolean> =>
  new Promise((fin) => fs.access(path, (e) => fin(!e)))
export const readFile = (path: string, encoding = 'utf8') =>
  P(fs.readFile)(path, encoding)
export const writeFile = async (path: string, data: string) => {
  await ensureDir(dirname(path))
  return P(fs.writeFile)(path, data)
}

const emptyStat = {
  isDirectory: () => false,
  isFile: () => false,
  isSymbolicLink: () => false,
}

const getFSStat = async (path: string) =>
  P(fs.stat)(path).catch((_) => emptyStat)

interface DirFileInfo {
  name: string
  path: string
  relativePath: string
  dir: boolean
  file: boolean
  symlink: boolean
}

export const getDirFiles = async (path: string): Promise<DirFileInfo[]> => {
  const paths = (await P(fs.readdir)(
    path
  ).catch((_e: string) => [])) as string[]
  const filepaths = paths.map((f) => ({ name: f, path: join(path, f) }))

  const filesreq = await Promise.all(
    filepaths.map(async (f) => ({
      path: f.path,
      name: f.name,
      relativePath: f.path,
      stats: await getFSStat(f.path),
    }))
  )

  return filesreq.map(({ name, path, relativePath, stats }) => ({
    name,
    path,
    relativePath,
    dir: stats.isDirectory(),
    // file: stats.isFile(),
    // TODO: electron FS does not report .asar files as either files or
    // directories this is a big problem when we need to remove paths. this
    // should be temporary until we move the server code back to vanilla node
    // (which does report .asar correctly as file)
    file: stats.isFile() || path.endsWith('.asar'),
    symlink: stats.isSymbolicLink(),
  }))
}

export const getDirs = async (path: string) =>
  (await getDirFiles(path)).filter((m) => m.dir)
export const getFiles = async (path: string) =>
  (await getDirFiles(path)).filter((m) => m.file)
const isFile = async (path: string) => (await P(fs.stat)(path)).isFile()
const copyFile = (src: string, dest: string) => P(fs.copyFile)(src, dest)

export const getDirsFilesRecursively = async (
  startPath: string
): Promise<DirFileInfo[]> => {
  const dive = async (path: string): Promise<DirFileInfo[]> => {
    const paths = (await P(fs.readdir)(path).catch(() => [])) as string[]
    const filepaths = paths.map((f) => ({ name: f, path: join(path, f) }))
    const filesreq = await Promise.all(
      filepaths.map(async (f) => ({
        path: f.path,
        name: f.name,
        relativePath: relative(startPath, f.path),
        stats: await getFSStat(f.path),
      }))
    )

    const meta = filesreq.map(({ name, path, relativePath, stats }) => ({
      name,
      path,
      relativePath,
      dir: stats.isDirectory(),
      // file: stats.isFile(),
      // TODO: electron FS does not report .asar files as either files or
      // directories this is a big problem when we need to remove paths. this
      // should be temporary until we move the server code back to vanilla node
      // (which does report .asar correctly as file)
      file: stats.isFile() || path.endsWith('.asar'),
      symlink: stats.isSymbolicLink(),
    }))

    return meta
      .filter((m) => m.dir)
      .reduce(async (q, dir) => {
        const res = await q
        const df = await dive(dir.path)
        return [...res, ...df]
      }, Promise.resolve(meta))
  }

  return dive(startPath)
}

type RemoveOpts = { ignoreNotExist?: boolean }
export const remove = async (
  path: string,
  { ignoreNotExist } = {} as RemoveOpts
) => {
  if (!(await exists(path))) {
    if (ignoreNotExist) return
    throw new Error(`remove: ${path} does not exist`)
  }

  if (await isFile(path)) return P(fs.unlink)(path)

  const dfs = await getDirsFilesRecursively(path)
  if (!dfs.length) return P(fs.rmdir)(path)

  const files = dfs.filter((m) => m.file)
  await Promise.all(files.map((f) => P(fs.unlink)(f.path)))
  await dfs
    .filter((m) => m.dir)
    .map((m) => ({ ...m, depth: m.path.split(sep).length }))
    .sort((a, b) => b.depth - a.depth)
    .reduce(async (q, m) => {
      return await q, P(fs.rmdir)(m.path)
    }, Promise.resolve())

  return P(fs.rmdir)(path)
}

interface CopyOptions {
  overwrite?: boolean
}
/** Copy file or dir from source to destination path. Destination path should be the final path. */
export const copy = async (
  srcPath: string,
  destPath: string,
  options = {} as CopyOptions
) => {
  if (await isFile(srcPath)) {
    await ensureDir(destPath)
    return copyFile(srcPath, destPath)
  }

  if (options.overwrite) await remove(destPath, { ignoreNotExist: true })
  const dfs = await getDirsFilesRecursively(srcPath)
  const files = dfs.filter((m) => m.file).map((m) => m.relativePath)

  return Promise.all(
    files.map(async (file) => {
      const destdir = join(destPath, dirname(file))
      await ensureDir(destdir)
      const srcfile = join(srcPath, file)
      const dstfile = join(destPath, file)
      return copyFile(srcfile, dstfile)
    })
  )
}

export const rename = async (path: string, newPath: string) => {
  if (!(await exists(path))) throw new Error(`rename: ${path} does not exist`)
  return P(fs.rename)(path, newPath)
}

export const pathParts = (path: string) => {
  const properPath = normalize(path)
  const parts = properPath.split(sep)
  const { root } = parse(properPath)
  return [root, ...parts].filter((m) => m)
}

export const ensureDir = (path: string) =>
  pathParts(path).reduce(
    (q, dir, ix, arr) =>
      q.then(() => {
        return P(fs.mkdir)(join(...arr.slice(0, ix), dir)).catch(() => {})
      }),
    Promise.resolve()
  )

export const EarlyPromise = (
  init: (
    resolve: (resolvedValue: any) => void,
    reject: (error: any) => void
  ) => void
) => {
  let delayExpired = false
  const promise = new Promise(init)
  const eventually = (cb: (value: any) => void) =>
    promise.then((val) => delayExpired && cb(val))
  const maybeAfter = ({ time, or: defaultValue }: { time: number; or: any }) =>
    Promise.race([
      promise.then((val) => (!delayExpired ? val : undefined)),
      new Promise((fin) =>
        setTimeout(() => ((delayExpired = true), fin(defaultValue)), time)
      ),
    ])

  return { maybeAfter, eventually, fail: promise.catch }
}

export const requireDir = async (path: string) =>
  (await getDirFiles(path))
    .filter((m) => m.file)
    .filter((m) => extname(m.name) === '.js')
    .map((m) => require(m.path))

export function debounce(fn: Function, wait = 1) {
  if (!fn) throw new Error('bruh, ya need a function here!')
  let timeout: NodeJS.Timer
  return function (this: any, ...args: any[]) {
    const ctx = this
    clearTimeout(timeout)
    timeout = setTimeout(() => fn.apply(ctx, args), wait)
  }
}

export const throttle = (fn: (...args: any[]) => void, delay: number) => {
  let throttling = false
  let args: any[] | undefined

  const executor = (...a: any[]) => {
    if (throttling) return (args = a), undefined
    throttling = true
    fn(...a)
    setTimeout(
      () => (
        (throttling = false), args && (executor(...args), (args = undefined))
      ),
      delay
    )
  }

  return executor
}

export const objDeepGet = (obj: object) => (givenPath: string | string[]) => {
  const path =
    typeof givenPath === 'string' ? givenPath.split('.') : givenPath.slice()

  const dive = (obj = {} as any): any => {
    const pathPoint = path.shift()
    if (pathPoint == null) return
    const val = Reflect.get(obj, pathPoint)
    if (val === undefined) return
    return path.length ? dive(val) : val
  }

  return dive(obj)
}

export const dedupOn = <T>(
  list: T[],
  comparator: (a: T, b: T) => boolean
): T[] =>
  list.filter((m, ix) => {
    return ix === list.findIndex((s) => comparator(m, s))
  })

const defaultProtoKeys = Object.keys(
  Object.getOwnPropertyDescriptors(Object.getPrototypeOf({}))
)

export const threadSafeObject = <T>(obj: T): T => {
  if (!is.object(obj))
    // TODO(smolck): Why the ignore though? There's a type error w/out it,
    // but maybe just fix it instead of ignoring it?
    // @ts-ignore
    return Array.isArray(obj) ? obj.map((v) => threadSafeObject(v)) : obj

  const proto = Object.getPrototypeOf(obj)
  const mainDesc = Object.entries(Object.getOwnPropertyDescriptors(obj))
  const protoDesc = Object.entries(Object.getOwnPropertyDescriptors(proto))

  const collectValues = (res: any, [key, desc]: any) => {
    if (defaultProtoKeys.includes(key)) return res
    if (typeof desc.value === 'function') return res

    // @ts-ignore
    const value = obj[key]
    const threadSafeValue = Array.isArray(value)
      ? value.map((v) => threadSafeObject(v))
      : threadSafeObject(value)

    Reflect.set(res, key, threadSafeValue)
    return res
  }

  const part1 = protoDesc.reduce(collectValues, {})
  const part2 = mainDesc.reduce(collectValues, {})

  return { ...part1, ...part2 }
}

// TODO: deprecate this and use native Events.EventEmitter
export class Watchers extends Map<string, Set<Function>> {
  constructor() {
    super()
  }

  add(event: string, handler: (data: any) => void) {
    this.has(event)
      ? this.get(event)!.add(handler)
      : this.set(
          event,
          new Set<Function>([handler])
        )
  }

  notify(event: string, ...args: any[]) {
    this.has(event) && this.get(event)!.forEach((cb) => cb(...args))
  }

  notifyFn(event: string, fn: (handler: Function) => void) {
    this.has(event) && this.get(event)!.forEach((cb) => fn(cb))
  }

  notifyStartingWith(event: string, ...args: any[]) {
    Array.from(this.entries())
      .filter((m) => m[0].startsWith(event))
      .map((m) => m[1])
      .forEach((m) => m.forEach((cb) => cb(...args)))
  }

  remove(event: string, handler: Function) {
    this.has(event) && this.get(event)!.delete(handler)
  }
}

export type GenericEvent = { [index: string]: any }

// TODO: how can we make this use GenericEvent if not type passed in?
// i tried T extends GenericEv but it does not work. help me obi wan kenobi
export const Watcher = <T>() => {
  const ee = new EventEmitter()
  ee.setMaxListeners(200)

  const on = <K extends keyof T>(
    event: K & string,
    handler: (value: T[K]) => void
  ) => {
    ee.on(event, handler)
    return () => ee.removeListener(event, handler)
  }

  const once = <K extends keyof T>(
    event: K & string,
    handler: (...args: any[]) => void
  ) => {
    ee.once(event, handler)
  }

  // TODO: how do we make "value" arg require OR optional based on T[K]?
  type Emit = {
    <K extends keyof T>(event: K): void
    <K extends keyof T>(event: K, value: T[K]): void
    <K extends keyof T>(event: K, ...args: any[]): void
  }

  const emit: Emit = (event: string, ...args: any[]) => {
    try {
      ee.emit(event, ...args)
    } catch (e) {
      console.error('Watcher emit callback threw', event, e)
    }
  }

  const remove = (event: keyof T & string) => {
    ee.removeAllListeners(event)
  }

  return { on, once, emit, remove }
}

export class NewlineSplitter extends Transform {
  private buffer: string

  constructor() {
    super({ encoding: 'utf8' })
    this.buffer = ''
  }

  _transform(chunk: string, _: any, done: Function) {
    const pieces = ((this.buffer != null ? this.buffer : '') + chunk).split(
      /\r?\n/
    )
    this.buffer = pieces.pop() || ''
    pieces.forEach((line) => this.push(line))
    done()
  }
}

export const MapMap = <A, B, C>(initial?: any[]) => {
  const m = new Map<A, Map<B, C>>(initial)

  const set = (key: A, subkey: B, value: C) => {
    const sub = m.get(key) || new Map()
    sub.set(subkey, value)
    m.set(key, sub)
  }

  const updateObject = (key: A, subkey: B, objectDiff: C) => {
    const sub = m.get(key) || new Map()
    const previousObject = sub.get(subkey) || {}
    if (!is.object(previousObject))
      throw new Error(
        `MapMap: trying to update object but the current value is not an object`
      )
    sub.set(subkey, Object.assign(previousObject, objectDiff))
    m.set(key, sub)
  }

  const get = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return
    return sub.get(subkey)
  }

  const has = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return false
    return sub.has(subkey)
  }

  const remove = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return
    sub.delete(subkey)
  }

  const forEach = (key: A, fn: (value: C, key: B) => void) => {
    const sub = m.get(key)
    if (!sub) return
    sub.forEach(fn)
  }

  const size = () => m.size
  const subsize = (key: A) => {
    const sub = m.get(key)
    if (!sub) return -1
    return sub.size
  }

  const keys = (key: A) => {
    const sub = m.get(key)
    if (!sub) return []
    return sub.keys()
  }

  const entries = (key: A) => {
    const sub = m.get(key)
    if (!sub) return []
    return [...sub.entries()]
  }

  return {
    get raw() {
      return m
    },
    set,
    get,
    has,
    remove,
    updateObject,
    forEach,
    size,
    subsize,
    keys,
    entries,
  }
}

export class MapList<A, B> extends Map<A, B[]> {
  add(key: A, values: B[]) {
    const list = this.get(key) || []
    list.push(...values)
    this.set(key, list)
  }

  replace(key: A, values: B[]) {
    const list = [...values]
    this.set(key, list)
  }
}

export class MapSetter<A, B> extends Map<A, Set<B>> {
  add(key: A, value: B) {
    const s = this.get(key) || new Set()
    this.set(key, s.add(value))
    return () => this.remove(key, value)
  }

  addMany(key: A, values: B[]) {
    return values.map((val) => this.add(key, val))
  }

  addMultiple(keys: A[], value: B) {
    keys.forEach((key) => this.add(key, value))
    return () => this.removeMultiple(keys, value)
  }

  addMultipleValues(keys: A[], values: B[]) {
    const removalFuncs = values.map((value) => this.addMultiple(keys, value))
    return () => removalFuncs.forEach((fn) => fn())
  }

  replace(key: A, value: B) {
    const s = this.get(key) || new Set()
    s.clear()
    this.set(key, s.add(value))
    return () => this.remove(key, value)
  }

  replaceMany(key: A, values: B[]) {
    const s = this.get(key) || new Set()
    s.clear()
    return values.map((val) => this.add(key, val))
  }

  remove(key: A, value: B) {
    const s = this.get(key)
    if (!s) return false
    return s.delete(value)
  }

  removeMultiple(keys: A[], value: B) {
    keys.forEach((key) => this.remove(key, value))
  }

  getList(key: A): B[] {
    const s = this.get(key)
    return s ? [...s] : []
  }
}

export const MapSet = <A, B, C>(initial?: any[]) => {
  const m = new Map<A, MapSetter<B, C>>(initial)

  const set = (key: A, subkey: B, value: C) => {
    const sub = m.get(key) || new MapSetter()
    sub.add(subkey, value)
    m.set(key, sub)
  }

  const get = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return
    return sub.get(subkey)
  }

  const has = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return false
    return sub.has(subkey)
  }

  const remove = (key: A, subkey: B) => {
    const sub = m.get(key)
    if (!sub) return
    sub.delete(subkey)
  }

  const forEach = (key: A, fn: (value: Set<C>, key: B) => void) => {
    const sub = m.get(key)
    if (!sub) return
    sub.forEach(fn)
  }

  const size = () => m.size
  const subsize = (key: A) => {
    const sub = m.get(key)
    if (!sub) return -1
    return sub.size
  }

  const keys = (key: A) => {
    const sub = m.get(key)
    if (!sub) return []
    return sub.keys()
  }

  const entries = (key: A) => {
    const sub = m.get(key)
    if (!sub) return []
    return [...sub.entries()]
  }

  return {
    get raw() {
      return m
    },
    set,
    get,
    has,
    remove,
    forEach,
    size,
    subsize,
    keys,
    entries,
  }
}

export const tryNetConnect = (
  path: string,
  interval = 500,
  timeout = 5e3
): Promise<ReturnType<typeof createConnection>> =>
  new Promise((done, fail) => {
    const timeoutTimer = setTimeout(fail, timeout)

    const attemptConnection = () => {
      const socket = createConnection(path)

      socket.once('connect', () => {
        clearTimeout(timeoutTimer)
        socket.removeAllListeners('error')
        done(socket)
      })

      // swallow errors until we connect
      socket.on('error', () => {})
      socket.once('close', () => setTimeout(attemptConnection, interval))
    }

    attemptConnection()
  })

export const PromiseBoss = () => {
  interface CancelPromise<T> {
    promise: Promise<T>
    cancel: () => any
  }

  interface Options {
    timeout?: number
  }

  const $cancel = Symbol('cancel')
  type CancelFn = () => any
  let previousCancel: CancelFn | null
  let externalControlTask = CreateTask()

  /** Schedule a cancellable promise which can be cancelled by next invocation or timeout */
  const schedule = <T>(
    cancellablePromise: CancelPromise<T>,
    options: Options
  ): Promise<T> =>
    new Promise(async (ok, no) => {
      previousCancel && previousCancel()
      previousCancel = cancellablePromise.cancel
      externalControlTask = CreateTask()

      const result = await Promise.race([
        cancellablePromise.promise,
        externalControlTask.promise,
        new Promise((done) =>
          setTimeout(() => done($cancel), options.timeout || 1e3)
        ),
      ]).catch(no)

      if (result === $cancel) {
        previousCancel = null
        cancellablePromise.cancel()
        return
      }

      previousCancel = null
      ok(result as T)
    }) as Promise<T>

  const cancelCurrentPromise = () => externalControlTask.done($cancel)

  return { schedule, cancelCurrentPromise }
}
