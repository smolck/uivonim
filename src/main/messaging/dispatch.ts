import { Watchers } from '../support/utils'

const watchers = new Watchers()
const cache = new Map<string, any[]>()
const buffer = (event: string, data: any) =>
  cache.has(event) ? cache.get(event)!.push(data) : cache.set(event, [data])

export const unsub = (event: string, cb: Function) => watchers.remove(event, cb)
export const sub = (event: string, cb: (...args: any[]) => void) =>
  watchers.add(event, cb)

export const pub = (event: string, ...args: any[]) => {
  if (!watchers.has(event)) return buffer(event, args)
  watchers.notify(event, ...args)
}

export const processAnyBuffered = (event: string) => {
  if (!cache.has(event)) return
  cache.get(event)!.forEach((d) => watchers.notify(event, ...d))
  cache.delete(event)
}
