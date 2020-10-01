import { exists, watchFile } from '../support/utils'
import nvim from '../neovim/api'

const watchers = new Map<string, any>()

nvim.on.bufLoad(async () => {
  const filepath = nvim.state.absoluteFilepath
  if (!filepath) return
  if (watchers.has(filepath)) return
  if (!(await exists(filepath))) return
  const w = await watchFile(filepath, () => nvim.cmd(`checktime ${filepath}`))
  watchers.set(filepath, w)
})

nvim.on.bufClose(() => {
  const filepath = nvim.state.absoluteFilepath
  if (!filepath) return
  watchers.has(filepath) && watchers.get(filepath)!.close()
})
