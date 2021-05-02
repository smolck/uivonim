import { exists, watchFile } from '../../common/utils'
import nvim from '../workers/tbd-folder-name/neovim-api'

const watchers = new Map<string, any>()

nvim.on.bufLoad(async () => {
  const filepath = nvim.state.absoluteFilepath
  if (!filepath) return
  if (watchers.has(filepath)) return
  if (!(await exists(filepath))) return
  const w = await watchFile(filepath, () =>
    nvim.command(`checktime ${filepath}`)
  )
  watchers.set(filepath, w)
})

nvim.on.bufClose(() => {
  const filepath = nvim.state.absoluteFilepath
  if (!filepath) return
  watchers.has(filepath) && watchers.get(filepath)!.close()
})
