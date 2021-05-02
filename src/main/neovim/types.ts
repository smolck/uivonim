export type GenericCallback = (...args: any[]) => void
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

export enum HighlightGroupId {
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

export interface BufferChangeEvent {
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

export interface ProblemHighlight {
  group: Highlight
  id: HighlightGroupId
  line: number
  columnStart: number
  columnEnd: number
}

export interface Buffer {
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

export interface Window {
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

export interface Tabpage {
  id: number
  number: Promise<number>
  valid: Promise<boolean>
  window: Promise<Window>
  windows: Promise<Window[]>
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
}

const illegalArgument = (name?: string): Error => {
  if (name) {
    return new Error(`Illegal argument: ${name}`)
  } else {
    return new Error('Illegal argument')
  }
}

export class Position {
  static Min(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError()
    }
    let result = positions[0]
    for (let i = 1; i < positions.length; i++) {
      let p = positions[i]
      if (p.isBefore(result!)) {
        result = p
      }
    }
    return result
  }

  static Max(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError()
    }
    let result = positions[0]
    for (let i = 1; i < positions.length; i++) {
      let p = positions[i]
      if (p.isAfter(result!)) {
        result = p
      }
    }
    return result
  }

  static isPosition(other: any): other is Position {
    if (!other) {
      return false
    }
    if (other instanceof Position) {
      return true
    }
    let { line, character } = <Position>other
    if (typeof line === 'number' && typeof character === 'number') {
      return true
    }
    return false
  }

  private _line: number
  private _character: number

  get line(): number {
    return this._line
  }

  get character(): number {
    return this._character
  }

  constructor(line: number, character: number) {
    if (line < 0) {
      throw illegalArgument('line must be non-negative')
    }
    if (character < 0) {
      throw illegalArgument('character must be non-negative')
    }
    this._line = line
    this._character = character
  }

  isBefore(other: Position): boolean {
    if (this._line < other._line) {
      return true
    }
    if (other._line < this._line) {
      return false
    }
    return this._character < other._character
  }

  isBeforeOrEqual(other: Position): boolean {
    if (this._line < other._line) {
      return true
    }
    if (other._line < this._line) {
      return false
    }
    return this._character <= other._character
  }

  isAfter(other: Position): boolean {
    return !this.isBeforeOrEqual(other)
  }

  isAfterOrEqual(other: Position): boolean {
    return !this.isBefore(other)
  }

  isEqual(other: Position): boolean {
    return this._line === other._line && this._character === other._character
  }

  compareTo(other: Position): number {
    if (this._line < other._line) {
      return -1
    } else if (this._line > other.line) {
      return 1
    } else {
      // equal line
      if (this._character < other._character) {
        return -1
      } else if (this._character > other._character) {
        return 1
      } else {
        // equal line and character
        return 0
      }
    }
  }

  translate(change: { lineDelta?: number; characterDelta?: number }): Position
  translate(lineDelta?: number, characterDelta?: number): Position
  translate(
    lineDeltaOrChange:
      | number
      | undefined
      | { lineDelta?: number; characterDelta?: number },
    characterDelta: number = 0
  ): Position {
    if (lineDeltaOrChange === null || characterDelta === null) {
      throw illegalArgument()
    }

    let lineDelta: number
    if (typeof lineDeltaOrChange === 'undefined') {
      lineDelta = 0
    } else if (typeof lineDeltaOrChange === 'number') {
      lineDelta = lineDeltaOrChange
    } else {
      lineDelta =
        typeof lineDeltaOrChange.lineDelta === 'number'
          ? lineDeltaOrChange.lineDelta
          : 0
      characterDelta =
        typeof lineDeltaOrChange.characterDelta === 'number'
          ? lineDeltaOrChange.characterDelta
          : 0
    }

    if (lineDelta === 0 && characterDelta === 0) {
      return this
    }
    return new Position(this.line + lineDelta, this.character + characterDelta)
  }

  with(change: { line?: number; character?: number }): Position
  with(line?: number, character?: number): Position
  with(
    lineOrChange: number | undefined | { line?: number; character?: number },
    character: number = this.character
  ): Position {
    if (lineOrChange === null || character === null) {
      throw illegalArgument()
    }

    let line: number
    if (typeof lineOrChange === 'undefined') {
      line = this.line
    } else if (typeof lineOrChange === 'number') {
      line = lineOrChange
    } else {
      line =
        typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line
      character =
        typeof lineOrChange.character === 'number'
          ? lineOrChange.character
          : this.character
    }

    if (line === this.line && character === this.character) {
      return this
    }
    return new Position(line, character)
  }

  toJSON(): any {
    return { line: this.line, character: this.character }
  }
}

export class Range {
  static isRange(thing: any): thing is Range {
    if (thing instanceof Range) {
      return true
    }
    if (!thing) {
      return false
    }
    return (
      Position.isPosition((<Range>thing).start) &&
      Position.isPosition(<Range>thing.end)
    )
  }

  protected _start: Position
  protected _end: Position

  get start(): Position {
    return this._start
  }

  get end(): Position {
    return this._end
  }

  constructor(start: Position, end: Position)
  constructor(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  )
  constructor(
    startLineOrStart: number | Position,
    startColumnOrEnd: number | Position,
    endLine?: number,
    endColumn?: number
  ) {
    let start: Position | undefined
    let end: Position | undefined

    if (
      typeof startLineOrStart === 'number' &&
      typeof startColumnOrEnd === 'number' &&
      typeof endLine === 'number' &&
      typeof endColumn === 'number'
    ) {
      start = new Position(startLineOrStart, startColumnOrEnd)
      end = new Position(endLine, endColumn)
    } else if (
      startLineOrStart instanceof Position &&
      startColumnOrEnd instanceof Position
    ) {
      start = startLineOrStart
      end = startColumnOrEnd
    }

    if (!start || !end) {
      throw new Error('Invalid arguments')
    }

    if (start.isBefore(end)) {
      this._start = start
      this._end = end
    } else {
      this._start = end
      this._end = start
    }
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Range) {
      return (
        this.contains(positionOrRange._start) &&
        this.contains(positionOrRange._end)
      )
    } else if (positionOrRange instanceof Position) {
      if (positionOrRange.isBefore(this._start)) {
        return false
      }
      if (this._end.isBefore(positionOrRange)) {
        return false
      }
      return true
    }
    return false
  }

  isEqual(other: Range): boolean {
    return this._start.isEqual(other._start) && this._end.isEqual(other._end)
  }

  intersection(other: Range): Range | undefined {
    let start = Position.Max(other.start, this._start)
    let end = Position.Min(other.end, this._end)
    if (start.isAfter(end)) {
      // this happens when there is no overlap:
      // |-----|
      //          |----|
      return undefined
    }
    return new Range(start, end)
  }

  union(other: Range): Range {
    if (this.contains(other)) {
      return this
    } else if (other.contains(this)) {
      return other
    }
    let start = Position.Min(other.start, this._start)
    let end = Position.Max(other.end, this.end)
    return new Range(start, end)
  }

  get isEmpty(): boolean {
    return this._start.isEqual(this._end)
  }

  get isSingleLine(): boolean {
    return this._start.line === this._end.line
  }

  with(change: { start?: Position; end?: Position }): Range
  with(start?: Position, end?: Position): Range
  with(
    startOrChange: Position | undefined | { start?: Position; end?: Position },
    end: Position = this.end
  ): Range {
    if (startOrChange === null || end === null) {
      throw illegalArgument()
    }

    let start: Position
    if (!startOrChange) {
      start = this.start
    } else if (Position.isPosition(startOrChange)) {
      start = startOrChange
    } else {
      start = startOrChange.start || this.start
      end = startOrChange.end || this.end
    }

    if (start.isEqual(this._start) && end.isEqual(this.end)) {
      return this
    }
    return new Range(start, end)
  }

  toJSON(): any {
    return [this.start, this.end]
  }
}
