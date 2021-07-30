// TODO(smolck): Better module name?

import { Invokables, Events } from '../common/ipc'
import { invoke as tauriInvoke } from '@tauri-apps/api/tauri'
import { listen as tauriListen } from '@tauri-apps/api/event'
// import { listen, emit } from "@tauri-apps/api/event";

// @ts-ignore
export const invoke: {
  [Key in keyof typeof Invokables]: (args: any) => Promise<any>
} = 
  new Proxy(Invokables, {
  get: (invokables, key) => (args: any) => tauriInvoke(Reflect.get(invokables, key), args),
})

// @ts-ignore
export const listen: {
  [Key in keyof typeof Events]: (fn: (...args: any[]) => void) => void
} = 
  new Proxy(Events, {
  get: (events, key) => (fn: (...args: any[]) => void) => tauriListen(Reflect.get(events, key), fn),
})
