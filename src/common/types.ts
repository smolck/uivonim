export type GenericCallback = (...args: any[]) => void

export enum CommandType {
  Ex,
  Prompt,
  SearchForward,
  SearchBackward,
}

export interface CommandUpdate {
  cmd: string
  prompt?: string
  kind: CommandType
  position: number
}


interface PMenuItem {
  /** The text that will be inserted */
  word: string
  /** Single letter indicating the type of completion */
  kind: string
  /** Extra text for the popup menu, displayed after "word" or "abbr" */
  menu: string
  /** More information about the item, can be displayed in a preview window */
  info: string
}

export interface PopupMenu {
  row: number
  col: number
  grid: number
  index: number
  items: PMenuItem[]
}

export interface Mode {
  shape: CursorShape
  hlid?: number
  size?: number
}

export enum CursorShape {
  block = 0,
  line = 1,
  underline = 2,
}

export interface WinPosWinInfo {
  gridId: number,
  winId: number,
  row: number,
  col: number,
  width: number,
  height: number,
}

export interface WinFloatPosWinInfo {
  gridId: number,
  winId: number,
  anchor: string,
  anchorGrid: number,
  anchorRow: number,
  anchorCol: number,
}

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

export interface ExtContainer {
  extContainer: boolean
  kind: number
  data: any
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
