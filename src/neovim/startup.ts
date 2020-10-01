import { CmdGroup, FunctionGroup } from '../support/neovim-utils'
import { configPath } from '../support/utils'
import { resolve, join } from 'path'

const runtimeDir = resolve(__dirname, '..', 'runtime')
const startup = FunctionGroup()

export const startupFuncs = () => startup.getFunctionsAsString()

export const startupCmds = CmdGroup`
  let $PATH .= ':${runtimeDir}/${process.platform}'
  let &runtimepath .= ',${runtimeDir}'
  let g:uivonim = 1
  let g:uvn_cmd_completions = ''
  let g:uvn_events = {}
  let g:uvn_callbacks = {}
  let g:uvn_callback_id = 0
  let g:uvn_jobs_connected = {}
  let g:uvn_completing = 0
  let g:uvn_complete_pos = 1
  let g:uvn_completions = []
  call UivonimRegisterAutocmds()
`

// TODO: should we rename some of these "internal" functions so they
// don't obviously show up in the command completions when looking
// for 'Uivonim' function name. something sort of prefix "_$VN_RegAutocmds"
//
// or maybe we move all these functions to a separate .vim script file?
// i wonder which functions are required for init.vim

const stateEvents = [
  'BufAdd',
  'BufEnter',
  'BufDelete',
  'BufUnload',
  'BufWipeout',
  'FileType',
  'ColorScheme',
  'DirChanged',
]

const autocmds = {
  BufAdd: `expand('<abuf>')`,
  BufEnter: `expand('<abuf>')`,
  BufDelete: `expand('<abuf>')`,
  BufUnload: `expand('<abuf>')`,
  BufWipeout: `expand('<abuf>')`,
  BufWritePre: `expand('<abuf>')`,
  BufWritePost: `expand('<abuf>')`,
  CursorMoved: null,
  CursorMovedI: null,
  CompleteDone: `v:completed_item`,
  InsertEnter: null,
  InsertLeave: null,
  TextChanged: `b:changedtick`,
  TextChangedI: `b:changedtick`,
  OptionSet: `expand('<amatch>'), v:option_new, v:option_old`,
  FileType: `bufnr(expand('<afile>')), expand('<amatch>')`,
  WinEnter: `win_getid()`,
}

export type Autocmd = typeof autocmds
export type Autocmds = keyof Autocmd

const autocmdsText = Object.entries(autocmds)
  .map(([cmd, arg]) => {
    const argtext = arg ? `, ${arg}` : ''

    // TODO(smolck): Is this accurate? And is it a (good) fix?
    // Avoid calling rpcnotify if buffer is readonly to prevent errors.
    if (cmd === 'OptionSet') {
      return `au UivonimAU ${cmd} * if (&ro != 1) | call rpcnotify(0, 'uivonim-autocmd', '${cmd}'${argtext}) | endif`
    }

    return `au UivonimAU ${cmd} * call rpcnotify(0, 'uivonim-autocmd', '${cmd}'${argtext})`
  })
  .join('\n')

// autocmds in a separate function because chaining autocmds with "|" is bad
// it makes the next autocmd a continuation of the previous
startup.defineFunc.UivonimRegisterAutocmds`
  aug UivonimAU | au! | aug END
  au UivonimAU CursorMoved,CursorMovedI * call rpcnotify(0, 'uivonim-position', UivonimPosition())
  au UivonimAU ${stateEvents.join(
    ','
  )} * call rpcnotify(0, 'uivonim-state', UivonimState())
  ${autocmdsText}
`

startup.defineFunc.UivonimState`
  let m = {}
  let currentBuffer = bufname('%')
  let p = getcurpos()
  let m.line = p[1]-1
  let m.column = p[2]-1
  let m.revision = b:changedtick
  let m.filetype = getbufvar(currentBuffer, '&filetype')
  let m.cwd = getcwd()
  let m.dir = expand('%:p:h')
  let m.file = expand('%f')
  let m.colorscheme = g:colors_name
  let m.bufferType = getbufvar(currentBuffer, '&buftype')
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  let m.absoluteFilepath = expand('%:p')
  return m
`

startup.defineFunc.UivonimPosition`
  let m = {}
  let p = getcurpos()
  let m.line = p[1]-1
  let m.column = p[2]-1
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  return m
`

startup.defineFunc.UivonimGChange`
  call rpcnotify(0, 'uivonim-g', a:2, a:3)
`

startup.defineFunc.UivonimTermReader`
  if has_key(g:uvn_jobs_connected, a:1)
    call rpcnotify(0, 'uivonim', 'job-output', [a:1, a:2])
  endif
`

startup.defineFunc.UivonimTermExit`
  call remove(g:uvn_jobs_connected, a:1)
`

startup.defineFunc.Uivonim`
  call rpcnotify(0, 'uivonim', a:1, a:000[1:])
`

startup.defineFunc.UivonimCmdCompletions`
  return g:uvn_cmd_completions
`

// TODO: figure out how to add multiple fn lambdas but dedup'd! (as a Set)
// index(g:vn_events[a:1], a:2) < 0 does not work
startup.defineFunc.UivonimRegisterEvent`
  let g:uvn_events[a:1] = a:2
`

startup.defineFunc.UivonimCallEvent`
  if has_key(g:uvn_events, a:1)
    let Func = g:uvn_events[a:1]
    call Func()
  endif
`

startup.defineFunc.UivonimCallback`
  if has_key(g:uvn_callbacks, a:1)
    let Funky = g:uvn_callbacks[a:1]
    call Funky(a:2)
  endif
`

startup.defineFunc.UivonimRegisterMenuCallback`
  let g:uvn_callbacks[a:1] = a:2
`

startup.defineFunc.UivonimMenu`
  let g:uvn_callback_id += 1
  call UivonimRegisterMenuCallback(g:uvn_callback_id, a:3)
  call Uivonim('user-menu', g:uvn_callback_id, a:1, a:2)
`

startup.defineFunc.UivonimOverlayMenu`
  let g:uvn_callback_id += 1
  call UivonimRegisterMenuCallback(g:uvn_callback_id, a:3)
  call Uivonim('user-overlay-menu', g:uvn_callback_id, a:1, a:2)
`
