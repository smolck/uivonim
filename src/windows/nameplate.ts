import { size } from '../core/workspace'
import * as Icon from 'hyperapp-feather'
import { uuid } from '../support/utils'
import { makel } from '../ui/vanilla'
import { h, app } from '../ui/uikit'
import { cvar } from '../ui/css'

export interface NameplateState {
  name?: string
  dir?: string
  active?: boolean
  modified?: boolean
  terminal?: boolean
  termAttached?: boolean
  termFormat?: string
}

type S = NameplateState

export default () => {
  const element = makel({
    display: 'flex',
    overflow: 'hidden',
    height: `${size.nameplateHeight}px`,
    minHeight: `${size.nameplateHeight}px`,
  })

  const state: NameplateState = {
    name: '',
    dir: '',
    active: false,
    modified: false,
    terminal: false,
    termAttached: false,
    termFormat: '',
  }

  const actions = { updateData: (data: S) => data }
  type A = typeof actions

  const view = ($: S) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          paddingLeft: '10px',
          paddingRight: '10px',
          alignItems: 'center',
          maxWidth: 'calc(100% - 20px)',
          background: cvar('background'),
        },
      },
      [
        ,
        $.terminal &&
          h(Icon.Terminal, {
            color: cvar('foreground-30'),
            style: {
              fontSize: '1.2rem',
              display: 'flex',
              marginRight: '8px',
              alignItems: 'center',
            },
          }),

        h(
          'div',
          {
            style: {
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              // TODO: need to contrast, not brighten
              filter: `brightness(${$.active ? 130 : 90}%)`,
            },
          },
          [
            ,
            $.dir &&
              h(
                'span',
                {
                  style: {
                    color: cvar('foreground-30'),
                    marginRight: '1px',
                  },
                },
                `${$.dir}/`
              ),

            h(
              'span',
              {
                style: {
                  color: cvar('foreground-50'),
                },
              },
              $.name || '[No Name]'
            ),
          ]
        ),

        $.modified &&
          h('div', {
            style: {
              width: '0.5rem',
              height: '0.5rem',
              marginTop: '2px',
              marginLeft: '8px',
              borderRadius: '50%',
              background: cvar('foreground-50'),
            },
          }),

        $.termAttached &&
          h(Icon.Eye, {
            color: cvar('foreground-40'),
            style: {
              marginLeft: '15px',
              marginRight: '4px',
              alignItems: 'center',
            },
          }),

        $.termAttached &&
          h(
            'div',
            {
              style: {
                color: cvar('foreground-50'),
                fontSize: '0.8rem',
              },
            },
            $.termFormat
          ),
      ]
    )

  const ui = app<S, A>({
    name: `nameplate-${uuid()}`,
    state,
    actions,
    view,
    element,
  })
  const update = (data: S) => ui.updateData(data)

  return { element, update }
}
