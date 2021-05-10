import { forceRegenerateFontAtlas } from '../render/font-texture-atlas'
import * as windows from '../windows/window-manager'
import * as dispatch from '../dispatch'
import * as workspace from '../workspace'
import { parseGuifont } from '../../common/utils'

const options = new Map<string, any>()

// TODO: this parsing logic needs to be revisited
// needs to handle all nvim formatting options
const updateFont = () => {
  const lineSpace = options.get('linespace')
  const guifont = options.get('guifont')

  const { face, size } = parseGuifont(guifont)
  const changed = workspace.updateEditorFont({ face, size, lineSpace })
  if (!changed) return

  const atlas = forceRegenerateFontAtlas()
  windows.webgl.updateFontAtlas(atlas)
  windows.webgl.updateCellSize()
  workspace.resize()
}

export const option_set = (e: any) => {
  e.slice(1).forEach(([k, value]: any) => options.set(k, value))

  updateFont()
}

export const set_title = ([, [title]]: [any, [string]]) =>
  dispatch.pub('vim:title', title)

export const wildmenu_show = ([, [items]]: any) =>
  dispatch.pub('wildmenu.show', items)
export const wildmenu_hide = () => dispatch.pub('wildmenu.hide')
export const wildmenu_select = ([, [selected]]: [any, [number]]) => {
  dispatch.pub('wildmenu.select', selected)
}
