import { RowNormal, RowComplete } from '../row-container'
import { resetMarkdownHTMLStyle } from '../../ui/styles'
import * as windows from '../../windows/window-manager'
import * as dispatch from '../../messaging/dispatch'
import * as workspace from '../../core/workspace'
import { PopupMenu } from '../../render/events'
import { paddingVH, cvar } from '../../ui/css'
import Overlay from '../overlay'
import { cursor } from '../../core/cursor'
import { parse as stringToMarkdown } from 'marked'
import { render } from 'inferno'
import Icon from '../icon'
const feather = require('feather-icons')

export interface CompletionShow {
  row: number
  col: number
  options: CompletionOption[]
}

export interface CompletionOption {
  /** Display text for the UI */
  text: string
  menu: string
  /** Text that will be inserted in the buffer */
  insertText: string
  /** An enum used to display a fancy icon and color in the completion menu UI */
  kind: CompletionItemKind
  /** The entire CompletionItem object. Is used by the UI to get/show documentation. If this does not exist the program will query a completion item provider from a relevant extensions */
  raw?: CompletionItem
}

// TODO(smolck): Should this be here or somewhere else?
export class CompletionItem {
  label: string
  kind: CompletionItemKind | undefined
  // @ts-ignore
  detail: string
  // @ts-ignore
  documentation: string | MarkdownString
  // @ts-ignore
  sortText: string
  // @ts-ignore
  filterText: string
  // @ts-ignore
  preselect: boolean
  // @ts-ignore
  insertText: string | SnippetString
  keepWhitespace?: boolean
  // @ts-ignore
  range: Range
  // @ts-ignore
  commitCharacters: string[]
  // @ts-ignore
  textEdit: TextEdit
  // @ts-ignore
  additionalTextEdits: TextEdit[]
  // @ts-ignore

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label
    this.kind = kind
  }

  toJSON(): any {
    return {
      label: this.label,
      kind: this.kind && CompletionItemKind[this.kind],
      detail: this.detail,
      documentation: this.documentation,
      sortText: this.sortText,
      filterText: this.filterText,
      preselect: this.preselect,
      insertText: this.insertText,
      textEdit: this.textEdit,
    }
  }
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

const MAX_VISIBLE_OPTIONS = 12

let state = {
  x: 0,
  y: 0,
  ix: 0,
  anchorAbove: false,
  options: [] as CompletionOption[],
  visible: false,
  documentation: {} as any,
  visibleOptions: MAX_VISIBLE_OPTIONS,
}

type S = typeof state

const icon = (name: string, color?: string) => {
  return (
    <Icon
      iconHtml={feather.icons[name].toSvg({ width: 12, height: 12 })}
      style={{ color }}
    />
  )
}

const icons = new Map([
  [CompletionItemKind.Text, icon('chevrons-right')],
  [CompletionItemKind.Method, icon('box')],
  [CompletionItemKind.Property, icon('disc', '#54c8ff')],
  [CompletionItemKind.Function, icon('share-2', '#6da7ff')],
  [CompletionItemKind.Constructor, icon('aperture', '#c9ff56')],
  [CompletionItemKind.Field, icon('feather', '#9866ff')],
  [CompletionItemKind.Variable, icon('database', '#ff70e4')],
  [CompletionItemKind.Class, icon('compass', '#ffeb5b')],
  [CompletionItemKind.Interface, icon('map', '#ffa354')],
  [CompletionItemKind.Module, icon('grid', '#ff5f54')],
  [CompletionItemKind.Unit, icon('cpu', '#ffadc5')],
  [CompletionItemKind.Value, icon('bell', '#ffa4d0')],
  [CompletionItemKind.Enum, icon('award', '#84ff54')],
  [CompletionItemKind.Keyword, icon('navigation', '#ff0c53')],
  [CompletionItemKind.Snippet, icon('paperclip', '#0c2dff')],
  [CompletionItemKind.Color, icon('eye', '#54ffe5')],
  [CompletionItemKind.File, icon('file', '#a5c3ff')],
  [CompletionItemKind.Reference, icon('link', '#ffdca3')],
  // TODO: we need some colors pls
  [CompletionItemKind.Folder, icon('folder', '#ccc')],
  [CompletionItemKind.EnumMember, icon('menu', '#ccc')],
  [CompletionItemKind.Constant, icon('save', '#ccc')],
  [CompletionItemKind.Struct, icon('layers', '#ccc')],
  [CompletionItemKind.Event, icon('video', '#ccc')],
  [CompletionItemKind.Operator, icon('anchor', '#ccc')],
  [CompletionItemKind.TypeParameter, icon('type', '#ccc')],
])

const getCompletionIcon = (kind: CompletionItemKind) =>
  icons.get(kind) || icon('code')

// TODO: move to common place. used in other places like signature-hint
const parseDocs = (docs?: string): string | undefined => {
  if (!docs) return
  return stringToMarkdown(docs)
}

const docs = (data: string) => (
  // @ts-ignore TS wants children but there are none so ignore
  <RowNormal
    dangerouslySetInnerHTML={{
      __html: `<div class=${resetMarkdownHTMLStyle}>${data}</div>`,
    }}
    active={false}
    style={{
      ...paddingVH(6, 4),
      // RowNormal gives us display: flex but this causes things
      // to be flex-flow: row. we just want the standard no fancy pls kthx
      display: 'block',
      overflow: 'visible',
      color: cvar('foreground-b20'),
      background: cvar('background-10'),
      'padding-top': '6px',
      'white-space': 'normal',
      'font-size': `${workspace.font.size - 2}px`,
    }}
  />
)

const tdStyle: CSSProperties = {
  'padding-right': '16px',
  'line-height': cvar('line-height'),
  'font-family': 'var(--font)',
  'font-size': 'var(--font-size)px',
}

const Autocomplete = ({
  documentation,
  x,
  y,
  visible,
  visibleOptions,
  ix,
  anchorAbove,
  options,
}: S) => (
  <Overlay
    id={'autocomplete'}
    x={x}
    y={y}
    zIndex={200}
    maxWidth={workspace.size.width} // TODO(smolck)
    visible={visible}
    anchorAbove={anchorAbove}
  >
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
      }}
    >
      <div
        style={{
          background: cvar('background-30'),
          display: 'flex',
          overflow: 'hidden',
          'flex-direction': 'row',
          'max-height': `${workspace.cell.height * visibleOptions}px`,
        }}
      >
        <table style={{ overflow: 'hidden' }}>
          {options.map(({ text, kind, menu }, id) => (
            <tr
              style={{
                color:
                  id === ix ? cvar('foreground-b20') : cvar('foreground-30'),
              }}
            >
              <td
                style={{
                  display: 'flex',
                  // TODO: this doesn't scale with font size?
                  width: '16',
                  'align-items': 'center',
                  'justify-content': 'center',
                }}
              >
                {getCompletionIcon(kind)}
              </td>
              <td style={tdStyle}>{text}</td>
              <td style={tdStyle}>{menu}</td>
            </tr>
          ))}
        </table>
      </div>
      {documentation && (
        <div>{docs(documentation)}</div>
      )}
    </div>
  </Overlay>
)

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
container.id = 'autocomplete-container'
plugins?.appendChild(container)

export const hide = () => {
  state.visible = false
  state.ix = 0

  render(<Autocomplete {...state} />, container)
}

export const select = (index: number) => {
  const completionItem = (state.options[index] || {}).raw
  state.ix = index

  // raw could be missing if not semantic completions
  if (!completionItem) {
    state.documentation = undefined
    render(<Autocomplete {...state} />, container)
    return
  }

  const { detail, documentation } = completionItem
  // TODO: what are we doing with detail and documentation?
  // show both? or one or the other?

  // TODO(smolck): `&& documentation !== 32` because 32 means there's no docs,
  // I think. Long story kinda.
  if (documentation && documentation !== 32) {
    state.documentation = parseDocs(documentation.toString())
    render(<Autocomplete {...state} />, container)
  } else {
    state.documentation = parseDocs(detail)
    render(<Autocomplete {...state} />, container)
  }
}
export const show = ({ row, col, options }: CompletionShow) => {
  const visibleOptions = Math.min(MAX_VISIBLE_OPTIONS, options.length)
  const anchorAbove = cursor.row + visibleOptions > workspace.size.rows

  Object.assign(state, {
    visibleOptions,
    anchorAbove,
    options: options.slice(0, visibleOptions),
    documentation: undefined,
    visible: true,
    ix: -1,
    ...windows.pixelPosition(anchorAbove ? row : row + 1, col),
  })

  render(<Autocomplete {...state} />, container)
}

dispatch.sub('pmenu.select', (ix) => select(ix))
dispatch.sub('pmenu.hide', hide)
dispatch.sub('pmenu.show', ({ items, index, row, col }: PopupMenu) => {
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

  show({ row, col, options })
  select(index)
})

// TODO(smolck): Support more kinds.
// Names and things taken from:
// https://github.com/vhakulinen/gnvim/blob/1afac027e15623affd3e5435b88e056e0394c2f8/src/nvim_bridge/mod.rs#L276
const completionKindMappings = new Map([
  ['Variable', CompletionItemKind.Variable],
  ['variable', CompletionItemKind.Variable],
  ['V', CompletionItemKind.Variable],

  ['function', CompletionItemKind.Function],
  ['Function', CompletionItemKind.Function],

  ['property', CompletionItemKind.Property],
  ['Property', CompletionItemKind.Property],
  ['method', CompletionItemKind.Property],
  ['Method', CompletionItemKind.Property],
  ['f', CompletionItemKind.Property],

  ['type paramter', CompletionItemKind.TypeParameter],
  ['Type Parameter', CompletionItemKind.TypeParameter],
  ['T', CompletionItemKind.TypeParameter],

  ['interface', CompletionItemKind.Interface],
  ['I', CompletionItemKind.Interface],
  ['Interface', CompletionItemKind.Interface],
])

const stringToKind = (kind: string): CompletionItemKind => {
  return completionKindMappings.get(kind) || CompletionItemKind.Text
}
