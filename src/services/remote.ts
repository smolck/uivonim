import HttpServer from '../support/http-server'
import api from '../core/instance-api'
import { relative, join } from 'path'

interface RemoteRequest {
  cwd: string
  file: string
}

const load = async ({ cwd, file }: RemoteRequest) => {
  if (!file) return
  const vimCwd = api.nvim.state.cwd
  const base = cwd.includes(vimCwd) ? relative(vimCwd, cwd) : cwd
  const path = join(base, file)
  api.nvim.cmd(`e ${path}`)
}

HttpServer(42320).then(({ port, onJsonRequest }) => {
  process.env.VEONIM_REMOTE_PORT = port + ''
  api.nvim.cmd(`let $VEONIM_REMOTE_PORT='${port}'`)
  onJsonRequest<RemoteRequest>((data, reply) => (load(data), reply(201)))
})
