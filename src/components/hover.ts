import * as windows from '../windows/window-manager'
import { ColorData } from '../services/colorizer'
import { sub } from '../messaging/dispatch'
import { debounce } from '../support/utils'
import Overlay from '../components/overlay'
import { docStyle } from '../ui/styles'
import { cursor } from '../core/cursor'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'

interface ShowParams {
  data: ColorData[][]
  doc?: string
}

const docs = (data: string) => h('div', { style: docStyle }, [h('div', data)])

const getPosition = (row: number, col: number) => ({
  ...windows.pixelPosition(row > 2 ? row : row + 1, col - 1),
  anchorBottom: cursor.row > 2,
})

const state = {
  value: [[]] as ColorData[][],
  visible: false,
  anchorBottom: true,
  doc: '',
  x: 0,
  y: 0,
}

type S = typeof state

const actions = {
  hide: () => ({ visible: false }),
  show: ({ data, doc }: ShowParams) => ({
    doc,
    value: data,
    visible: true,
    ...getPosition(cursor.row, cursor.col),
  }),
  updatePosition: () => (s: S) =>
    s.visible ? getPosition(cursor.row, cursor.col) : undefined,
}

type A = typeof actions

const view = ($: S) =>
  Overlay(
    {
      x: $.x,
      y: $.y,
      maxWidth: 600,
      visible: $.visible,
      anchorAbove: $.anchorBottom,
    },
    [
      ,
      $.doc && !$.anchorBottom && docs($.doc),

      h(
        'div',
        {
          style: {
            background: cvar('background-30'),
            padding: '8px',
          },
        },
        $.value.map((m) =>
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexFlow: 'row wrap',
              },
            },
            m.map(({ color, text }) =>
              h(
                'span',
                {
                  style: {
                    color: color || cvar('foreground'),
                    whiteSpace: 'pre',
                    fontFamily: 'var(--font)',
                    fontSize: 'var(--font-size)px',
                  },
                },
                text
              )
            )
          )
        )
      ),

      $.doc && $.anchorBottom && docs($.doc),
    ]
  )

export const ui = app<S, A>({ name: 'hover', state, actions, view })

sub('redraw', debounce(ui.updatePosition, 50))
