import { normalizeVimMode } from '../support/neovim-utils'
import { input } from '../core/master-control'
import { VimMode } from '../neovim/types'
import { $, is } from '../support/utils'
import api from '../core/instance-api'
import { remote } from 'electron'
import { Script } from 'vm'

export enum InputType {
  Down = 'down',
  Up = 'up',
}

interface RemapModifer {
  from: string
  to: string
}

interface KeyShape extends KeyboardEvent {
  mode?: VimMode
}

interface KeyTransform {
  mode: string
  event: 'hold' | 'up' | 'down'
  match: KeyboardEvent
  transform: string
}

type OnKeyFn = (inputKeys: string, inputType: InputType) => void

const modifiers = ['Alt', 'Shift', 'Meta', 'Control']
const remaps = new Map<string, string>()
let isCapturing = true
let holding = ''
let xformed = false
let lastDown = ''
let windowHasFocus = true
let lastEscapeTimestamp = 0
let shouldClearEscapeOnNextAppFocus = false
let keyListener: OnKeyFn = () => {}
let sendInputToVim = true

const isStandardAscii = (key: string) =>
  key.charCodeAt(0) > 32 && key.charCodeAt(0) < 127
const handleMods = ({
  ctrlKey,
  shiftKey,
  metaKey,
  altKey,
  key,
}: KeyboardEvent) => {
  const mods: string[] = []
  const onlyShift = shiftKey && !ctrlKey && !metaKey && !altKey
  const notCmdOrCtrl = !metaKey && !ctrlKey
  const macOSUnicode =
    (process.platform === 'darwin' && altKey && notCmdOrCtrl) ||
    (altKey && shiftKey && notCmdOrCtrl)

  if (onlyShift && isStandardAscii(key) && key.length === 1) return mods
  if (macOSUnicode) return mods
  if (ctrlKey) mods.push('C')
  if (shiftKey) mods.push('S')
  if (metaKey) mods.push('D')
  if (altKey) mods.push('A')
  return mods
}

const toVimKey = (key: string): string => {
  if (key === 'Backspace') return 'BS'
  if (key === '<') return 'LT'
  if (key === 'Escape') return 'Esc'
  if (key === 'Delete') return 'Del'
  if (key === ' ') return 'Space'
  if (key === 'ArrowUp') return 'Up'
  if (key === 'ArrowDown') return 'Down'
  if (key === 'ArrowLeft') return 'Left'
  if (key === 'ArrowRight') return 'Right'
  else return key
}

const isUpper = (char: string) => char.toLowerCase() !== char
const bypassEmptyMod = (key: string) => (modifiers.includes(key) ? '' : key)
const wrapKey = (key: string): string =>
  key.length > 1 && isUpper(key[0]) ? `<${key}>` : key
const combineModsWithKey = (mods: string, key: string) =>
  mods.length ? `${mods}-${key}` : key
const userModRemaps = (mods: string[]) => mods.map((m) => remaps.get(m) || m)
const joinModsWithDash = (mods: string[]) => mods.join('-')
const mapMods = $<string>(handleMods, userModRemaps, joinModsWithDash)
const mapKey = $<string>(bypassEmptyMod, toVimKey)
const formatInput = $<string>(combineModsWithKey, wrapKey)
const shortcuts = new Map<string, Function>()
const globalShortcuts = new Map<string, () => void>()

const resetInputState = () => {
  xformed = false
  lastDown = ''
  holding = ''
}

export const focus = () => {
  isCapturing = true
  resetInputState()
}

export const blur = () => {
  isCapturing = false
  resetInputState()
}

export const setupRemapModifiers = (mappings: RemapModifer[]) => {
  if (!mappings) return
  remaps.clear()
  mappings.forEach((mapping) => remapModifier(mapping.from, mapping.to))
}

const vimscriptObjectToECMA = (obj: any) =>
  Object.entries(obj).reduce((res, [key, val]) => {
    if (val === 'true') Reflect.set(res, key, true)
    else if (val === 'false') Reflect.set(res, key, false)
    else Reflect.set(res, key, val)
    return res
  }, {})

const setupTransforms = (transforms: KeyTransform[]) => {
  if (!transforms) return
  xfrmHold.clear()
  xfrmDown.clear()
  xfrmUp.clear()

  transforms.forEach(({ event, mode, match, transform }) => {
    const nvimMode = normalizeVimMode(mode)
    const fn = Reflect.get(addTransform, event)
    if (!fn) return console.error('can not add key-transform for event:', event)

    const transformFn = new Script(transform).runInThisContext()
    const matchObj =
      nvimMode !== VimMode.SomeModeThatIProbablyDontCareAbout
        ? Object.assign(vimscriptObjectToECMA(match), { mode: nvimMode })
        : vimscriptObjectToECMA(match)

    if (is.function(fn) && is.function(transformFn)) fn(matchObj, transformFn)
  })
}

const remapModifier = (from: string, to: string) => remaps.set(from, to)

type Transformer = (input: KeyboardEvent) => KeyboardEvent
export const xfrmHold = new Map<string, Transformer>()
export const xfrmDown = new Map<string, Transformer>()
export const xfrmUp = new Map<string, Transformer>()

const keToStr = (e: KeyShape) =>
  [
    e.key,
    (<any>e.ctrlKey) | 0,
    (<any>e.metaKey) | 0,
    (<any>e.altKey) | 0,
    (<any>e.shiftKey) | 0,
  ].join('')

const defkey = {
  ...new KeyboardEvent('keydown'),
  key: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
}

const addTransform = {
  hold: (e: any, fn: Transformer) =>
    xfrmHold.set(keToStr({ ...defkey, ...e }), (e) => ({ ...e, ...fn(e) })),

  down: (e: any, fn: Transformer) =>
    xfrmDown.set(keToStr({ ...defkey, ...e }), (e) => ({ ...e, ...fn(e) })),

  up: (e: any, fn: Transformer) => {
    const before = keToStr({ ...defkey, ...e })
    const now = keToStr({ ...defkey, key: e.key })
    xfrmUp.set(before + now, (e) => ({ ...e, ...fn(e) }))
  },
}

export const stealInput = (onKeyFn: OnKeyFn) => {
  sendInputToVim = false
  keyListener = onKeyFn
  return () => (sendInputToVim = true)
}

const sendToVim = (inputKeys: string) => {
  // TODO: for now shortcuts only work in dev mode
  if (process.env.VEONIM_DEV) {
    if (shortcuts.has(`${api.nvim.state.mode}:${inputKeys}`)) {
      return shortcuts.get(`${api.nvim.state.mode}:${inputKeys}`)!()
    }
  }

  if (globalShortcuts.has(inputKeys)) return globalShortcuts.get(inputKeys)!()

  // TODO: this might need more attention. i think s-space can be a valid
  // vim keybind. s-space was causing issues in terminal mode, sending weird
  // term esc char.
  if (inputKeys === '<S-Space>') return input('<space>')
  if (inputKeys.length > 1 && !inputKeys.startsWith('<')) {
    return inputKeys.split('').forEach((k: string) => input(k))
  }

  // a fix for terminal. only happens on cmd-tab. see below for more info
  if (inputKeys.toLowerCase() === '<esc>') lastEscapeTimestamp = Date.now()
  input(inputKeys)
}

export const registerShortcut = (keys: string, mode: VimMode, cb: Function) => {
  shortcuts.set(`${mode}:<${keys}>`, cb)
}

export const registerOneTimeUseShortcuts = (
  shortcuts: string[],
  cb: (shortcut: string) => void
) => {
  const done = (shortcut: string) => {
    shortcuts.forEach((s) => globalShortcuts.delete(s))
    cb(shortcut)
  }
  shortcuts.forEach((s) => globalShortcuts.set(s, () => done(s)))
}

const sendKeys = async (e: KeyboardEvent, inputType: InputType) => {
  const key = bypassEmptyMod(e.key)
  if (!key) return
  const inputKeys = formatInput(mapMods(e), mapKey(e.key))

  if (sendInputToVim) return sendToVim(inputKeys)
  keyListener(inputKeys, inputType)
}

window.addEventListener('keydown', (e) => {
  if (!windowHasFocus || !isCapturing) return

  const es = keToStr(e)
  lastDown = es

  if (xfrmDown.has(es)) {
    const remapped = xfrmDown.get(holding)!(e)
    sendKeys(remapped, InputType.Down)
    return
  }

  if (xfrmHold.has(es)) {
    holding = es
    return
  }

  if (xfrmHold.has(holding)) {
    const remapped = xfrmHold.get(holding)!(e)
    sendKeys(remapped, InputType.Down)
    xformed = true
    return
  }

  sendKeys(e, InputType.Down)
})

window.addEventListener('keyup', (e) => {
  if (!windowHasFocus || !isCapturing) return

  // one of the observed ways in which we can have a 'keyup' event without a
  // 'keydown' event is when the window receives focus while a key is already
  // pressed. this will happen with key combos like cmd+tab or alt+tab to
  // switch applications in mac/windows. there is probably no good reason to
  // send the keyup event key to neovim. in fact, this causes issues if we have
  // a xform mapping of cmd -> escape, as it sends an 'esc' key to neovim
  // terminal, thus swallowing the first key after app focus
  if (!lastDown) return
  const es = keToStr(e)

  const prevKeyAndThisOne = lastDown + es
  if (xfrmUp.has(prevKeyAndThisOne))
    return sendKeys(xfrmUp.get(prevKeyAndThisOne)!(e), InputType.Up)

  if (holding === es) {
    if (!xformed) sendKeys(e, InputType.Up)
    xformed = false
    holding = ''
  }
})

remote.getCurrentWindow().on('focus', () => {
  windowHasFocus = true
  resetInputState()
  if (shouldClearEscapeOnNextAppFocus) {
    // so if i remap 'cmd' down+up -> 'esc' and then hit cmd+tab to switch apps
    // while in a terminal buffer, the application captures the 'cmd' (xform to
    // 'esc') but not the 'tab' key. because of the xform to 'esc' this sends
    // an escape sequence to the terminal. once the app gains focus again, the
    // first char in the terminal buffer will be "swallowed". very annoying if
    // copypasta commands, the first char gets lost and have to re-pasta

    // i couldn't figure out an elegant solution to this (tried native
    // keylistening but too much effort/unreliable), and decided to check if an
    // 'esc' key was sent immediately before the app lost focus && we were in
    // terminal insert mode. when the app gains focus again, we can "clear" the
    // previous erranous 'escape' key sent to the terminal. this might only
    // happen on macos + my custom config of remapping cmd -> cmd/esc
    input('<enter>')
    shouldClearEscapeOnNextAppFocus = false
  }
})

remote.getCurrentWindow().on('blur', async () => {
  windowHasFocus = false
  resetInputState()

  const lastEscapeFromNow = Date.now() - lastEscapeTimestamp
  const isTerminalMode = api.nvim.state.mode === VimMode.Terminal
  const fixTermEscape = isTerminalMode && lastEscapeFromNow < 25
  if (fixTermEscape) shouldClearEscapeOnNextAppFocus = true
})

api.onConfig.inputRemapModifiersDidChange(setupRemapModifiers)
api.onConfig.inputKeyTransformsDidChange(setupTransforms)
