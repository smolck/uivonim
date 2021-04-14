import { forceRegenerateFontAtlas } from '../render/font-texture-atlas'
import * as windows from '../windows/window-manager'
import * as workspace from '../core/workspace'
import * as electron from 'electron'

window.matchMedia('screen and (min-resolution: 2dppx)').addListener(() => {
  const atlas = forceRegenerateFontAtlas()
  windows.webgl.updateFontAtlas(atlas)
  windows.webgl.updateCellSize()
  workspace.resize()
  // TODO: idk why i have to do this but this works
  const win = electron.remote.getCurrentWindow()
  const [width, height] = win.getSize()
  win.setSize(width + 1, height)
  win.setSize(width, height)
})
