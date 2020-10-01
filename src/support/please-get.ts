export interface SafeObject {
  [index: string]: SafeObject
  <T = any>(defaultValue?: T): T
}

const getPath = (obj: any, givenPath?: any[]) => {
  const path = givenPath || []
  const length = path.length
  let hasOwn = true
  let key: string

  return (defaultValue: any) => {
    let index = 0
    while (obj != null && index < length) {
      key = path[index++]
      hasOwn = obj.hasOwnProperty(key)
      obj = obj[key]
    }

    return hasOwn && index === length ? obj : defaultValue
  }
}

export default (obj: any) => {
  const handler = (path: any[]) => ({
    get: (_: any, key: string): any => {
      if (obj[key] && obj[key].isPrototypeOf(obj)) return obj[key]
      const newPath = [...path, key]
      return new Proxy(getPath(obj, newPath), handler(newPath)) as SafeObject
    },
  })

  return new Proxy(getPath(obj), handler([])) as SafeObject
}
