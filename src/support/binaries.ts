import { SpawnOptions, ChildProcess, spawn } from 'child_process'

export const spawnBinary = (command: string, args?: string[], options?: SpawnOptions): ChildProcess => {
  const name = process.platform === 'win32' ? `${command}.exe` : command
  return spawn(name, args ?? [], options ?? {})
}
