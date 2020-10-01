import { hasUpperCase, is, objDeepGet } from '../support/utils'

const Module = require('module')
const originalLoader = Module._load
const fakeModules = new Map()

Module._load = (request: string, ...args: any[]) =>
  fakeModules.has(request)
    ? fakeModules.get(request)
    : originalLoader(request, ...args)

export default (
  moduleName: string,
  fakeImplementation: any,
  onMissing?: (name: string, path: string) => void
) => {
  const getFake = objDeepGet(fakeImplementation)
  const notifyOfMissingPath = (path: string) =>
    is.function(onMissing) && onMissing!(moduleName, path)

  const fake = (path = [] as string[]): any =>
    new Proxy(
      {},
      {
        get: (_, key: string) => {
          const objPath = [...path, key]
          const found = getFake(objPath)

          if (found) return found
          else notifyOfMissingPath(objPath.join('.'))

          if (hasUpperCase(key[0])) return class Anon {}
          return fake(objPath)
        },
      }
    )

  fakeModules.set(moduleName, fake())
}
