import { externalFunction } from '../src/blarg2'

const logger = (str: TemplateStringsArray | string, v: any[]) =>
  Array.isArray(str)
    ? console.log(
        (str as TemplateStringsArray).map((s, ix) => s + (v[ix] || '')).join('')
      )
    : console.log(str as string)

export const log = (str: TemplateStringsArray | string, ...vars: any[]) =>
  logger(str, vars)

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

export const snakeCase = (m: string) =>
  m
    .split('')
    .map((ch) => (/[A-Z]/.test(ch) ? '_' + ch.toLowerCase() : ch))
    .join('')
const type = (m: any) =>
  (Object.prototype.toString.call(m).match(/^\[object (\w+)\]/) ||
    [])[1].toLowerCase()

export const fromJSON = (m: string) => ({
  or: (defaultVal: any) => {
    try {
      return JSON.parse(m)
    } catch (_) {
      return defaultVal
    }
  },
})
export const is = new Proxy<Types>({} as Types, {
  get: (_, key) => (val: any) => type(val) === key,
})

const doTheNeedful = (text: string) => externalFunction(text)

export const emptyStat = {
  isDirectory: () => false,
  isFile: () => false,
  isSymbolicLink: () => false,
}

const result = doTheNeedful('42')
console.log('result', result)
