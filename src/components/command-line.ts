import {
  enableCursor,
  disableCursor,
  hideCursor,
  showCursor,
} from '../core/cursor'
import { CommandType, CommandUpdate } from '../render/events'
import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import Input from '../components/text-input'
import { sub } from '../messaging/dispatch'
import * as Icon from 'hyperapp-feather'
import { is } from '../support/utils'
import { h, app } from '../ui/uikit'

const modeSwitch = new Map([
  [CommandType.Ex, Icon.Command],
  [CommandType.Prompt, Icon.ChevronsRight],
])

const state = {
  options: [] as string[],
  visible: false,
  value: '',
  ix: 0,
  position: 0,
  prompt: '',
  kind: CommandType.Ex,
}

type S = typeof state

const actions = {
  // there is logic in text-input to show/hide cursor based on text input
  // foucs/blur events. however i noticed that when selecting a wildmenu option
  // somehow causes the text input to lose focus (we need to update the
  // selected menu item in the text input field). i'm not sure why this is
  // different than the normal command update, since we do not use the text
  // input natively. we send input events directly to vim, vim sends cmd
  // updates back to us, and we update the text input field.
  hide: () => {
    enableCursor()
    showCursor()
    return { visible: false }
  },
  updateCommand: ({ cmd, kind, position, prompt }: CommandUpdate) => (s: S) => {
    hideCursor()
    disableCursor()

    return {
      kind,
      prompt,
      position,
      visible: true,
      options: cmd ? s.options : [],
      value: is.string(cmd) && s.value !== cmd ? cmd : s.value,
    }
  },

  selectWildmenu: (ix: number) => ({ ix }),
  updateWildmenu: (options: string[]) => ({
    options: [...new Set(options)],
  }),
}

type A = typeof actions

const view = ($: S) =>
  Plugin(
    $.visible,
    {
      position: 'relative',
    },
    [
      ,
      $.prompt &&
        h(
          'div',
          {
            style: {
              position: 'absolute',
              width: '100%',
              background: 'var(--background-50)',
              marginTop: '-40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
            },
          },
          [
            ,
            h(
              'div',
              {
                style: {
                  padding: '0 15px',
                  fontSize: '1.1rem',
                },
              },
              $.prompt
            ),
          ]
        ),

      Input({
        focus: true,
        value: $.value,
        desc: 'command line',
        position: $.position,
        icon: modeSwitch.get($.kind) || Icon.Command,
      }),

      h(
        'div',
        $.options.map((name, ix) =>
          h(
            RowNormal,
            {
              active: ix === $.ix,
            },
            [, h('div', name)]
          )
        )
      ),
    ]
  )

const ui = app<S, A>({ name: 'command-line', state, actions, view })

// TODO: use export cns. this component is a high priority so it should be loaded early
// because someone might open cmdline early
sub('wildmenu.show', (opts) => ui.updateWildmenu(opts))
sub('wildmenu.select', (ix) => ui.selectWildmenu(ix))
sub('wildmenu.hide', () => ui.updateWildmenu([]))

sub('cmd.hide', ui.hide)
sub('cmd.update', ui.updateCommand)
