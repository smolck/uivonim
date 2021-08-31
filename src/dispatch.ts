type Cb = (...args: any[]) => void

export const dispatchConstructor = () => {
  const listeners: any = {}

  return {
    pub: (event: string, ...args: any[]) => {
      if (event in listeners) {
        listeners[event].forEach((cb: Cb) => cb(...args))
      }
    },
    sub: (event: string, cb: Cb) => {
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
