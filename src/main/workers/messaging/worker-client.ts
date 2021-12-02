import { onFnCall, proxyFn, uuid, CreateTask } from '../../../common/utils'
import { EventEmitter } from 'events'
import { parentPort } from 'worker_threads'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

const send = (data: any) => parentPort!!.postMessage(data)
const internalEvents = new EventEmitter()
internalEvents.setMaxListeners(200)
const ee = new EventEmitter()
const pendingRequests = new Map()

parentPort!!.on('message', async ([e, data, id]) => {
  if (e === '@@sab') {
    return
  }

  if (!id) return ee.emit(e, ...data)

  if (pendingRequests.has(id)) {
    pendingRequests.get(id)(data)
    pendingRequests.delete(id)
    return
  }

  const listener = ee.listeners(e)[0]
  if (!listener) return
  const result = await listener(...data)
  send([e, result, id])
})

export const call: EventFn = onFnCall((event: string, args: any[]) =>
  send([event, args])
)
export const on = proxyFn((event: string, cb: (data: any) => void) =>
  ee.on(event, cb)
)
export const request: RequestEventFn = onFnCall(
  (event: string, args: any[]) => {
    const task = CreateTask()
    const id = uuid()
    pendingRequests.set(id, task.done)
    send([event, args, id])
    return task.promise
  }
)
