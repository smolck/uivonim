import * as windows from '../../windows/window-manager'
import { ColorData } from '../../services/colorizer'
import { sub } from '../../messaging/dispatch'
import { debounce } from '../../support/utils'
import Overlay from '../overlay'
import { docStyle } from '../../ui/styles'
import { cursor } from '../../core/cursor'
import { h, app } from '../../ui/uikit'
import { parse as stringToMarkdown, setOptions } from 'marked'
import api from '../../core/instance-api'
import { cell, size as workspaceSize } from '../../core/workspace'

setOptions({
  highlight: (code, lang, _) => {
    const hljs = require('highlight.js/lib/core')
    hljs.registerLanguage(lang, require(`highlight.js/lib/languages/${lang}`))

    const highlightedCode = hljs.highlight(lang, code).value
    return highlightedCode
  },
})

interface ShowParams {
  hoverHeight: number
  maxWidth: number
  data: ColorData[][]
  doc?: string
}

// TODO(smolck): Should sanitize this HTML probably because safety.
const docs = (data: string) =>
  h('div', {
    style: docStyle,
    oncreate: (e: HTMLElement) =>
      (e.innerHTML = `<div>${stringToMarkdown(data)}</div>`),
    onupdate: (e: HTMLElement, _: any) =>
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
  maxWidth: 400, // TODO(smolck): Sane default? Is this even necessary?
  doc: '',
  x: 0,
  y: 0,
}

type S = typeof state

const actions = {
  hide: () => ({ visible: false }),
  show: ({ data, doc, hoverHeight, maxWidth }: ShowParams) => ({
    doc,
    hoverHeight,
    maxWidth,
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
      maxWidth: Math.max(0, Math.min($.maxWidth, workspaceSize.width)),
      visible: $.visible,
      anchorAbove: $.anchorBottom,
    },
    [
      $.doc && !$.anchorBottom && docs($.doc),
      $.doc && $.anchorBottom && docs($.doc),
    ]
  )

const ui = app<S, A>({ name: 'hover', state, actions, view })

api.onAction('hover', (_, markdownLines) => {
  const doc = markdownLines.join('\n')

  const maxWidth =
    cell.width *
    (markdownLines.reduce(
      (acc, item) => (item.length > acc ? item.length : acc),
      markdownLines[0].length
    ) +
      2) // Add 2 to prevent wrapping unless necessary.
  ui.show({ data: [[]], doc, maxWidth, hoverHeight: markdownLines.length })
})

api.onAction('hover-close', () => ui.hide())

sub('redraw', debounce(ui.updatePosition, 50))
