import api from '../core/instance-api'
import { remote } from 'electron'

api.onAction('version', () =>
  api.nvim.cmd(`echo 'Uivonim v${remote.app.getVersion()}'`)
)

api.onAction('devtools', () => remote.getCurrentWebContents().toggleDevTools())
