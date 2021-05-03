import { docStyle, resetMarkdownHTMLStyle } from '../../ui/styles'
import * as windows from '../../windows/window-manager'
import Overlay from '../overlay'
import { cvar } from '../../ui/css'
import { render } from 'inferno'
import { parse as stringToMarkdown } from 'marked'
import { Events } from '../../../common/ipc'

interface ShowParams {
  row: number
  col: number
  label: string
  activeParam: string | [number, number]
  documentation?: string
  paramDoc?: string
  totalSignatures: number
  selectedSignature: number
}

const fadedStyle: CSSProperties = {
  color: cvar('foreground'),
  filter: 'opacity(60%)',
}

const strongStyle: CSSProperties = {
  color: cvar('foreground'),
  'font-weight': 'bold',
}

// TODO(smolck): Inner HTML sanitization (?)
const docs = (data: string) => (
  <div
    style={
      {
        ...docStyle,
        // RowNormal gives us `display: flex` but this causes things
        // to be `flex-flow: row`. we just want the standard no fancy pls kthx
        display: 'block',
      } as CSSProperties
    }
    dangerouslySetInnerHTML={{
      __html: `<div class="${resetMarkdownHTMLStyle}">${stringToMarkdown(
        data
      )}</div>`,
    }}
  />
)

const sliceAndDiceLabel = (
  label: string,
  activeParam: string | [number, number]
) => {
  let x, labelStart, labelEnd

  if (typeof activeParam === 'string') {
    const paramStart = label.indexOf(activeParam)
    labelStart = label.slice(0, paramStart)
    x = label.slice(paramStart, paramStart + activeParam.length)
    labelEnd = label.slice(paramStart + activeParam.length)
  } else {
    labelStart = label.slice(0, activeParam[0])
    x = label.slice(activeParam[0], activeParam[1])
    labelEnd = label.slice(activeParam[1])
  }

  return { labelStart, labelEnd, activeParam: x }
}

const fresh = ({
  row,
  col,
  documentation,
  selectedSignature,
  totalSignatures,
}: any) => ({
  row,
  col,
  documentation,
  selectedSignature,
  totalSignatures,
})

let state = {
  label: '',
  labelStart: '',
  labelEnd: '',
  activeParam: '',
  documentation: '',
  paramDoc: '',
  anchorBottom: true,
  totalSignatures: 0,
  selectedSignature: 0,
  visible: false,
  row: 0,
  col: 0,
}

type S = typeof state

const SignatureHelp = ({
  documentation,
  paramDoc,
  anchorBottom,
  visible,
  row,
  col,
  labelStart,
  labelEnd,
  activeParam,
  totalSignatures,
  selectedSignature,
}: S) => (
  <Overlay
    id={'signature-help'}
    {...windows.pixelPosition(row > 2 ? row : row + 1, col - 1)}
    zIndex={200}
    maxWidth={600}
    visible={visible}
    anchorAbove={anchorBottom}
  >
    <div style={{ background: cvar('background-30') }}>
      <div
        style={{
          background: cvar('background-45'),
          'padding-bottom': documentation || paramDoc ? '2px' : undefined,
        }}
      >
        {documentation && docs(documentation)}
        {paramDoc && docs(paramDoc)}
      </div>

      <div
        style={{
          display: 'flex',
          padding: '8px',
          'font-family': 'var(--font)',
          'font-size': 'var(--font-size)px',
        }}
      >
        <div>
          <span style={fadedStyle}>
            <span>{labelStart}</span>
          </span>

          <span style={strongStyle}>
            <span>{activeParam}</span>
          </span>

          <span style={fadedStyle}>
            <span>{labelEnd}</span>
          </span>
        </div>

        {totalSignatures > 1 && (
          // TODO, smolck: With hyperapp, there was this sort of property:
          // `render: totalSignatures > 1`. What did that do?
          <div style={{ 'padding-left': '4px', color: cvar('foreground') }}>
            {selectedSignature}/{totalSignatures}
          </div>
        )}
      </div>
    </div>
  </Overlay>
)

const plugins = document.getElementById('plugins')
const container = document.createElement('div')
container.id = 'signature-help-container'
plugins?.appendChild(container)

const hide = () => (
  (state = Object.assign(state, { visible: false, label: '', row: 0 })),
  render(<SignatureHelp {...state} />, container)
)

const show = ({
  row,
  col,
  label,
  activeParam: x,
  documentation,
  paramDoc,
  selectedSignature,
  totalSignatures,
}: ShowParams) => {
  const { labelStart, labelEnd, activeParam } = sliceAndDiceLabel(label, x)
  const same = state.label === label && state.row === row
  const stuff = same
    ? {}
    : fresh({ row, col, documentation, selectedSignature, totalSignatures })

  Object.assign(state, {
    ...stuff,
    label,
    labelStart,
    labelEnd,
    paramDoc,
    anchorBottom: row > 2,
    activeParam: activeParam,
    visible: true,
  })

  render(<SignatureHelp {...state} />, container)
}

// See runtime/lua/uivonim.lua
window.api.on(Events.signatureHelpAction, (_, showParams) => {
  show(showParams)
})

window.api.on(Events.signatureHelpCloseAction, hide)
