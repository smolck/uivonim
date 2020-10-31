import { onFnCall, proxyFn, uuid, CreateTask } from '../support/utils'
import { EventEmitter } from 'events'
import { join } from 'path'
import { platform } from 'os'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }
type OnContextHandler = (fn: (func: string, args: any[]) => any) => void

interface WorkerOptions {
  workerData?: any
  sharedMemorySize?: number
}

export default (name: string, opts = {} as WorkerOptions) => {
  const modulePath = join(__dirname, '..', 'workers', `${name}.js`)

  let loaderScript = `
    global.workerData = JSON.parse('${JSON.stringify(opts.workerData || {})}')
    require('${modulePath}')
  `

  if (platform() === 'win32') {
    loaderScript = loaderScript.replace(/\\/g, '\\\\')
  }

  const scriptBlobbyBluberBlob = new Blob([loaderScript], {
    type: 'application/javascript',
  })
  const objectUrl = URL.createObjectURL(scriptBlobbyBluberBlob)
  const worker = new Worker(objectUrl)
  URL.revokeObjectURL(objectUrl)
  const ee = new EventEmitter()
  const pendingRequests = new Map()
  const sharedBuffer = new SharedArrayBuffer(opts.sharedMemorySize || 4)
  const sharedArray = new Int32Array(sharedBuffer)

  // @ts-ignore - Atomics typings are wrong
  const wakeThread = () => Atomics.notify(sharedArray, 0)

  const writeSharedArray = (id: number, data: any) => {
    // need to handle undefined result. gonna use null
    // instead since json does not have undefined
    const jsonString = JSON.stringify(data) || 'null'
    const buffer = Buffer.from(jsonString)
    const length = buffer.byteLength
    for (let ix = 0; ix < length; ix++)
      Atomics.store(sharedArray, ix + 2, buffer[ix])
    Atomics.store(sharedArray, 1, length)
    Atomics.store(sharedArray, 0, id)
    wakeThread()
  }

  const call: EventFn = onFnCall((event: string, args: any[]) =>
    worker.postMessage([event, args])
  )
  const on = proxyFn((event: string, cb: (data: any) => void) =>
    ee.on(event, cb)
  )
  const request: RequestEventFn = onFnCall((event: string, args: any[]) => {
    const task = CreateTask()
    const id = uuid()
    pendingRequests.set(id, task.done)
    worker.postMessage([event, args, id])
    return task.promise
  })

  const onContextHandler: OnContextHandler = (fn) =>
    ee.on('context-handler', fn)

  worker.onmessage = async ({
    data: [e, data, id, requestSync, func],
  }: MessageEvent) => {
    if (e === '@@request-sync-context') {
      const listener = ee.listeners('context-handler')[0]
      if (!listener)
        throw new Error(
          'no "onContextHandler" function registered for synchronous RPC requests. you should register a function handler with "onContextHandler"'
        )
      try {
        const result = await listener(func, data)
        return writeSharedArray(id, result)
      } catch (err) {
        console.error(
          'worker request-sync-context response listener failed:',
          err
        )
        return writeSharedArray(id, undefined)
      }
    }

    if (requestSync) {
      const listener = ee.listeners(e)[0]
      if (!listener) return wakeThread()
      const result = await listener(...data)
      if (!result) return wakeThread()
      return writeSharedArray(id, result)
    }

    if (!id) return ee.emit(e, ...data)

    if (pendingRequests.has(id)) {
      pendingRequests.get(id)(data)
      pendingRequests.delete(id)
      return
    }

    const listener = ee.listeners(e)[0]
    if (!listener) return
    try {
      const result = await listener(...data)
      worker.postMessage([e, result, id])
    } catch (err) {
      console.error('worker request response listener failed:', err)
    }
  }

  const terminate = () => worker.terminate()

  worker.postMessage(['@@sab', [sharedBuffer]])

  return { on, call, request, onContextHandler, terminate }
}
