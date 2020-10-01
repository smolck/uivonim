## notes
- rust ext errors on vscode LanguageClient
- why did we create our own LangaugeClient?
- can we just use the real thing?
- rust ext: how to get access to actual language server to hookup to rpc?

## in progress

- mru buffer navigation

- more vscode api

- INVENTORY
  - also add window commands. especially ones that i can't remember (swap, maximize/zoom, etc.)
  - display action keybinds in fuzzy menu
  - fuzzy menu has descriptions as well
  - fuzzy menu also display icons?
  - color code layers? colors then also appear in fuzzy menu?
  - make sure layers and actions always show up in the same oreder. visual memory is important
  - show layer keybind in breadcrumbs. Home layer will be <space> by default (show the <space>)
  - show <ctrl-o> to jump back to previous layer
  - layer extra documentation at the bottom of activated/current layer
  - determine if user keybound <space> to anything in their init.vim
    - if <space> already bound, then don't bind inventory-layers (display a first message ONCE on first veonim load?) or show red error message in Welcome screen along with instructions on how to setup binding in init.vim
    - else <space> not bound
      - if inventory already bound to another key, skip
      - else bind inventory to <space>
  - show cancel/ESC key
  - other invalid keys pressed, what do? nothing? show error? escape menu?


## backlog - stuff that i really want

- image overlay (press key to open image url under cursor in a floating image overlay)
    an alternative to inline images

- improve symbols view
  - show parent symbols if duplicate (or maybe always)
    - i noticed the veonim/ext-typescript-javascript langserv has some of this parent symbol info
  - show file locations if duplicate
  - show file locations for workspace symbols

- shutdown + cleanup langservs on project switch/close

- VIRTUAL LISTS PLEASE
  - how to specify dynamic size of list (to fit in the current window?)
  - just make it a slice of the total list
  - can we make a scrollbar to know the ability to scroll

- create overlay menu window with key shortcuts so users can create spacemacs-like
menus. e.g. (floating windows maybe?)
  - either 1-key menu, or n-key menu
    - 1-key menu: chose an option, activate it, and close menu
    - n-key menu: can press multiple times to activate a function. esc closes menu. useful for things like resizing windows
  - example menu:
    ```
    [ a: buffer search    b: grep search    c: viewport-search ]
    [ d: file search                                           ]
    ```
  - or a vertical menu for marks and their file locations
    ```
    a - support.ts
    s - utils.ts
    d - main.ts
    ```
  - allow option to provide callback so can be customized from vimscript
  - this could probably be done with vimscript + floating windows neovim feature
    - what benefits can a GUI approach offer?

- welcome screen

- session management
  - on veonim exit auto `:mksession` to custom dir/file
  - on veonim restore, provide links to restore sessions on welcome page
  - how to restore sessions on extra vim instances? show welcome screen on them too? a lite welcome screen?

- redo/restyle notifications
  - move to bottom right corenr
  - improve styling
  - perhaps merge with :Veonim messages and add some way of focusing
  - provide j/k for selecting messages
  - provide keybinds c-s-y/n for "yes"/"no" option buttons in PROMPTS

- improve startup performance
  - welcome screen static html render. should load up asap
  - start first veonim instance in main renderer. can connect later via named pipes
    - perf difference between stdio/stdout and named pipes?
    - what about all the other vim instances? created and managed in main renderer? or in browser?

- better UI for installing extensions + plugins (progress bars, details, icons, colors, etc.)

- UI for showing installed + activated extensions


## backlog - stuff that i want but is low priority

- grep menu, show total files / results counts statistics at bottom

- completion menu use seti icons for filetype items (.js file gets the JS icon, etc.)

- key-transforms
  - timeouts (if i press cmd in fuzzy file picker, but change my mind)
  - support transforms per nvim mode

- tweak the colors.important to bee lesss saturated. can we derive from colorscheme?

- grep: i don't like the large/small icon unaligned padding/margins in query/filter inputs

- terminal change title to current running process

- NEW HARDER FASTER STRONGER ICON

- change default BROWSER WINDOW background/statusline colors to match brunswick default bg

- upgrade ripgrep

- canvas: clip rect mask on wide chars (unicode) to cell boundries
  - or maybe track which chars are too wide and clear/redraw nearby cells (hard)
  - might fix rendering artifacts
  - might not do this if we get a webgl renderer going

- 'deactivated/unfocused' cursor style
  - i.e. when jumping between Problems or references, instead of (right now) only showing cursorline, also show the actual cursor block but perhaps faded out, in such a way to indicate that there is no focus in the vim window...?
  - or like Terminal.app (prob other terms too) show a outline around the block cursor
    - only works for block cursor. we need to support everything

- macros UI
  - edit already recorded macros in a floating window
  - i want the ability to be able to record multiple macros and name them. i want some sort of visual
  - selector gui so i can retrieve and rerun macros without having to remember what macro register i saved, and what the usage for a particular macro is supposed to be. this can work similar to the marks popup idea below
  - macro recorder real-time history with edit window easily accessible after recording finished to edit
  - when starting a macro a small floating window shows up. the window updates in realtime
      to reveal the characters typed. when editing finished, a key shortcut will change focus
      to the floating window to be able to edit the macro.
  - where record keys from? veonim key events? what if neovim remaps?
  - say i record a macro (using the fancy visual record UI). once i'm done i can name the macro a descriptive name.
  - then i can hit a keybind (Q maybe?) and it shows an overlay with all the recorded macros, and the trigger keys of the register the macro is recorded in. pressing the next key will run the macro in that register.
  - aka Qr --> @r and Qe --> @e

- auto add to quick fix list (to allow :cdo commands):
  - references
  - problems
  - grep

- improved perf of completions overlay menu
  - its "fast enough" to not feel laggy
  - at one point in time i thought it would be neat to try to do the completions menu with a canvas renderer
  - canvas makes it tricky to do html rendering of markdown documentation (maybe a hybrid)

- color picker support editing hsla and rgba values

- improve find references
  - problem: once i start find-references and i close the overlay ui, i have no way to jump to the next reference in the list (without starting 'find-references' again from one of the symbols). this happens in the workflow of jumping through references and editing text which may remove the symbol (which could be used as an anchor to call 'find-references' again) from the current location/viewport

  - maybe we can make some sort of status that indicates the current symbol that has been loaded into a symbols jump list. then we can create next/prev keybinds that will jump to next prev symbol. this can replace `;n` to jump to next symbol of current word. perhaps we can even combine document/highlights

  - thus we might have the following commands:
  - find all references overlay (ui + filtering)
    - also highlights all referenced symbols?
  - find all references (silent, load into memory)
    - also highlights all references
    - shows status somewhere of the current symbol loaded in jump list memory
  - goto next/prev reference
    - jumps to next/prev reference if jump list memory loaded
    - if jump list memory is empty, gets current word symbol references/highlight/load jumplist/etc
  - clear active reference
    - clears highlights + jump list memory + status

- use LSP completionItem.detail somehow? perhaps instead of no docs?

## backlog - blocked on some other feature

- [requires: *ext-window*] better window management
  - divination jump labels for jumping to other windows (requires ext-windows)
  - visual labels+mode for resizing current window (display hjkl and have an input that when pressing key does the resize operation. maybe like in chrome devtools, using modifiers speeds up the resize increment amount?)
  - visual way to move a window around. display hjkl + input mode. pressing movement command moves window in the direction specified
  - better way to zoom a window, and visually identify that it has been zooooomed
  - swap contents (and size?) of current window with another window (maybe this might be better  alternative than move window (move window could be tricky with complex split trees))
    - like jump labels for moving to window (show window border around current active window)
    - press label and the contents of current and targeted window are swapped around. perhaps resized accordingly?
  - create UI overlay guides and keybinds for creating window splits
    - activate the UI thingy
    - it shows a semi-transparent overlay where the new window will be created
    - each overlay has a keybinding
    - pressing the keybinding creates the window split at the desired location

- [requires: *ext-window*] image preview buffers

- [requires: *ext-window*] add user-guide built-in to veonim. create display window for it (with keybindings)
  - requires markdown preview or we generate md -> html on build process

- [requires: *ext-window*] show vim config template next to init.vim when editing. for ease of copypasta

- [requires: *extended marks*] interactive LSP rename (like in XCODE)
  - starting a rename operation would realtime change all the other symbols in the current viewport
  - perhaps highlight symbols being renamed in the viewport in some unique way (with a border? underline?)
  - remove the current glitchy restore UX. once we hit ESC to commit the change, no more changes or visible redraws should happen in the viewport
  - we can call symbol highlights to get positions of symbols to be renamed
  - we could do a "dummy rename" operation to determine if this symbol can be renamed or not (display in UI)
  - did a quick POC that we can change the buffer WHILE in insert mode with `setLines` and no glitches. performance seems adequate. only missing piece now is extended marks.

- [requires: *floating windows*] terminal scratch buffers/editors
  - use floating window for terminal scratch buffer. say i want to type a super fancy and long git commit msg, open scratch buffer, do the edits and whatnot, then "save" buffer to terminal prompt (this is like c-x, c-e, but it is sized only to fit the content of the prompt)
  - can also be used for $VISUAL and $EDITOR. make a floating window like 80% of the parent window. this could be a command like `vvim` that can be set and used for git merge messages and such.
  - replace `C-X, C-E` with a small neovim buffer overlay
    - one line+auto resizing to num of written lines


## backlog - desired but not sure how to do it

- autocomplete - do not hardcode 'tab' + 's-tab' keys. user config
  - at the same time, i don't want so much setup in init.vim...
  - would be nice if veonim worked "out of the box"
  - maybe could check if tab/s-tab is already bound before binding
  - and completefunc?
  - don't override if it exists
  - allow opt-in autocomplete trigger. autocmds? -> enable/disable?
  - the problem is that we currently do not render external popupmenu via GUI so if someone does not use completefun=VeonimComplete, they will get ugly

- user configurable statusline
  - design goal is that all config is done via nvim apis
  - problem is that we would like to allow users to fully customize HTML/JS/CSS
  - how do that with only nvim apis
  - i don't want to create/manage a veonim-only extension API unless this project gets popular and people reallllllllllly want it - or no way to do it with nvim/vscode apis


## cool ideas but undecided if they add value

- snippets
  - nvim extended marks feature could help here
  - what if we integrate with vscode api + snippets. how does that work?

- empty state icon for empty lists [results] - buffer search, etc.

- fancy git-branch switcher

- gen-api.js get :h doc info for nvim and put into jsdoc annotations to get signature-hints?

- bundle vim-polygot with veonim
  - i'm afraid this would conflict with users vim configs
  - updating hard
  - how to support if also defined as a plugin in init.vim
  - perhaps this can be as a fallback if there is no syntax highlighting installed at all (somehow)

- [requires: *ext-window*] constrain relevant overlay menus to a particular window (current window)
  - i.e. show symbol/file menu on top of the current buffer window, instead of the center of the program, since selecting a symbol or file will make changes in the current window, not globally
  - some menus will remain global because they have no relationship to the current window (user menus, project switcher, etc.)
  - what if the overlay menu does not fit in the window...?

- create a visual configurator for key remapings + key event viewer. it's hard to figure out otherwise

- symbol hierarchical viewer
  - how does atom do it?
  - how does vscode do it?
  - i think they proposed an extension to LSP for this
  - new alternate TS langserv seems to have parent symbol info...

- text annotations (like git blame stuff, etc.)
  - https://github.com/neovim/neovim/pull/8180

- visual UI for edit and jump lists
  - http://vim.wikia.com/wiki/Jumping_to_previously_visited_locations

- visual UI for extensions
  - veonim knows what extensions are loaded, but there is no way to get to that information as a user. this is not a critical piece of functionality - it's a nice to have.
  - categorize by lang serv/debug adapter
  - show the parent extension name that is defined in init.vim
  - config path folder location
  - activationEvents for a particular extension (so as a user i can understand that css-lang-server only activates when i have css files open)
  - show 'active' status
  - for language servers it would be good to know what language features are supported. an user can then understand why certain features work or not

## crazy experimental ideas

- investigate if we can get a nvim event indicating mode change (this is kind of an annoying pain right now to determine current nvim mode)

- i wonder how much overhead the vim-startup stuff adds to the render loop. i.e. is neovim's pipeline affected by all our autocmds and other garbage we have setup? would have to benchmark an empty nvim vs veonim scripts. now that we have the ability to have neovim api multithreaded, can we somehow keep the main stdout connection clean of events?

- interactive `:norm` or `:g//norm` (:inccommand but for normal commands)
  - make a selection (like inside an object) then run a series of normal commands on that selection. interactive because actions happen on all applicable lines. same idea as multiple cursor, but without the suck. macros can do this, but are clunky, non-interactive, and error prone. personally i feel macros are more useful for a large amount of complex changes. regex is slow and it sucks
  - show cursors at matching lines
  - use extended marks to propagate changes?
  - kinda like multiple cursors, but not really

- show marks visually in editor?
  - if the current viewport has any marks, render them over the text.
  - i'm not sure how useful this will be, as i've used marks-in-sign column plugin before and i was not impressed. usually most marks are outside of the current viewport. would need a better way to visually indicate those

- visual test results
  - at least somehow to show total number of fail/pass, last run, and jumplist for error files. would be nice to have desc and errors as well. maybe json output? maybe a common format( tap? is it machine readable, containsa ll info? )

- multi-monitor support?
  - with shada and edge detection (when c-w l on right most window, go to next monitor)
  - problem is how do we share veonim state between windows.
  - REAL PROBLEM is how to share low-latency functions between windows (render/input/etc)
  - well we can connect via TCP right... i wonder if we can uiAttach from extra clients
  - the problem would be how to maintain state between different processes. things like custom input modes...

- self updating app

- helm-swoop
  - https://github.com/ShingoFukuyama/helm-swoop
  - i like the idea of putting all search results in a separate buffer, and then performing actions on just the search lines.
    - i like that i can see all search results by themselves
    - like that i can perform INTERACTIVE visually actions on the search results
  - would be cool to have it be fuzzy search (like buffer search) or not
  - with vim can take search results to location/quickfix list and use :cdo - not interactive or visual
  - could use macros somehow...
  - with neovim can use :inccommand and regex or :norm. - can't see all search results by themselves - difficult to revise search selection - not fuzzy. NOT FUZZY

## code refactor

- move neovim api typings to @veonim/neovim repo?

- separate out internal object data from langserv params data?
  - right now in adapter we send both vim state object and params in the same parameter, same object. i think it might be cleaner to send them separately, so that we do not send internal data to the lang serv. this may have a neglible benefit on network (de)serializing (and xmit time?)
  - i almost feel that there is not much of a good reason to pass in the entire neovim state to every single langserv request ever. why can't adapter simply access the neovim state and pick out the nvim state fields it needs to know?

- simliar to the key timeouts, maybe we can make key triggers after a certain amount of key-down holding. e.g. press/release m immediatly and it takes you to a mark.  press and hold m and a mark menu shows up
