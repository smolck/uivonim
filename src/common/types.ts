export interface WindowMetadata {
  id: number
  dir: string
  name: string
  filetype: string
  active: boolean
  modified: boolean
  terminal: boolean
  termAttached: boolean
  termFormat: string
}

// TODO(smolck): This used to be generated from the nvim API, should it still be?
export interface ExtContainer {
  extContainer: boolean
  kind: number
  id: any
}

export enum MessageKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
  Progress = 'progress',
}

export interface Message {
  kind: MessageKind
  message: string
  stealsFocus?: boolean
  actions?: string[]
  progress?: number
  progressCancellable?: boolean
}

export interface MessageStatusUpdate {
  percentage?: number
  status?: string
}

export interface MessageReturn {
  internalId?: string
  setProgress: (update: MessageStatusUpdate) => void
  remove: () => void
  promise: Promise<string>
}

export enum InputType {
  Down = 'down',
  Up = 'up',
}

export interface BufferInfo {
  dir: string
  name: string
  base: string
  terminal: boolean
  modified: boolean
  duplicate: boolean
}

export enum BufferType {
  Normal = '',
  Help = 'help',
  NonFile = 'nofile',
  Quickfix = 'quickfix',
  Terminal = 'terminal',
  NonWritable = 'nowrite',
  OnlyWrittenWithAutocmd = 'acwrite',
}
