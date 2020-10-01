import { EventEmitter } from 'events'
import { ID } from '../support/utils'

export enum NeovimRPCDataType {
  onRequest,
  onResponse,
  onNotification,
}

export interface NeovimRPC {
  notify: (name: string, args: any[]) => void
  request: (name: string, args: any[]) => Promise<any>
  onEvent: (event: string, fn: (data: any) => void) => void
  handleRequest: (event: string, fn: Function) => void
}

export interface NeovimRPCAPI extends NeovimRPC {
  onData: (dataType: NeovimRPCDataType, data: any) => void
}

export default (send: (data: any[]) => void): NeovimRPCAPI => {
  const requestHandlers = new Map<string, Function>()
  const pendingRequests = new Map()
  const watchers = new EventEmitter()
  const id = ID()
  let onRedrawFn = (_a: any[]) => {}

  const noRequestMethodFound = (id: number) =>
    send([1, id, 'no one was listening for your request, sorry', null])

  const onVimRequest = (id: number, method: string, args: any[]) => {
    const reqHandler = requestHandlers.get(method)
    if (!reqHandler) return noRequestMethodFound(id)

    const maybePromise = reqHandler(...(args as any[]))

    if (maybePromise && maybePromise.then)
      maybePromise
        .then((result: any) => send([1, id, null, result]))
        .catch((err: string) => send([1, id, err, null]))
  }

  const onResponse = (id: number, error: string, result: any) => {
    if (!pendingRequests.has(id)) return

    const { done, fail } = pendingRequests.get(id)
    error ? fail(error) : done(result)
    pendingRequests.delete(id)
  }

  const onNotification = (method: string, args: any[]) =>
    method === 'redraw' ? onRedrawFn(args) : watchers.emit(method, args)

  const api = {} as NeovimRPC
  api.request = (name, args) => {
    const reqId = id.next()
    send([0, reqId, name, args])
    return new Promise((done, fail) =>
      pendingRequests.set(reqId, { done, fail })
    )
  }

  api.notify = (name, args) => send([2, name, args])

  // why === redraw? because there will only be one redraw fn and since it's a hot
  // path for perf, there is no need to iterate through the watchers to call redraw
  api.onEvent = (event, fn) =>
    event === 'redraw' ? (onRedrawFn = fn) : watchers.on(event, fn)

  api.handleRequest = (event, fn) => requestHandlers.set(event, fn)

  const onData: NeovimRPCAPI['onData'] = (type, d) => {
    if (type === 0) onVimRequest(d[0] as number, d[1].toString(), d[2] as any[])
    else if (type === 1) onResponse(d[0] as number, d[1] as string, d[2])
    else if (type === 2) onNotification(d[0].toString(), d[1] as any[])
  }

  return { ...api, onData }
}
