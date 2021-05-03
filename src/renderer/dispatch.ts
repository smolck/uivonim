// import { Watchers } from '../common/utils'

type Cb = (...args: any[]) => void

const dispatchConstructor = () => {
  const listeners: any = {}

  return {
    pub: (event: string, ...args: any[]) => {
      if (event in listeners) {
        console.log('pub event: ', event)
        listeners[event].forEach((cb: Cb) => cb(...args))
      }
    },
    sub: (event: string, cb: Cb) => {
      console.log('sub event: ', event)
      if (event in listeners) {
        listeners[event].push(cb)
      } else {
        listeners[event] = [cb]
      }
    },
    unsub: (event: string, cb: Cb) => {
      if (event in listeners) {
        for (let i = 0; i < listeners.length; i++) {
          if (listeners[i] === cb) listeners.splice(i, 1)
        }
      }
    },
  }
}

const dispatch = dispatchConstructor()
export const sub = dispatch.sub
export const unsub = dispatch.unsub
export const pub = dispatch.pub
export const processAnyBuffered = (_event: string) => {}

/*const ee = new EventEmitter()

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
}*/
