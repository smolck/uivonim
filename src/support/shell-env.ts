import { NewlineSplitter } from '../support/utils'
import { spawn } from 'child_process'

const ansiEscape = new RegExp(
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  'g'
)

const defaultShell = () => {
  if (process.platform === 'darwin') return process.env.SHELL || '/bin/bash'
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe'
  return process.env.SHELL || '/bin/sh'
}

const cleanup = (thing: string) =>
  thing.replace(/^_SHELL_ENV_DELIMITER_/, '').replace(ansiEscape, '')

export default (shell = defaultShell()) =>
  new Promise((done) => {
    if (process.platform === 'win32') return done(process.env)

    const vars = process.env
    const proc = spawn(shell, [
      '-ilc',
      'echo -n "_SHELL_ENV_DELIMITER_"; env; echo -n "_SHELL_ENV_DELIMITER_"; exit',
    ])

    proc.stdout!.pipe(new NewlineSplitter()).on('data', (line: string) => {
      if (!line) return
      const cleanLine = cleanup(line)
      const [key, ...valParts] = cleanLine.split('=')
      const val = valParts.join('=')
      Reflect.set(vars, key, val)
    })

    proc.on('exit', () => done(vars))
  })
