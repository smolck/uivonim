import MsgpackRPC, { RPC } from '../messaging/msgpack-rpc'
import MsgpackDecoder from '../messaging/msgpack-decoder'
import MsgpackEncoder from '../messaging/msgpack-encoder'
import { tryNetConnect } from '../support/utils'
import { Socket } from 'net'

export default (pipeName: string): RPC => {
  const encoder = new MsgpackEncoder()
  const decoder = new MsgpackDecoder()
  let socket: Socket
  let buffer: any[] = []
  let connected = false

  const connect = async () => {
    try {
      socket = await tryNetConnect(pipeName, 250)
    } catch (e) {
      console.error('fail to connect to:', pipeName)
    }

    if (!socket) return
    connected = true
    encoder.pipe(socket)
    socket.pipe(decoder)

    if (!buffer.length) return
    buffer.forEach((data) => encoder.write(data))
    buffer = []
  }

  const send = (data: any) => {
    if (!connected) buffer.push(data)
    else encoder.write(data)
  }

  const { onData, ...api } = MsgpackRPC(send)
  decoder.on('data', onData)
  connect()
  return api
}
