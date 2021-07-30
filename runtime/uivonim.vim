" This file is sourced on startup in src/main/core/master-control.ts
function! UivonimState()
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
  let m.bufferType = getbufvar(currentBuffer, '&buftype')
  if exists('g:colors_name')
    let m.colorscheme = g:colors_name
  endif
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  let m.absoluteFilepath = expand('%:p')
  return m
endfunction

function! UivonimPosition()
  let m = {}
  let p = getcurpos()
  let m.line = p[1]-1
  let m.column = p[2]-1
  let m.editorTopLine = line('w0')
  let m.editorBottomLine = line('w$')
  return m
endfunction

function! UivonimGChange(...)
  call rpcnotify(0, 'uivonim-g', a:2, a:3)
endfunction

function! UivonimTermReader(...)
  if has_key(g:uvn_jobs_connected, a:1)
    call rpcnotify(0, 'uivonim', 'job-output', [a:1, a:2])
  endif
endfunction

function! UivonimTermExit(...)
  call remove(g:uvn_jobs_connected, a:1)
endfunction

function! Uivonim(...)
  call rpcnotify(0, 'uivonim', a:1, a:000[1:])
endfunction

function! UivonimCmdCompletions(...)
  return g:uvn_cmd_completions
endfunction

" TODO: figure out how to add multiple fn lambdas but dedup'd! (as a Set)
" index(g:vn_events[a:1], a:2) < 0 does not work
function! UivonimRegisterEvent(...)
  let g:uvn_events[a:1] = a:2
endfunction

function! UivonimCallEvent(event)
  if has_key(g:uvn_events, a:event)
    let Func = g:uvn_events[a:event]
    call Func()
  endif
endfunction

function! UivonimCallback(...)
  if has_key(g:uvn_callbacks, a:1)
    let Funky = g:uvn_callbacks[a:1]
    call Funky(a:2)
  endif
endfunction

function! UivonimRegisterMenuCallback(name, cb)
  let g:uvn_callbacks[a:name] = a:cb
endfunction

function! UivonimMenu(...)
  let g:uvn_callback_id += 1
  call UivonimRegisterMenuCallback(g:uvn_callback_id, a:3)
  call Uivonim('user-menu', g:uvn_callback_id, a:1, a:2)
endfunction

function! UivonimOverlayMenu(...)
  let g:uvn_callback_id += 1
  call UivonimRegisterMenuCallback(g:uvn_callback_id, a:3)
  call Uivonim('user-overlay-menu', g:uvn_callback_id, a:1, a:2)
endfunction

" TODO(smolck): Is this even necessary? What is/was the point of it?
let g:uivonim = 1
let g:uvn_cmd_completions = ''
let g:uvn_events = {}
let g:uvn_callbacks = {}
let g:uvn_callback_id = 0
let g:uvn_jobs_connected = {}
let g:uvn_completing = 0
let g:uvn_complete_pos = 1
let g:uvn_completions = []

" Highlights
hi! link uvnLink Special
hi! link uvnPreProc PreProc
hi! link uvnFunction Function
hi! link uvnBuiltin Constant
hi! link uvnKeyword Keyword
hi! link uvnCursor Cursor

" Create autocmds
aug UivonimAU
  au CursorMoved,CursorMovedI * call rpcnotify(0, 'uivonim-position', UivonimPosition())
  au BufAdd,BufEnter,BufDelete,BufUnload,BufWipeout,FileType,ColorScheme,DirChanged * call rpcnotify(0, 'uivonim-state', UivonimState())
  au BufAdd * call rpcnotify(0, 'uivonim-autocmd', 'BufAdd', expand('<abuf>'))
  au BufEnter * call rpcnotify(0, 'uivonim-autocmd', 'BufEnter', expand('<abuf>'), rpcnotify(0, 'uivonim', 'update-nameplates'))
  au BufDelete * call rpcnotify(0, 'uivonim-autocmd', 'BufDelete', expand('<abuf>'))
  au BufUnload * call rpcnotify(0, 'uivonim-autocmd', 'BufUnload', expand('<abuf>'))
  au BufWipeout * call rpcnotify(0, 'uivonim-autocmd', 'BufWipeout', expand('<abuf>'))
  au BufWritePre * call rpcnotify(0, 'uivonim-autocmd', 'BufWritePre', expand('<abuf>'))
  au BufWritePost * call rpcnotify(0, 'uivonim-autocmd', 'BufWritePost', expand('<abuf>'))
  au CursorMoved * call rpcnotify(0, 'uivonim-autocmd', 'CursorMoved')
  au CursorMovedI * call rpcnotify(0, 'uivonim-autocmd', 'CursorMovedI')
  au CompleteDone * call rpcnotify(0, 'uivonim-autocmd', 'CompleteDone', v:completed_item)
  au InsertEnter * call rpcnotify(0, 'uivonim-autocmd', 'InsertEnter')
  au InsertLeave * call rpcnotify(0, 'uivonim-autocmd', 'InsertLeave')
  au TextChanged * call rpcnotify(0, 'uivonim-autocmd', 'TextChanged', b:changedtick)
  au TextChangedI * call rpcnotify(0, 'uivonim-autocmd', 'TextChangedI', b:changedtick)
  au OptionSet * if (&ro != 1) | call rpcnotify(0, 'uivonim-autocmd', 'OptionSet', expand('<amatch>'), v:option_new, v:option_old) | endif
  au FileType * call rpcnotify(0, 'uivonim-autocmd', 'FileType', bufnr(expand('<afile>')), expand('<amatch>'))
  au WinEnter * call rpcnotify(0, 'uivonim-autocmd', 'WinEnter', win_getid())
aug END
