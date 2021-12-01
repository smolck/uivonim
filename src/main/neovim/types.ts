export type VimOption = { [index: string]: Promise<any> }
export type Keymap = Map<string, KeymapObject>

interface KeymapObject {
  mode: VimMode
  lhs: string
  rhs: string
  sid: number
  buffer: number
  expr: boolean
  silent: boolean
  nowait: boolean
  noremap: boolean
}

export enum VimMode {
  Normal = 'n',
  Insert = 'i',
  Visual = 'v',
  Replace = 'r',
  Operator = 'o',
  Terminal = 't',
  CommandNormal = 'cn',
  CommandInsert = 'ci',
  CommandReplace = 'cr',
  SomeModeThatIProbablyDontCareAbout = 'whatever',
}

export enum BufferOption {
  FileFormat = 'fileformat',
  Modifiable = 'modifiable',
  Listed = 'buflisted',
  Modified = 'modified',
  Filetype = 'filetype',
  Hidden = 'bufhidden',
  Type = 'buftype',
}

export enum BufferHide {
  Hide = 'hide',
  Unload = 'unload',
  Delete = 'delete',
  Wipe = 'wipe',
}

export enum Highlight {
  Underline = 'VeonimUnderline',
  Undercurl = 'VeonimUndercurl',
  DocumentHighlight = 'DocumentHighlight',
}

enum HighlightGroupId {
  // as per nvim api for buf_(add|clear)highlight sourceId of 0
  // is a special number used to generate a highlight id from
  // neovim. we want to use our own, so we will skip 0
  Diagnostics = 2,
  DocumentHighlight = 3,
}

export interface HyperspaceCoordinates {
  line: number
  column?: number
  path?: string
}

interface BufferChangeEvent {
  /** buffer filetype at the time of the change event */
  filetype: string
  /** value of |b:changedtick| for the buffer. If you send an API
  command back to nvim you can check the value of |b:changedtick| as part of
  your request to ensure that no other changes have been made. */
  changedTick: number
  /** integer line number of the first line that was replaced.
  Zero-indexed: if line 1 was replaced then {firstline} will be 0, not 1.
  {firstline} is always less than or equal to the number of lines that were in
  the buffer before the lines were replaced. */
  firstLine: number
  /** integer line number of the first line that was not replaced
  (i.e. the range {firstline}, {lastline} is end-exclusive).  Zero-indexed: if
  line numbers 2 to 5 were replaced, this will be 5 instead of 6. lastLine is
  always be less than or equal to the number of lines that were in the buffer
  before the lines were replaced. {lastline} will be -1 if the event is part of
  the initial update after attaching. */
  lastLine: number
  /** list of strings containing the contents of the new buffer
  lines. Newline characters are omitted; empty lines are sent as empty strings. */
  lineData: string[]
  /** {more} boolean, true for a "multipart" change notification: the current
  change was chunked into multiple |nvim_buf_lines_event| notifications (e.g.
  because it was too big). */
  more: boolean
}

export interface BufferEvent {
  bufOpen: Buffer
  bufLoad: Buffer
  bufChange: Buffer
  bufChangeInsert: Buffer
  bufWrite: Buffer
  bufWritePre: Buffer
  bufClose: Buffer
  cursorMove: void
  cursorMoveInsert: void
  completion: string
  insertLeave: void
  insertEnter: void
  winEnter: number
  filetype: string
}

export interface Color {
  background: number
  foreground: number
}

interface ProblemHighlight {
  group: Highlight
  id: HighlightGroupId
  line: number
  columnStart: number
  columnEnd: number
}

interface Buffer {
  id: number
  number: Promise<number>
  valid: Promise<boolean>
  name: Promise<string>
  length: Promise<number>
  changedtick: Promise<number>
  getOffset(line: number): Promise<number>
  isLoaded(): Promise<boolean>
  isTerminal(): Promise<boolean>
  attach(
    options: { sendInitialBuffer: boolean },
    onEventFn: (event: BufferChangeEvent) => void
  ): void
  detach(): void
  onDetach(onDetachFn: () => void): void
  onChangedTick(onChangedTickFn: (changedTick: number) => void): void
  getAllLines(): Promise<string[]>
  getLines(start: number, end: number): Promise<string[]>
  getLine(start: number): Promise<string>
  setLines(start: number, end: number, replacement: string[]): void
  append(start: number, lines: string | string[]): void
  delete(start: number): void
  replace(start: number, line: string): void
  getKeymap(mode: string): Promise<any>
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
  getOption(name: string): Promise<any>
  setOption(name: string, value: any): void
  setName(name: string): void
  getMark(name: string): Promise<number[]>
  addHighlight(
    sourceId: number,
    highlightGroup: string,
    line: number,
    columnStart: number,
    columnEnd: number
  ): Promise<number>
  clearHighlight(sourceId: number, lineStart: number, lineEnd: number): void
  clearAllHighlights(): void
  highlightProblems(problems: ProblemHighlight[]): Promise<any[]>
  addVirtualText(line: number, text: string): void
}

interface Window {
  id: number
  number: Promise<number>
  valid: Promise<boolean>
  tab: Promise<Tabpage>
  buffer: Promise<Buffer>
  cursor: Promise<number[]>
  position: Promise<number[]>
  height: Promise<number>
  width: Promise<number>
  setCursor(row: number, col: number): void
  setHeight(height: number): void
  setWidth(width: number): void
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
  getOption(name: string): Promise<any>
  setOption(name: string, value: any): void
}

interface Tabpage {
  id: number
  number: Promise<number>
  valid: Promise<boolean>
  window: Promise<Window>
  windows: Promise<Window[]>
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
}
