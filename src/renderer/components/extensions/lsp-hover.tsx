import * as windows from '../../windows/window-manager'
import { ColorData } from '../../../common/colorize-with-highlight'
import { sub } from '../../dispatch'
import { debounce } from '../../../common/utils'
import Overlay from '../overlay'
import { docStyle } from '../../ui/styles'
import { cursor } from '../../cursor'
import { parse as stringToMarkdown, setOptions } from 'marked'
import { render } from 'inferno'
import { cell, size as workspaceSize } from '../../workspace'
import { listen } from '../../helpers'

setOptions({
  highlight: (code, lang, _) => {
    const hljs = require('highlight.js/lib/core')
    hljs.registerLanguage(lang, require(`highlight.js/lib/languages/${lang}`))

    const highlightedCode = hljs.highlight(code, { language: lang }).value
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
const docs = (data: string) => (
  <div
    style={docStyle as CSSProperties}
    dangerouslySetInnerHTML={{ __html: `<div>${stringToMarkdown(data)}` }}
  />
)

const getPosition = (row: number, col: number, heightOfHover: number) =>
  heightOfHover > row
    ? { ...windows.pixelPosition(row + 1, col), anchorBottom: false }
    : { ...windows.pixelPosition(row, col), anchorBottom: true }

let state = {
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

const Hover = ({ doc, visible, x, y, anchorBottom, maxWidth }: S) => (
  <Overlay
    id={'hover'}
    visible={visible}
    x={x}
    y={y}
    anchorAbove={anchorBottom}
    maxWidth={Math.max(0, Math.min(maxWidth, workspaceSize.width))}
  >
    {doc && !anchorBottom && docs(doc)}
    {doc && anchorBottom && docs(doc)}
  </Overlay>
)

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
container.id = 'hover-container'
plugins?.appendChild(container)

const hide = () => (
  (state.visible = false), render(<Hover {...state} />, container)
)
const show = ({ data, doc, hoverHeight, maxWidth }: ShowParams) => {
  if (doc) state.doc = doc
  Object.assign(state, {
    hoverHeight,
    maxWidth,
    value: data,
    visible: true,
    ...getPosition(cursor.row, cursor.col, hoverHeight),
  })

  render(<Hover {...state} />, container)
}
const updatePosition = () => {
  if (state.visible)
    Object.assign(state, getPosition(cursor.row, cursor.col, state.hoverHeight))

  render(<Hover {...state} />, container)
}

listen.lspHover(([markdownLines]) => {
  const doc = markdownLines.join('\n')

  const maxWidth =
    cell.width *
    (markdownLines.reduce(
      (acc: number, item: string[]) => (item.length > acc ? item.length : acc),
      markdownLines[0].length
    ) +
      2) // Add 2 to prevent wrapping unless necessary.

  show({ data: [[]], doc, maxWidth, hoverHeight: markdownLines.length })
})

listen.lspHoverClose((_) => hide())

sub('redraw', () => {
  if (state.visible) debounce(updatePosition, 50)
})
