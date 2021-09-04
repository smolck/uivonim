import { sub } from './dispatch'
import {
  stringToKind,
  CompletionOption,
  show as pmenuShow,
  hide as pmenuHide,
  select as pmenuSelect,
} from './components/nvim/autocomplete'
import {
  wildmenuShow,
  wildmenuSelect,
  wildmenuHide,
  cmdlineHide,
  cmdlineUpdate,
} from './components/nvim/command-line'
import {
  show as signatureHelpShow,
  hide as signatureHelpHide,
} from './components/extensions/lsp-signature-help'
import LspReferences, {
  Reference,
  Refs,
} from './components/extensions/lsp-references'
import { listen } from './helpers'
import { CommandUpdate, PopupMenu } from './types'
import Workspace from './workspace'
import WindowManager from './windows/window-manager'
import {
  hideSearch,
  updateSearch,
  setSearchHideCallback,
} from './components/nvim/search'
import { vimBlur } from './ui/uikit'
import { render } from 'inferno'
import LspHover from './components/extensions/lsp-hover'
import { debounce } from './utils'

export default (workspace: Workspace, windowManager: WindowManager) => {
  // Focus textarea at start of application to receive input right away.
  // TODO(smolck): is this even necessary?
  document.getElementById('keycomp-textarea')?.focus()

  requestAnimationFrame(() => {
    // Wildmenu/Cmdline
    sub('wildmenu.show', wildmenuShow)
    sub('wildmenu.select', wildmenuSelect)
    sub('wildmenu.hide', wildmenuHide)
    sub('cmd.hide', () => {
      windowManager.cursor.enable()
      windowManager.cursor.show()

      cmdlineHide(workspace.fontDesc.size)
    })
    sub('cmd.update', (update: CommandUpdate) => {
      windowManager.cursor.hide()
      windowManager.cursor.disable()

      cmdlineUpdate(workspace.fontDesc.size, update)
    })

    // Popup menu
    sub('pmenu.select', (ix) => pmenuSelect(workspace, ix))
    sub('pmenu.hide', () => pmenuHide(workspace))
    sub('pmenu.show', ({ items, index, row, col }: PopupMenu) => {
      const options = items.map(
        (m) =>
          ({
            text: m.word,
            menu: m.menu,
            insertText: m.word,
            kind: stringToKind(m.kind),
            raw: {
              documentation: m.info,
            },
          } as CompletionOption)
      )

      pmenuShow(workspace, windowManager, { row, col, options })
      pmenuSelect(workspace, index)
    })
  })

  const hideSearchNess = () => {
    windowManager.cursor.enable()
    windowManager.cursor.show()
    hideSearch(workspace.fontDesc.size)

    document.getElementById('keycomp-textarea')?.focus()
  }
  setSearchHideCallback(hideSearchNess)
  sub('search.hide', hideSearchNess)
  sub('search.update', (cmdUpdate: CommandUpdate) => {
    windowManager.cursor.hide()
    windowManager.cursor.disable()

    updateSearch(
      windowManager.getActiveWindow(),
      workspace.fontDesc.size,
      cmdUpdate
    )
  })

  // TODO(smolck): Move `sub`s etc. here . . . maybe
  require('./components/nvim/statusline')
  require('./components/memes/nc')

  // See runtime/lua/uivonim.lua
  listen.signatureHelp(([showParams]) => {
    signatureHelpShow(windowManager, showParams)
  })
  listen.signatureHelpClose((_) => signatureHelpHide(windowManager))

  const lspRefsContainer = document.getElementById('references-container')
  listen.lspReferences(([items]) => {
    // TODO(smolck): Efficiency? This works but probably isn't the most
    // performant. Ideally could remove the intermediate map.
    //
    // This code essentially takes a series of code reference objects from Lua,
    // sorts them by filename (leveraging the map), and then turns that into
    // an array for use above.
    const itemsMap = items.reduce((map: Map<string, Reference[]>, x: any) => {
      const ref = {
        lineNum: x.lnum,
        column: x.col,
        text: x.text,
      } as Reference

      let maybeArr = map.get(x.filename)
      if (maybeArr) maybeArr.push(ref)
      else map.set(x.filename, [ref])

      return map
    }, new Map())

    let stuffToShow = [] as Refs[]
    itemsMap.forEach((value: Reference[], key: string) =>
      stuffToShow.push([key, value])
    )

    vimBlur(windowManager.cursor)
    render(
      <LspReferences
        fontSize={workspace.fontDesc.size + 2}
        cursor={windowManager.cursor}
        visible={true}
        references={stuffToShow}
      />,
      lspRefsContainer
    )
  })

  const lspHoverContainer = document.getElementById('hover-container')
  listen.lspHover(([markdownLines]) => {
    const doc = markdownLines.join('\n')

    const maxWidth =
      workspace.cell.width *
      (markdownLines.reduce(
        (acc: number, item: string[]) =>
          item.length > acc ? item.length : acc,
        markdownLines[0].length
      ) +
        2) // Add 2 to prevent wrapping unless necessary.

    const { x, y } = windowManager.pixelPositionRelativeToCursor(1, 0)

    render(
      <LspHover
        x={x}
        y={y}
        windowManager={windowManager}
        maxWidth={maxWidth}
        doc={doc}
        visible={true}
        workspaceWidth={workspace.size.width}
      />,
      lspHoverContainer
    )
  })

  listen.lspHoverClose((_) => {
    const { x, y } = windowManager.pixelPositionRelativeToCursor(1, 0)

    render(
      <LspHover
        x={x}
        y={y}
        windowManager={windowManager}
        maxWidth={0}
        doc={''}
        visible={false}
        workspaceWidth={workspace.size.width}
      />,
      lspHoverContainer
    )
  })

  sub(
    'redraw',
    debounce(() => {
      const { x, y } = windowManager.pixelPositionRelativeToCursor(1, 0)

      render(
        <LspHover
          x={x}
          y={y}
          windowManager={windowManager}
          maxWidth={0}
          doc={''}
          visible={false}
          workspaceWidth={workspace.size.width}
        />,
        lspHoverContainer
      )
    }, 50)
  )
}
