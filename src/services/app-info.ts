import api from '../core/instance-api'
import { remote } from 'electron'

api.onAction('version', () =>
  api.nvim.cmd(`echo 'Uivonim v${remote.app.getVersion()}'`)
)

api.onAction('devtools', () => remote.getCurrentWebContents().toggleDevTools())

// TODO: DEPRECATED REMOVE
api.onAction('remap-modifier', () => {
  api.nvim.cmd(
    `echo '"remap-modifier" is deprecated. please use "g:veonim_remap_modifiers"'`
  )
})

// TODO: DEPRECATED REMOVE
api.onAction('key-transform', () => {
  api.nvim.cmd(
    `echo '"key-transform" is deprecated. please use "g:veonim_key_transforms"'`
  )
})
