import { simplifyPath, pathReducer } from '../../common/utils'
// TODO(smolck): Imports from the main side . . . yeah that's probably not
// great, fix that?
import { BufferVar } from '../../main/neovim/function-types'
import { BufferOption } from '../../main/neovim/types'
import { WindowMetadata } from '../../common/types'

const improvedWindowTitle = (
  name: string,
  uniqNames: Set<string>,
  terminal: boolean
) => {
  if (terminal || !name) return { name }

  const uniqueNames = [...uniqNames].filter((m) => m !== name)
  const uniqueNameReducers = uniqueNames.map((m) => pathReducer(m))
  const nameReducer = pathReducer(name)

  const file = nameReducer.reduce()
  const uniqueFileNames = new Set(uniqueNameReducers.map((m) => m.reduce()))

  // TODO: go n-levels deeper
  return {
    name: file,
    dir: uniqueFileNames.has(file) ? nameReducer.reduce() : undefined,
  }
}

const betterTitles = (windows: any[]): WindowMetadata[] => {
  const uniqNames = new Set(windows.map((w) => w.name))
  return windows.map((w) => ({
    ...w,
    ...improvedWindowTitle(w.name, uniqNames, w.terminal),
  }))
}

export default async (): Promise<WindowMetadata[]> => {
  const activeWindow = nvim.window.id
  const wins = await nvim.tabpage.windows

  const windowsWithApiData = await Promise.all(
    wins.map(async (w) => {
      const buffer = await w.buffer

      return {
        id: w.id,
        active: w.id === activeWindow,
        filetype: await buffer.getOption(BufferOption.Filetype),
        name: (simplifyPath(await buffer.name, nvim.state.cwd) || '').replace(
          /^term:\/\/\.\/\/\w+:/,
          ''
        ),
        modified: await buffer.getOption(BufferOption.Modified),
        terminal: await nvim.isTerminalBuffer(buffer),
        termAttached: await buffer
          .getVar(BufferVar.TermAttached)
          .catch(() => false),
        termFormat: await buffer.getVar(BufferVar.TermFormat).catch(() => ''),
      }
    })
  )

  return betterTitles(windowsWithApiData)
}
