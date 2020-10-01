set background=dark

hi clear
if exists("syntax_on")
  syntax reset
endif

let g:colors_name="veonim"

hi! Normal                   guifg=#dcd2c9  guibg=#29272d  gui=NONE
hi! NormalInverted           guifg=#29272d  guibg=NONE     gui=NONE
hi! TabLineSel               guifg=#333942  guibg=#b4a2c1  gui=NONE
hi! Selection                guifg=#47414e  guibg=#eeeeee  gui=reverse
hi! StatusLine               guifg=NONE     guibg=#4e415a  gui=NONE
hi! StatusLineNC             guifg=#333942  guibg=#4e415a  gui=NONE
hi! MatchParen               guifg=#ece4fa  guibg=#673759  gui=NONE
hi! PmenuSbar                guifg=NONE     guibg=NONE     gui=NONE
hi! String                   guifg=#da8a69  guibg=NONE     gui=NONE
hi! PreProc                  guifg=#da6868  guibg=NONE     gui=NONE
hi! Comment                  guifg=#5e5965  guibg=NONE     gui=NONE
hi! Function                 guifg=#93859f  guibg=NONE     gui=NONE
hi! SpecialKey               guifg=#d8d456  guibg=NONE     gui=NONE
hi! CursorLine               guifg=NONE     guibg=#2f343c  gui=NONE
hi! CursorColumn             guifg=NONE     guibg=#333942  gui=NONE
hi! LineNr                   guifg=#5c6573  guibg=NONE     gui=NONE
hi! Underlined               guifg=#9966B8  guibg=NONE     gui=NONE
hi! SpecialComment           guifg=#5c6573  guibg=NONE     gui=reverse
hi! Todo                     guifg=#d89353  guibg=NONE     gui=reverse
hi! Search                   guifg=#7e6d88  guibg=NONE     gui=reverse
hi! Error                    guifg=#CC4339  guibg=NONE     gui=reverse
hi! DiffAdd                  guifg=#e4edfa  guibg=NONE     gui=reverse
hi! DiffChange               guifg=#9966B8  guibg=NONE     gui=reverse
hi! SpellBad                 guifg=#CC4339  guibg=NONE     gui=undercurl
hi! SpellLocal               guifg=#9966B8  guibg=NONE     gui=undercurl
hi! SpellCap                 guifg=#D8FD60  guibg=NONE     gui=undercurl
hi! HardContrast             guifg=#ff007c  guibg=#010101  gui=NONE

hi! CursorNormal guibg=#f3a082
hi! CursorInsert guibg=#f3a082
hi! CursorVisual guibg=#6d33ff

hi! link EndOfBuffer         NormalInverted
hi! link Visual              Selection
hi! link WildMenu            Selection
hi! link ModeMsg             Selection
hi! link PmenuThumb          PmenuSbar
hi! link CursorLineNr        StatusLine             
hi! link StatusLineNC        SpecialComment
hi! link Pmenu               StatusLineNC
hi! link TabLine             LineNr
hi! link TabLineFill         LineNr
hi! link Folded              LineNr
hi! link ErrorMsg            Error
hi! link DiffDelete          Error
hi! link ColorColumn         CursorLine
hi! link SignColumn          String
hi! link MoreMsg             String
hi! link Directory           String
hi! link markdownLinkText    String
hi! link WarningMsg          String
hi! link Operator            Function
hi! link Special             Function
hi! link Identifier          Function
hi! link Statement           Function
hi! link Type                Function
hi! link Constant            Function
hi! link htmlEndTag          Function
hi! link Title               PreProc
hi! link FoldColumn          PreProc
hi! link Number              PreProc
hi! link Boolean             PreProc
hi! link StorageClass        Normal
hi! link DiffText            DiffAdd
hi! link Question            SpecialKey
hi! link markdownUrl         Underlined
hi! link SpellRare           SpellLocal
hi! link NonText             Comment
hi! link VertSplit           Comment
hi! link VimCommentTitle     SpecialComment

if has('nvim')
  let g:terminal_color_0 = '#3B4252'
  let g:terminal_color_1 = '#BF616A'
  let g:terminal_color_2 = '#A3BE8C'
  let g:terminal_color_3 = '#EBCB8B'
  let g:terminal_color_4 = '#81A1C1'
  let g:terminal_color_5 = '#B48EAD'
  let g:terminal_color_6 = '#88C0D0'
  let g:terminal_color_7 = '#E5E9F0'
  let g:terminal_color_8 = '#4C566A'
  let g:terminal_color_9 = '#BF616A'
  let g:terminal_color_10 = '#A3BE8C'
  let g:terminal_color_11 = '#EBCB8B'
  let g:terminal_color_12 = '#81A1C1'
  let g:terminal_color_13 = '#B48EAD'
  let g:terminal_color_14 = '#8FBCBB'
  let g:terminal_color_15 = '#ECEFF4'
endif
