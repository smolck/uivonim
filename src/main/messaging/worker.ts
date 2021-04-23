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

export default class {
  private worker: Worker
  private ee: EventEmitter
  // TODO(smolck): Type for 'any' here, which is a func I think
  private pendingRequests: Map<string, any>
  private sharedBuffer: SharedArrayBuffer
  private sharedArray: Int32Array

  constructor(name: string, opts = {} as WorkerOptions) {
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
    this.worker = new Worker(objectUrl)
    URL.revokeObjectURL(objectUrl)

    this.ee = new EventEmitter()
    this.pendingRequests = new Map()
    this.sharedBuffer = new SharedArrayBuffer(opts.sharedMemorySize || 4)
    this.sharedArray = new Int32Array(this.sharedBuffer)

  this.worker.onmessage = async ({
    data: [e, data, id, requestSync, func],
  }: MessageEvent) => {
      if (e === '@@request-sync-context') {
        const listener = this.ee.listeners('context-handler')[0]
        if (!listener)
          throw new Error(
            'no "onContextHandler" function registered for synchronous RPC requests. you should register a function handler with "onContextHandler"'
          )
        try {
          const result = await listener(func, data)
          return this.writeSharedArray(id, result)
        } catch (err) {
          console.error(
            'worker request-sync-context response listener failed:',
            err
          )
          return this.writeSharedArray(id, undefined)
        }
      }

      if (requestSync) {
        const listener = this.ee.listeners(e)[0]
        if (!listener) return this.wakeThread()
        const result = await listener(...data)
        if (!result) return this.wakeThread()
        return this.writeSharedArray(id, result)
      }

      if (!id) return this.ee.emit(e, ...data)

      if (this.pendingRequests.has(id)) {
        this.pendingRequests.get(id)(data)
        this.pendingRequests.delete(id)
        return
      }

      const listener = this.ee.listeners(e)[0]
      if (!listener) return
      try {
        const result = await listener(...data)
        this.worker.postMessage([e, result, id])
      } catch (err) {
        console.error('worker request response listener failed:', err)
      }
    }
    this.worker.postMessage(['@@sab', [this.sharedBuffer]])
  }

  private wakeThread() {
    Atomics.notify(this.sharedArray, 0)
  }

  private writeSharedArray(id: number, data: any) {
    // need to handle undefined result. gonna use null
    // instead since json does not have undefined
    const jsonString = JSON.stringify(data) || 'null'
    const buffer = Buffer.from(jsonString)
    const length = buffer.byteLength
    for (let ix = 0; ix < length; ix++)
      Atomics.store(this.sharedArray, ix + 2, buffer[ix])
    Atomics.store(this.sharedArray, 1, length)
    Atomics.store(this.sharedArray, 0, id)
    this.wakeThread()
  }

  // TODO(smolck): Does this create a new one of these per instance, as I want
  // it to/think it does?
  call: EventFn = onFnCall((event: string, args: any[]) => this.worker.postMessage([event, args]))
  on = proxyFn((event: string, cb: (data: any) => void) => this.ee.on(event, cb))
  request: RequestEventFn = onFnCall((event: string, args: any[]) => {
    const task = CreateTask()
    const id = uuid()
    this.pendingRequests.set(id, task.done)
    this.worker.postMessage([event, args, id])
    return task.promise
  })
  onContextHandler: OnContextHandler = (fn) => this.ee.on('context-handler', fn)
  terminate = () => this.worker.terminate()
}
