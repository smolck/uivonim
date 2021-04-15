import { pascalCase, onProp } from '../support/utils'
import { VimMode } from '../neovim/types'
import { Range } from '../neovim/types'

type DefineFunction = {
  [index: string]: (fnBody: TemplateStringsArray, ...vars: any[]) => void
}

export const normalizeVimMode = (mode: string): VimMode => {
  if (mode === 't') return VimMode.Terminal
  if (mode === 'n' || mode === 'normal') return VimMode.Normal
  if (mode === 'i' || mode === 'insert') return VimMode.Insert
  if (mode === 'V' || mode === 'visual') return VimMode.Visual
  if (mode === 'R' || mode === 'replace') return VimMode.Replace
  if (mode === 'no' || mode === 'operator') return VimMode.Operator
  if (mode === 'c' || mode === 'cmdline_normal') return VimMode.CommandNormal
  if (mode === 'cmdline_insert') return VimMode.CommandInsert
  if (mode === 'cmdline_replace') return VimMode.CommandReplace
  // there are quite a few more modes available. see `mode_info_set`
  else return VimMode.SomeModeThatIProbablyDontCareAbout
}

export const FunctionGroup = () => {
  const fns: string[] = []

  const defineFunc: DefineFunction = onProp(
    (name: PropertyKey) => (strParts: TemplateStringsArray, ...vars: any[]) => {
      const expr = strParts
        .map((m, ix) => [m, vars[ix]].join(''))
        .join('')
        .split('\n')
        .filter((m) => m)
        .map((m) => m.trim())
        .join('\\n')
        .replace(/"/g, '\\"')

      fns.push(
        `exe ":fun! ${pascalCase(
          name as string
        )}(...) range\\n${expr}\\nendfun"`
      )
    }
  )

  return {
    defineFunc,
    getFunctionsAsString: () => fns.join(' | '),
  }
}

export const CmdGroup = (strParts: TemplateStringsArray, ...vars: any[]) =>
  strParts
    .map((m, ix) => [m, vars[ix]].join(''))
    .join('')
    .split('\n')
    .filter((m) => m)
    .map((m) => m.trim())
    .map((m) => m.replace(/\|/g, '\\|'))
    .join(' | ')
    .replace(/"/g, '\\"')

export const positionWithinRange = (
  line: number,
  column: number,
  { start, end }: Range
): boolean => {
  const startInRange =
    line >= start.line && (line !== start.line || column >= start.character)

  const endInRange =
    line <= end.line && (line !== end.line || column <= end.character)

  return startInRange && endInRange
}
