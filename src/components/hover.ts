import * as windows from '../windows/window-manager'
import { ColorData } from '../services/colorizer'
import { sub } from '../messaging/dispatch'
import { debounce } from '../support/utils'
import Overlay from '../components/overlay'
import { docStyle } from '../ui/styles'
import { cursor } from '../core/cursor'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'
import api from '../core/instance-api'
import { parse as stringToMarkdown } from 'marked'
import { resetMarkdownHTMLStyle } from '../ui/styles'

interface ShowParams {
  hoverHeight: number
  data: ColorData[][]
  doc?: string
}

// TODO(smolck): Should sanitize this HTML probably because safety.
const docs = (data: string) =>
  h('div', {
    style: docStyle,
    oncreate: (e: HTMLElement) =>
      (e.innerHTML = `<div>${stringToMarkdown(data)}</div>`),
    onupdate: (e: HTMLElement, _) =>
      (e.innerHTML = `<div>${stringToMarkdown(data)}</div>`),
  })

const getPosition = (row: number, col: number, heightOfHover: number) =>
  heightOfHover > row
    ? { ...windows.pixelPosition(row + 1, col), anchorBottom: false }
    : { ...windows.pixelPosition(row, col), anchorBottom: true }

const state = {
  value: [[]] as ColorData[][],
  visible: false,
  anchorBottom: true,
  hoverHeight: 2,
  doc: '',
  x: 0,
  y: 0,
}

type S = typeof state

const actions = {
  hide: () => ({ visible: false }),
  show: ({ data, doc, hoverHeight }: ShowParams) => ({
    doc,
    hoverHeight,
    value: data,
    visible: true,
    ...getPosition(cursor.row, cursor.col, hoverHeight),
  }),
  updatePosition: () => (s: S) =>
    s.visible ? getPosition(cursor.row, cursor.col, s.hoverHeight) : undefined,
}

type A = typeof actions

const view = ($: S) =>
  Overlay(
    {
      x: $.x,
      y: $.y,
      // TODO(smolck): Deal with width and stuff.
      // maxWidth: 600,
      visible: $.visible,
      anchorAbove: $.anchorBottom,
    },
    [
      $.doc && !$.anchorBottom && docs($.doc),
      $.doc && $.anchorBottom && docs($.doc),
    ]
  )

export const ui = app<S, A>({ name: 'hover', state, actions, view })

api.onAction('hover', (_, markdownLines) => {
  const doc = markdownLines.join('\n')
  ui.show({ data: [[]], doc, hoverHeight: markdownLines.length })
})

api.onAction('hover-close', () => ui.hide())

sub('redraw', debounce(ui.updatePosition, 50))
