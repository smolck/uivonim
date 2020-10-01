'use strict'

const { src, getPipeName } = require('./util')
const path = require('path')

module.exports = (xdgConfigPath) => {
  const xdgConfig = xdgConfigPath || path.join(__dirname, '../xdg_config')
  const { Neovim } = src('support/binaries')
  const { startupFuncs, startupCmds } = src('neovim/startup')
  const Decoder = src('messaging/msgpack-decoder').default
  const Encoder = src('messaging/msgpack-encoder').default
  const SetupRPC = src('messaging/rpc').default
  const pipeName = getPipeName('veonim-test')

  const proc = src('support/binaries').Neovim.run(
    [
      '--cmd',
      `${startupFuncs()} | ${startupCmds}`,
      '--cmd',
      `com! -nargs=* Plug 1`,
      '--cmd',
      `com! -nargs=* VeonimExt 1`,
      '--cmd',
      `com! -nargs=+ -range Veonim call Veonim(<f-args>)`,
      '--embed',
      '--listen',
      pipeName,
    ],
    {
      ...process.env,
      VIM: Neovim.path,
      VIMRUNTIME: Neovim.runtime,
      XDG_CONFIG_HOME: xdgConfig,
    }
  )

  const encoder = new Encoder()
  const decoder = new Decoder()
  encoder.pipe(proc.stdin)
  proc.stdout.pipe(decoder)
  const { notify, request, onData } = SetupRPC(encoder.write)

  decoder.on('data', ([type, ...d]) => onData(type, d))

  const shutdown = () => proc.kill()

  return {
    proc,
    shutdown,
    pipeName,
    notify: (name, ...args) => notify(`nvim_${name}`, args),
    request: (name, ...args) => request(`nvim_${name}`, args),
  }
}
