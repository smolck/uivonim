import { prefixWith, onFnCall, pascalCase } from '../support/utils'
import MsgpackStreamDecoder from '../messaging/msgpack-decoder'
import MsgpackStreamEncoder from '../messaging/msgpack-encoder'
import { Api, Prefixes } from '../neovim/protocol'
import { on } from '../messaging/worker-client'
import SetupRPC from '../messaging/rpc'
import { spawn } from 'child_process'
import { resolve } from 'path'
const marked = require('marked')

interface ColorData {
  color: string
  text: string
}

const prefix = { core: prefixWith(Prefixes.Core) }
const vimOptions = {
  rgb: true,
  ext_popupmenu: false,
  ext_tabline: false,
  ext_wildmenu: false,
  ext_cmdline: false,
}

const asVimFunc = (name: string, fn: string) => {
  const expr = fn
    .split('\n')
    .filter((m) => m)
    .join('\\n')
    .replace(/"/g, '\\"')

  return `exe ":fun! ${pascalCase(name)}(...) range\n${expr}\nendfun"`
}

const runtimeDir = resolve(__dirname, '..', 'runtime')
const encoder = new MsgpackStreamEncoder()
const decoder = new MsgpackStreamDecoder()

const proc = spawn('nvim', [
  '--cmd',
  `let &runtimepath .= ',${runtimeDir}' | let g:veonim = 1 | let g:vn_loaded = 0 | let g:vn_ask_cd = 0`,
  '--cmd',
  `colorscheme veonim`,
  '--cmd',
  `exe ":fun! Veonim(...)\\n endfun"`,
  '--cmd',
  `exe ":fun! VK(...)\\n endfun"`,
  '--cmd',
  `com! -nargs=+ -range Veonim 1`,
  '--cmd',
  'com! -nargs=* Plug 1',
  '--embed',
])

proc.on('error', (e: any) => console.error('vim colorizer err', e))
proc.stdout!.on('error', (e: any) =>
  console.error('vim colorizer stdout err', e + '')
)
proc.stdin!.on('error', (e: any) =>
  console.error('vim colorizer stdin err', e + '')
)
proc.stderr!.on('data', (e: any) =>
  console.error('vim colorizer stderr', e + '')
)
proc.on('exit', () => console.error('vim colorizer exit'))

encoder.pipe(proc.stdin!)
proc.stdout!.pipe(decoder)

const { notify, request, onData } = SetupRPC((m) => encoder.write(m))
decoder.on('data', ([type, ...d]: [number, any]) => onData(type, d))

const req: Api = onFnCall((name: string, args: any[] = []) =>
  request(prefix.core(name), args)
)
const api: Api = onFnCall((name: string, args: any[]) =>
  notify(prefix.core(name), args)
)

api.uiAttach(100, 10, vimOptions)

api.command(
  asVimFunc(
    'VeonimColorize',
    `
  execute 'set filetype=' . a:1
  let lineColors = []
  let lines = getline(1, '$')
  let lineCount = len(lines)
  let lineIx = 0
  while lineIx < lineCount
    let line = lines[lineIx]
    let colors = []
    let chars = split(line, '\\\\zs')
    let strLen = len(chars)
    let col = 1
    while col <= strLen
      let clr = synIDattr(synIDtrans(synID(lineIx + 1, col, 1)), 'fg#')
      call add(colors, [col, clr])
      let col += 1
    endwhile
    call add(lineColors, colors)
    let lineIx += 1
  endwhile
  return lineColors
`
  )
)

const insertIntoBuffer = (lines: string[]) => {
  api.command(`bd!`)
  api.callFunction('append', [0, lines])
}

type Color = [number, string]
const getTextColors = (filetype = ''): Promise<Color[][]> =>
  req.callFunction('VeonimColorize', [filetype])

type ColorRange = [number, number, string]
const colorsAsRanges = (colors: Color[][]): ColorRange[][] =>
  colors.map((line) =>
    line.reduce((grp, [col, color]) => {
      if (col === 1) return grp.push([0, col, color]), grp

      const prev = grp[grp.length - 1]
      if (prev[2] === color) prev[1] = col
      else grp.push([col - 1, col, color])

      return grp
    }, [] as ColorRange[])
  )

const colorData = (lines: string[], ranges: ColorRange[][]): ColorData[][] =>
  ranges.map((line, ix) =>
    line.map(([s, e, color]) => ({
      color,
      text: lines[ix].slice(s, e),
    }))
  )

// TODO: probably need some mechanism to queue requests and do them serially.
// don't want to override vim buffer while another req is processing
const colorizeText = async (
  text: string,
  filetype = ''
): Promise<ColorData[][]> => {
  const lines = text.split('\n')
  insertIntoBuffer(lines)

  const colors = (await getTextColors(filetype)) || []
  return colorData(lines, colorsAsRanges(colors))
}

const colorizeTextPerChar = async (
  lines: string[],
  filetype = ''
): Promise<ColorData[][]> => {
  insertIntoBuffer(lines)
  const coloredLines = (await getTextColors(filetype)) || []
  return coloredLines.map((line, lineIx) =>
    line.map(([charIx, color]) => ({
      color,
      text: lines[lineIx].slice(charIx - 1, charIx),
    }))
  )
}

const colorizeAsHTML = async (
  inputText: string,
  filetype = ''
): Promise<string> => {
  const colorLines = await colorizeText(inputText, filetype)
  return colorLines
    .filter((m) => m)
    .map((line) =>
      line
        .map(({ color, text }) => {
          const style = color ? ` style="color: ${color}"` : ''
          return `<span${style}>${text}</span>`
        })
        .join('')
    )
    .join('')
}

const wrongDocumentation = (markdown: string): Promise<string> =>
  new Promise((done) =>
    marked(
      markdown,
      {
        highlight: (text: string, language: string, done: any) => {
          colorizeAsHTML(text, language).then((res) => done(null, res))
        },
      },
      (_: any, result: string) => done(result)
    )
  )

on.setColorScheme((scheme: string) => api.command(`colorscheme ${scheme}`))
on.colorize((text: string, filetype: string) => colorizeText(text, filetype))
on.colorizePerChar((lines: string[], filetype: string) =>
  colorizeTextPerChar(lines, filetype)
)
on.colorizeMarkdownToHTML((markdown: string) => wrongDocumentation(markdown))
