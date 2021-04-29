// import { input } from '../core/master-control'
import { VimMode } from '../neovim/types'
import { $ } from '../../common/utils'
import NvimState from '../neovim/state'
import { ipcMain } from 'electron'
import { Invokables } from '../../common/ipc'

export enum InputType {
  Down = 'down',
  Up = 'up',
}

type OnKeyFn = (inputKeys: string, inputType: InputType) => void

const modifiers = ['Alt', 'Shift', 'Meta', 'Control']

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
const joinModsWithDash = (mods: string[]) => mods.join('-')
const mapMods = $<string>(handleMods, joinModsWithDash)
const mapKey = $<string>(bypassEmptyMod, toVimKey)
const formatInput = $<string>(combineModsWithKey, wrapKey)

const isNotChar = (e: KeyboardEvent): boolean => {
  // Chars are handled by `oninput` handler so we don't handle those.
  if (
    e.key.length === 1 &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !e.shiftKey
  )
    return false
  // Also pass on modified keys (like alt-7, but not ctrl, which is used in mappings
  if ((e.shiftKey || e.metaKey || e.altKey) && !e.ctrlKey && e.key.length === 1)
    return false

  return true
}

export default class {
  private _isCapturing: boolean = false
  private _windowHasFocus = true
  private _lastEscapeTimestamp = 0
  private _shouldClearEscapeOnNextAppFocus = false
  private _keyListener: OnKeyFn = () => {}
  private _sendInputToVim = true
  private _globalShortcuts = new Map<string, () => void>()

  private _nvimStateRef: NvimState
  private _nvimInput: (keys: string) => void

  // TODO(smolck): For macOS. See explanation below.
  private _previousKeyWasDead = false
  private _keyIsDead = false
  private _onWinFocus: (fun: () => void) => void
  private _onWinBlur: (fun: () => void) => void

  constructor(nvimState: NvimState,
              nvimInput: (keys: string) => void,
              onWinFocus: (fun: () => void) => void,
              onWinBlur: (fun: () => void) => void) {
    this._nvimStateRef = nvimState
    this._nvimInput = nvimInput
    this._onWinBlur = onWinBlur
    this._onWinFocus = onWinFocus
  }

  // TODO(smolck): Better name?
  setup() {
    ipcMain.handle(Invokables.documentOnInput, (_evt, keyEvent: KeyboardEvent) => {
      if (process.platform === 'linux' || process.platform === 'win32') {
        this.keydownHandler(keyEvent)
      } else {
        // TODO(smolck): For macOS. See explanation below.
        if (!this._previousKeyWasDead && this._keyIsDead) {
          this._keyIsDead = false
          this._previousKeyWasDead = true
          return
        }

        this.keydownHandler(keyEvent)
      }
    })

    ipcMain.handle(Invokables.documentOnKeydown, (_evt, keyEvent: KeyboardEvent) => {
      if (process.platform === 'linux' || process.platform === 'win32') {
        if (isNotChar(keyEvent)) {
          this.keydownHandler(keyEvent)
        }
      } else {
        if (
          isNotChar(keyEvent) &&
          this.workaroundForDeadKeyBeingPressedTwiceInARowOnMacOS(keyEvent)
        ) {
          this.keydownHandler(keyEvent)
        }
      }
    })

    this._onWinFocus(() => {
      this._windowHasFocus = true
      if (this._shouldClearEscapeOnNextAppFocus) {
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
        this._nvimInput('<enter>')
        this._shouldClearEscapeOnNextAppFocus = false
      }
    })

    this._onWinBlur(() => {
      this._windowHasFocus = false

      const lastEscapeFromNow = Date.now() - this._lastEscapeTimestamp
      const isTerminalMode = this._nvimStateRef.state.mode === VimMode.Terminal
      const fixTermEscape = isTerminalMode && lastEscapeFromNow < 25
      if (fixTermEscape) this._shouldClearEscapeOnNextAppFocus = true
    })
  }

  // TODO(smolck): For some reason on MacOS when a dead key is pressed, even if it
  // isn't actually typed, it's received by the `oninput` handler, which causes an
  // issue where it's sent to Neovim when it shouldn't be. To fix that, we make
  // sure that a dead key is only ever sent to Neovim if it's typed twice in a row,
  // which is the way it should be.
  private workaroundForDeadKeyBeingPressedTwiceInARowOnMacOS(
    e: KeyboardEvent
  ): boolean {
    if (e.key === 'Dead' && !this._previousKeyWasDead) {
      this._keyIsDead = true
      this._previousKeyWasDead = false
      return false
    }
    if (this._previousKeyWasDead)
      (this._previousKeyWasDead = false), (this._keyIsDead = e.key === 'Dead')

    return true
  }

  focus() {
    this._isCapturing = true
  }

  blur() {
    this._isCapturing = false
  }

  stealInput(onKeyFn: OnKeyFn) {
    this._sendInputToVim = false
    this._keyListener = onKeyFn
    return () => (this._sendInputToVim = true)
  }

  registerOneTimeUseShortcuts(shortcuts: string[], cb: (shortcut: string) => void) {
    const done = (shortcut: string) => {
      shortcuts.forEach((s) => this._globalShortcuts.delete(s))
      cb(shortcut)
    }
    shortcuts.forEach((s) => this._globalShortcuts.set(s, () => done(s)))
  }

  private sendToVim(inputKeys: string) {
    if (this._globalShortcuts.has(inputKeys)) return this._globalShortcuts.get(inputKeys)!()

    // TODO: this might need more attention. i think s-space can be a valid
    // vim keybind. s-space was causing issues in terminal mode, sending weird
    // term esc char.
    if (inputKeys === '<S-Space>') return this._nvimInput('<space>')
    if (inputKeys.length > 1 && !inputKeys.startsWith('<')) {
      return inputKeys.split('').forEach((k: string) => this._nvimInput(k))
    }

    // a fix for terminal. only happens on cmd-tab. see below for more info
    if (inputKeys.toLowerCase() === '<esc>') this._lastEscapeTimestamp = Date.now()
    this._nvimInput(inputKeys)
  }

  private async sendKeys(e: KeyboardEvent, inputType: InputType) {
    const key = bypassEmptyMod(e.key)
    if (!key) {
      // @ts-ignore
      const inputKey = e.data
      if (!inputKey) return

      if (this._sendInputToVim) return this.sendToVim(inputKey)
      this._keyListener(inputKey, inputType)

      return
    }

    const inputKeys = formatInput(mapMods(e), mapKey(e.key))

    if (this._sendInputToVim) return this.sendToVim(inputKeys)
    this._keyListener(inputKeys, inputType)
  }

  private keydownHandler(e: KeyboardEvent) {
    if (!this._windowHasFocus || !this._isCapturing) return

    this.sendKeys(e, InputType.Down)
  }
}
