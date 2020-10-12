import * as windows from '../windows/window-manager'
import Overlay from '../components/overlay'
import { sub } from '../messaging/dispatch'
import { debounce } from '../support/utils'
import * as Icon from 'hyperapp-feather'
import { cursor } from '../core/cursor'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'

const getPosition = (row: number, col: number) => ({
  ...windows.pixelPosition(row > 2 ? row : row + 1, col - 1),
  anchorBottom: cursor.row > 2,
})

const state = {
  x: 0,
  y: 0,
  value: '',
  visible: false,
  anchorBottom: true,
}

type S = typeof state

const actions = {
  hide: () => ({ visible: false }),
  show: (value: string) => ({
    value,
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
      h(
        'div',
        {
          style: {
            background: cvar('background-30'),
            color: cvar('foreground'),
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font)',
            fontSize: 'var(--font-size)px',
          },
        },
        [
          ,
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                paddingRight: '8px',
              },
            },
            [
              ,
              h(Icon.XCircle, {
                style: { fontSize: '1.2rem' },
                color: cvar('error'),
              }),
            ]
          ),

          h('div', $.value),
        ]
      ),
    ]
  )

export const ui = app<S, A>({ name: 'problem-info', state, actions, view })

sub('redraw', debounce(ui.updatePosition, 50))
