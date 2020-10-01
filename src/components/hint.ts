import { docStyle, resetMarkdownHTMLStyle } from '../ui/styles'
import * as windows from '../windows/window-manager'
import Overlay from '../components/overlay'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'

interface ShowParams {
  row: number
  col: number
  label: string
  currentParam: string
  documentation?: string
  paramDoc?: string
  totalSignatures: number
  selectedSignature: number
}

const fadedStyle = {
  color: cvar('foreground'),
  filter: 'opacity(60%)',
}

const strongStyle = {
  color: cvar('foreground'),
  fontWeight: 'bold',
}

const docs = (data: string) =>
  h('div', {
    style: {
      ...docStyle,
      // RowNormal gives us display: flex but this causes things
      // to be flex-flow: row. we just want the standard no fancy pls kthx
      display: 'block',
    },
    oncreate: (e: HTMLElement) =>
      (e.innerHTML = `<div class="${resetMarkdownHTMLStyle}">${data}</div>`),
  })

const sliceAndDiceLabel = (label: string, currentParam: string) => {
  const paramStart = label.indexOf(currentParam)
  const labelStart = label.slice(0, paramStart)
  const activeParam = label.slice(paramStart, paramStart + currentParam.length)
  const labelEnd = label.slice(paramStart + currentParam.length)
  return { labelStart, labelEnd, activeParam }
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

const state = {
  label: '',
  labelStart: '',
  labelEnd: '',
  currentParam: '',
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

const actions = {
  hide: () => ({ visible: false, label: '', row: 0 }),
  show: ({
    row,
    col,
    label,
    currentParam,
    documentation,
    paramDoc,
    selectedSignature,
    totalSignatures,
  }: ShowParams) => (s: S) => {
    const { labelStart, labelEnd, activeParam } = sliceAndDiceLabel(
      label,
      currentParam
    )
    const same = s.label === label && s.row === row
    const stuff = same
      ? {}
      : fresh({ row, col, documentation, selectedSignature, totalSignatures })

    return {
      ...stuff,
      label,
      labelStart,
      labelEnd,
      paramDoc,
      anchorBottom: row > 2,
      currentParam: activeParam,
      visible: true,
    }
  },
}

type A = typeof actions

const view = ($: S) =>
  Overlay(
    {
      ...windows.pixelPosition($.row > 2 ? $.row : $.row + 1, $.col - 1),
      zIndex: 200,
      maxWidth: 600,
      visible: $.visible,
      anchorAbove: $.anchorBottom,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            background: cvar('background-30'),
          },
        },
        [
          ,
          h(
            'div',
            {
              style: {
                background: cvar('background-45'),
                paddingBottom:
                  $.documentation || $.paramDoc ? '2px' : undefined,
              },
            },
            [
              ,
              $.documentation && docs($.documentation),
              $.paramDoc && docs($.paramDoc),
            ]
          ),

          h(
            'div',
            {
              style: {
                display: 'flex',
                padding: '8px',
                fontFamily: 'var(--font)',
                fontSize: 'var(--font-size)px',
              },
            },
            [
              ,
              h('div', [
                ,
                h('span', { style: fadedStyle }, [h('span', $.labelStart)]),
                h('span', { style: strongStyle }, [h('span', $.currentParam)]),
                h('span', { style: fadedStyle }, [h('span', $.labelEnd)]),
              ]),

              h(
                'div',
                {
                  render: $.totalSignatures > 1,
                  style: {
                    paddingLeft: '4px',
                    color: cvar('foreground'),
                  },
                },
                `${$.selectedSignature}/${$.totalSignatures}`
              ),
            ]
          ),
        ]
      ),
    ]
  )

export const ui = app<S, A>({ name: 'hint', state, actions, view })
