import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'

interface HttpServer {
  server: Server
  port: number
  onRequest(handler: (req: IncomingMessage, res: ServerResponse) => void): void
  onJsonRequest<T>(
    handler: (req: T, res: (status: number, data?: any) => void) => void
  ): void
}

const reply = (res: ServerResponse) => (status = 200, data?: any) => {
  res.writeHead(status)
  res.end(data)
}

const attemptStart = (port = 8001, srv = createServer()): Promise<HttpServer> =>
  new Promise((fin, fail) => {
    srv.on('error', (e) =>
      port < 65536
        ? attemptStart(port + 1, srv)
        : fail(`tried a bunch of ports but failed ${e}`)
    )

    srv.listen(port, () =>
      fin({
        server: srv,
        port: (srv.address() as AddressInfo).port,
        onRequest: (cb) => srv.on('request', cb),
        onJsonRequest: (cb) =>
          srv.on('request', (req: IncomingMessage, res: ServerResponse) => {
            if (req.headers.host !== `localhost:${port}`)
              return console.warn(`blocked request with invalid host header`)
            let buf = ''
            req.on('data', (m) => (buf += m))
            req.on('end', () => {
              try {
                cb(JSON.parse(buf), reply(res))
              } catch (e) {}
            })
          }),
      })
    )
  })

export default attemptStart
