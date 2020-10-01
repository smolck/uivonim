import MsgpackStreamDecoder from '../messaging/msgpack-decoder'
import MsgpackStreamEncoder from '../messaging/msgpack-encoder'
import { createConnection } from 'net'

interface Client {
  id: number
  path: string
  socket: NodeJS.Socket
}

export default (onDataSender?: (...args: any[]) => void) => {
  let sendRecvDataFn = (..._: any[]) => {}
  if (onDataSender) sendRecvDataFn = onDataSender

  const encoder = new MsgpackStreamEncoder()
  const decoder = new MsgpackStreamDecoder()
  const clients = new Map<number, Client>()
  const config = { current: -1 }
  let buffer: any[] = []
  let connected = false

  const connectTo = ({ id, path }: { id: number; path: string }) => {
    connected = false
    const socket = createConnection(path)

    socket.on('end', () => {
      socket.unpipe()
      clients.delete(id)
    })

    clients.set(id, { id, path, socket })
  }

  const switchTo = (id: number) => {
    if (!clients.has(id)) return
    const { socket } = clients.get(id)!

    if (config.current > -1) {
      encoder.unpipe()
      const socketMaybe = clients.get(config.current)
      if (socketMaybe) socketMaybe.socket.unpipe()
    }

    encoder.pipe(socket)
    socket.pipe(decoder, { end: false })

    if (buffer.length) {
      buffer.forEach((data) => encoder.write(data))
      buffer = []
    }

    connected = true
    config.current = id
  }

  const send = (data: any) => {
    if (!connected) buffer.push(data)
    else encoder.write(data)
  }

  const onRecvData = (fn: (...args: any[]) => void) => (sendRecvDataFn = fn)
  decoder.on('data', ([type, ...d]: [number, any]) => sendRecvDataFn([type, d]))

  return { send, connectTo, switchTo, onRecvData }
}
