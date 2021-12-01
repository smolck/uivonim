import { basename, join } from 'path'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { homedir, tmpdir } from 'os'
export { watchFile } from './fs-watch'

export interface Task<T> {
  done: (value: T) => void
  promise: Promise<T>
}

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

// TODO: this parsing logic needs to be revisited
// needs to handle all nvim formatting options
export const parseGuifont = (guifont: string) => {
  const [font] = guifont.match(/(?:\\,|[^,])+/g) || ['']
  const [face, ...settings] = font.split(':')
  const height = settings.find((s: string) => s.startsWith('h'))
  const size = Math.round(<any>(height || '').slice(1) - 0)

  return {
    face,
    size,
  }
}

export const $HOME = homedir
  ? homedir()
  : 'Why are you using this from the frontend? Stop it.'

export const type = (m: any) =>
  (Object.prototype.toString.call(m).match(/^\[object (\w+)\]/) ||
    [])[1].toLowerCase()
export const within =
  (target: number, tolerance: number) => (candidate: number) =>
    Math.abs(target - candidate) <= tolerance
export const fromJSON = (m: string) => ({
  or: (defaultVal: any) => {
    try {
      return JSON.parse(m)
    } catch (_) {
      return defaultVal
    }
  },
})
export const merge = Object.assign
export const ID = (val = 0) => ({ next: () => (val++, val) })
export const $ =
  <T>(...fns: Function[]) =>
  (...a: any[]) =>
    fns.reduce((res, fn, ix) => (ix ? fn(res) : fn(...res)), a) as unknown as T
export const is = new Proxy<Types>({} as Types, {
  get: (_, key) => (val: any) => type(val) === key,
})
export const onProp = <T>(cb: (name: PropertyKey) => void): T =>
  new Proxy({}, { get: (_, name) => cb(name) }) as T
export const onFnCall = <T>(cb: (name: string, args: any[]) => void): T =>
  new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args: any[]) =>
          cb(name as string, args),
    }
  ) as T
export const pascalCase = (m: string) => m[0].toUpperCase() + m.slice(1)
export const proxyFn = (cb: (name: string, data?: any) => void) =>
  new Proxy(
    {},
    { get: (_, name) => (data?: any) => cb(name as string, data) }
  ) as { [index: string]: (data?: any) => void }
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
  join(tmpdir(), `${name}${uuid()}.sock`)

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

export const minmax =
  (min: number, max: number) =>
  (...numbers: number[]) => {
    return Math.min(max, Math.max(min, ...numbers))
  }

export const pathRelativeTo = (path: string, otherPath: string) =>
  path.includes(otherPath)
    ? path.replace(otherPath, '').replace(/^\//, '')
    : path

export const simplifyPath = (
  fullpath: string,
  cwd: string,
  homeDirIfUsingFromWeb?: string
) =>
  fullpath.includes(cwd)
    ? fullpath.split(cwd + '/')[1]
    : fullpath.includes(homeDirIfUsingFromWeb ?? $HOME)
    ? fullpath.replace(homeDirIfUsingFromWeb ?? $HOME, '~')
    : fullpath

export const pathReducer = (p = '') =>
  ((p, levels = 0) => ({
    reduce: () =>
      levels
        ? basename(join(p, '../'.repeat(levels++)))
        : (levels++, basename(p)),
  }))(p)

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

// https://stackoverflow.com/a/35008327
export const exists = async (path: string): Promise<boolean> =>
  fs
    .access(path)
    .then(() => true)
    .catch(() => false)

const emptyStat = {
  isDirectory: () => false,
  isFile: () => false,
  isSymbolicLink: () => false,
}

const getFSStat = async (path: string) => fs.stat(path).catch((_) => emptyStat)

interface DirFileInfo {
  name: string
  path: string
  relativePath: string
  dir: boolean
  file: boolean
  symlink: boolean
}

export const getDirFiles = async (path: string): Promise<DirFileInfo[]> => {
  const paths = (await fs.readdir(path).catch((_e: string) => [])) as string[]
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

// TODO(smolck): Used in src/main/workers/todo/*.ts
// import { Transform } from 'stream'
/*export class NewlineSplitter extends Transform {
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
}*/

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
