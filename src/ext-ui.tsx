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
import { CommandUpdate, PopupMenu } from './types'
import Workspace from './workspace'
import WindowManager from './windows/window-manager'
import { hideSearch, updateSearch, setSearchHideCallback } from './components/nvim/search'

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

      cmdlineHide()
    })
    sub('cmd.update', (update: CommandUpdate) => {
      windowManager.cursor.hide()
      windowManager.cursor.disable()

      cmdlineUpdate(update)
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
    hideSearch()

    document.getElementById('keycomp-textarea')?.focus()
  }
  setSearchHideCallback(hideSearchNess)
  sub('search.hide', hideSearchNess)
  sub('search.update', (cmdUpdate: CommandUpdate) => {
    windowManager.cursor.hide()
    windowManager.cursor.disable()

    updateSearch(windowManager.getActiveWindow(), cmdUpdate)
  })
  
  // TODO(smolck): Move `sub`s etc. here
  require('./components/nvim/statusline')
}
