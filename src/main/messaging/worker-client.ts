import {
  onFnCall,
  proxyFn,
  uuid,
  CreateTask,
  fromJSON,
  ID,
} from '../support/utils'
import { EventEmitter } from 'events'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

const send = (data: any) => (postMessage as any)(data)
const internalEvents = new EventEmitter()
internalEvents.setMaxListeners(200)
const ee = new EventEmitter()
const pendingRequests = new Map()
const requestId = ID()
let sharedArray = new Int32Array()

const readSharedArray = (id: number) => {
  const responseId = sharedArray[0]
  if (responseId !== id)
    console.warn(
      `this response does not belong to the correct request. request was: ${id}, but response is: ${responseId}`
    )
  const payloadLength = sharedArray[1]
  const dataStartIndex = 2
  const payload = sharedArray.subarray(
    dataStartIndex,
    payloadLength + dataStartIndex
  )
  const jsonString = Buffer.from(payload as any).toString()
  return fromJSON(jsonString).or({})
}

onmessage = async ({ data: [e, data, id] }: MessageEvent) => {
  if (e === '@@sab') {
    sharedArray = new Int32Array(data[0])
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
}

export const requestSyncWithContext = (func: string, args: any[]) => {
  const id = requestId.next()
  send(['@@request-sync-context', args, id, true, func])
  Atomics.wait(sharedArray, 0, sharedArray[0])
  return readSharedArray(id)
}

export const requestSync = onFnCall((event: string, args: any[]) => {
  const id = requestId.next()
  send([event, args, id, true])
  Atomics.wait(sharedArray, 0, sharedArray[0])
  return readSharedArray(id)
})

export const workerData = (global as any).workerData
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
