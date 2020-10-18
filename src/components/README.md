Implementations of the different UI elements used by Uivonim

- top-level contains elements used by Uivomim itself
- `nvim` contains elements replacing neovim builtin UI (command line, pum, search, statusline, messages)
- `extensions` contains optional elements that can be called via `:Uivonim xxx` or bound to Lua (in particular, LSP hover, signature help, references, symbols)
- `extensions/legacy` contains elements from veonim that are no longer exposed
- `extensions/future` contains elements from veonim that are planned to be exposed in the future (requiring further work)
- `memes` contains Nyancat
