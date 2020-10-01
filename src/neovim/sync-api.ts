import nvim from '../neovim/api'
import { Script } from 'vm'

export default (func: string, args: any[]) => {
  try {
    const theFunctionToRun = new Script(func).runInThisContext()
    return theFunctionToRun(nvim, ...args)
  } catch (err) {
    console.error('sync-api function failed', args, func, err)
  }
}
