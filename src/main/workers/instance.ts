import { VimMode, HyperspaceCoordinates } from '../neovim/types'
import { call, on, request } from './messaging/worker-client'
import * as bufferSearch from '../services/buffer-search'
import getWindowMetadata from './metadata'
import { GitStatus } from './git'
import * as git from './git'
import nvim from './neovim-api'
import '../services/mru-buffers'
import '../services/watch-reload'

// TODO: not used:
// require('../services/job-reader')

const actions = new Map<string, (args: any) => void>()
const state = {
  instanceIsActive: true,
}

nvim.onStateChange((nextState) => call.nvimStateUpdate(nextState))
git.onStatus((status: GitStatus) => call.gitStatus(status))
git.onBranch((onBranch: string) => call.gitBranch(onBranch))
// TODO: need another way to fix this
// nvim.onVimrcLoad(sourcedFile => call.vimrcLoaded(sourcedFile))

on.nvimOption((opt: string) => nvim.readonlyOptions[opt])

on.nvimGetHighlightByName((name: string, isRgb?: boolean) =>
  nvim.getHighlightByName(name, isRgb)
)
on.showNeovimMessage(request.showNeovimMessage)
on.showStatusBarMessage(call.showStatusBarMessage)
on.instanceActiveStatus((instanceIsActive: boolean) =>
  Object.assign(state, { instanceIsActive })
)
on.bufferSearch(async (file: string, query: string) =>
  bufferSearch.fuzzy(file, query)
)
on.bufferSearchVisible(async (query: string) =>
  bufferSearch.fuzzyVisible(query)
)
on.nvimJumpTo((coords: HyperspaceCoordinates) =>
  nvim.jumpTo(coords.line, coords.column, coords.path)
)
on.nvimExpr(async (expr: string) => nvim.eval(expr))
on.nvimFeedkeys((keys: string, mode: string) =>
  nvim.feedKeys(keys, mode, false)
)
on.nvimCall(async (name: string, args: any[]) => nvim.call(name, args))
on.nvimCommand(async (command: string) => {
  try {
    await nvim.command(command)
  } catch (e) {
    console.error(`Error running nvimCommand instance.ts: '${e}'`)
  }
})
on.nvimGetVar(async (key: string) => Reflect.get(nvim.g, key))
on.nvimGetKeymap(async () => nvim.getAndParseKeymap('n'))
on.nvimGetColorByName(async (name: string) => nvim.getColorByName(name))
on.setNvimMode((mode: VimMode) => Object.assign(nvim.state, { mode }))
on.getBufferInfo(async () => nvim.listBuffersWithInfo())
on.getGitInfo(async () => git.getGitInfo())
on.getState(async () => ({ ...nvim.state }))
on.getWindowMetadata(async () => getWindowMetadata())
on.nvimSaveCursor(async () => (await nvim.window).cursor)
on.nvimRestoreCursor(
  async (position: number[]) =>
    ((await nvim.window).cursor = [position[0], position[1]])
)

on.nvimHighlightSearchPattern(async (pattern: string, id?: number) =>
  nvim.highlightSearchPattern(pattern, id)
)
on.nvimRemoveHighlightSearch(async (id: number, pattern?: string) =>
  nvim.removeHighlightSearch(id, pattern)
)
on.onAction(async (name: string) => {
  if (!actions.has(name))
    actions.set(name, (...a: any[]) => call.actionCalled(name, a))
  const cb = actions.get(name)!
  nvim.onAction(name, cb)
})
