import { VimMode, BufferType } from '../neovim/types'
import { EventEmitter } from 'events'

const state = {
  mode: VimMode.Normal,
  bufferType: BufferType.Normal,
  file: '',
  filetype: '',
  dir: '',
  cwd: '',
  colorscheme: '',
  revision: -1,
  line: 0,
  column: 0,
  editorTopLine: 0,
  editorBottomLine: 0,
  absoluteFilepath: '',
}

export type NeovimState = typeof state
type StateKeys = keyof NeovimState
type WatchState = {
  [Key in StateKeys]: (
    fn: (value: NeovimState[Key], previousValue: NeovimState[Key]) => void
  ) => void
}

type OnStateValue1 = {
  [Key in StateKeys]: (value: NeovimState[Key], fn: () => void) => void
}
type OnStateValue2 = {
  [Key in StateKeys]: (
    value: NeovimState[Key],
    previousValue: NeovimState[Key],
    fn: () => void
  ) => void
}
type OnStateValue = OnStateValue1 & OnStateValue2

type UntilStateValue1 = {
  [Key in StateKeys]: {
    is: (value: NeovimState[Key]) => Promise<NeovimState[Key]>
  }
}

type UntilStateValue2 = {
  [Key in StateKeys]: {
    is: (
      value: NeovimState[Key],
      previousValue: NeovimState[Key]
    ) => Promise<NeovimState[Key]>
  }
}

type UntilStateValue = UntilStateValue1 & UntilStateValue2

export default class {
  private watchers: EventEmitter
  private stateChangeFns: Set<Function>

  watchState: WatchState
  onStateValue: OnStateValue
  untilStateValue: UntilStateValue
  state: NeovimState

  // TODO(smolck): State name isn't used so why keep it?
  constructor(_stateName: string) {
    this.watchers = new EventEmitter()
    this.stateChangeFns = new Set<Function>()
    this.watchState = new Proxy(Object.create(null), {
      get: (_, key: string) => (fn: (value: any, previousValue: any) => void) =>
        this.watchers.on(key, fn),
    })
    this.onStateValue = new Proxy(Object.create(null), {
      get: (_, key: string) => (matchValue: any, ...args: any[]) => {
        const matchPreviousValue = args.find((a) => typeof a === 'string')
        const fn = args.find((a) => typeof a === 'function')

        this.watchers.on(key, (value, previousValue) => {
          const same = value === matchValue
          const prevSame =
            typeof matchPreviousValue == null
              ? true
              : previousValue === matchPreviousValue
          if (same && prevSame) fn()
        })
      },
    })

    this.untilStateValue = new Proxy(
      Object.create(null), {
          get: (_, key: string) => ({
            is: (matchValue: any, matchPreviousValue?: any) =>
              new Promise((done) => {
                const callback = (value: any, previousValue: any) => {
                  const same = value === matchValue
                  const prevSame =
                    matchPreviousValue == null
                      ? true
                      : previousValue === matchPreviousValue

                  if (same && prevSame) {
                    done(value)
                    this.watchers.removeListener(key, callback)
                  }
                }

                this.watchers.on(key, callback)
              }),
          }),
        }
    )

    this.state = new Proxy(state, {
      get: (_, key: StateKeys) => Reflect.get(state, key),
      set: (_, key: string, val: any) => {
        const currentVal = Reflect.get(state, key)
        if (currentVal === val) return true

        const nextState = { ...state, [key]: val }

        Reflect.set(state, key, val)
        this.notifyStateChange(nextState, key, val, currentVal)

        return true
      },
    })
  }

  onStateChange(fn: (nextState: NeovimState, key: string, value: any, previousValue: any) => void) {
    this.stateChangeFns.add(fn)
  }

  notifyStateChange(
    nextState: NeovimState,
    key: string,
    value: any,
    previousValue: any
  ) {
    this.watchers.emit(key, value, previousValue)
    this.stateChangeFns.forEach((fn) => fn(nextState, key, value, previousValue))
  }
}
