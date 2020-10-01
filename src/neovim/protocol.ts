// AUTO-GENERATED! This file automagically generated with gen-api.js
// Sun, 02 Sep 2018 18:00:34 GMT
// Neovim version: 0.3.1

export interface ExtContainer {
  extContainer: boolean
  kind: number
  id: any
}

export interface Events {
  resize(width: number, height: number): void
  clear(): void
  eol_clear(): void
  cursor_goto(row: number, col: number): void
  mode_info_set(enabled: boolean, cursor_styles: any[]): void
  update_menu(): void
  busy_start(): void
  busy_stop(): void
  mouse_on(): void
  mouse_off(): void
  mode_change(mode: string, mode_idx: number): void
  bell(): void
  visual_bell(): void
  flush(): void
  update_fg(fg: number): void
  update_bg(bg: number): void
  update_sp(sp: number): void
  default_colors_set(
    rgb_fg: number,
    rgb_bg: number,
    rgb_sp: number,
    cterm_fg: number,
    cterm_bg: number
  ): void
  suspend(): void
  set_title(title: string): void
  set_icon(icon: string): void
  option_set(name: string, value: any): void
  update_fg(fg: number): void
  update_bg(bg: number): void
  update_sp(sp: number): void
  resize(width: number, height: number): void
  clear(): void
  eol_clear(): void
  cursor_goto(row: number, col: number): void
  highlight_set(attrs: object): void
  put(str: string): void
  set_scroll_region(top: number, bot: number, left: number, right: number): void
  scroll(count: number): void
  default_colors_set(
    rgb_fg: number,
    rgb_bg: number,
    rgb_sp: number,
    cterm_fg: number,
    cterm_bg: number
  ): void
  hl_attr_define(id: number, attrs: object, info: any[]): void
  grid_resize(grid: number, width: number, height: number): void
  grid_clear(grid: number): void
  grid_cursor_goto(grid: number, row: number, col: number): void
  grid_line(grid: number, row: number, startcol: number, data: any[]): void
  grid_scroll(
    grid: number,
    top: number,
    bot: number,
    left: number,
    right: number,
    rows: number,
    cols: number
  ): void
  grid_destroy(grid: number): void
  win_position(
    win: number,
    grid: number,
    startrow: number,
    startcol: number,
    width: number,
    height: number
  ): void
  popupmenu_show(items: any[], selected: number, row: number, col: number): void
  popupmenu_hide(): void
  popupmenu_select(selected: number): void
  tabline_update(current: ExtContainer, tabs: any[]): void
  cmdline_show(
    content: any[],
    pos: number,
    firstc: string,
    prompt: string,
    indent: number,
    level: number
  ): void
  cmdline_pos(pos: number, level: number): void
  cmdline_special_char(c: string, shift: boolean, level: number): void
  cmdline_hide(level: number): void
  cmdline_block_show(lines: any[]): void
  cmdline_block_append(lines: any[]): void
  cmdline_block_hide(): void
  wildmenu_show(items: any[]): void
  wildmenu_select(selected: number): void
  wildmenu_hide(): void
  msg_start_kind(kind: string): void
  msg_chunk(data: string, hl_id: number): void
  msg_end(): void
  msg_showcmd(content: any[]): void
}

export interface Api {
  uiAttach(width: number, height: number, options: object): void
  uiDetach(): void
  uiTryResize(width: number, height: number): void
  uiSetOption(name: string, value: any): void
  uiTryResizeGrid(grid: number, width: number, height: number): void
  command(command: string): void
  getHlByName(name: string, rgb: boolean): Promise<object>
  getHlById(hl_id: number, rgb: boolean): Promise<object>
  feedkeys(keys: string, mode: string, escape_csi: boolean): void
  input(keys: string): Promise<number>
  replaceTermcodes(
    str: string,
    from_part: boolean,
    do_lt: boolean,
    special: boolean
  ): Promise<string>
  commandOutput(command: string): Promise<string>
  eval(expr: string): Promise<any>
  executeLua(code: string, args: any[]): Promise<any>
  callFunction(fn: string, args: any[]): Promise<any>
  callDictFunction(dict: any, fn: string, args: any[]): Promise<any>
  strwidth(text: string): Promise<number>
  listRuntimePaths(): Promise<string[]>
  setCurrentDir(dir: string): void
  getCurrentLine(): Promise<string>
  setCurrentLine(line: string): void
  delCurrentLine(): void
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
  getVvar(name: string): Promise<any>
  getOption(name: string): Promise<any>
  setOption(name: string, value: any): void
  outWrite(str: string): void
  errWrite(str: string): void
  errWriteln(str: string): void
  listBufs(): Promise<ExtContainer[]>
  getCurrentBuf(): Promise<ExtContainer>
  setCurrentBuf(buffer: Buffer): void
  listWins(): Promise<ExtContainer[]>
  getCurrentWin(): Promise<ExtContainer>
  setCurrentWin(window: Window): void
  listTabpages(): Promise<ExtContainer[]>
  getCurrentTabpage(): Promise<ExtContainer>
  setCurrentTabpage(tabpage: Tabpage): void
  subscribe(event: string): void
  unsubscribe(event: string): void
  getColorByName(name: string): Promise<number>
  getColorMap(): Promise<object>
  getMode(): Promise<object>
  getKeymap(mode: string): Promise<object[]>
  getCommands(opts: object): Promise<object>
  getApiInfo(): Promise<any[]>
  setClientInfo(
    name: string,
    version: object,
    type: string,
    methods: object,
    attributes: object
  ): void
  getChanInfo(chan: number): Promise<object>
  listChans(): Promise<any[]>
  callAtomic(calls: any[]): Promise<any[]>
  parseExpression(
    expr: string,
    flags: string,
    highlight: boolean
  ): Promise<object>
  listUis(): Promise<any[]>
  getProcChildren(pid: number): Promise<any[]>
  getProc(pid: number): Promise<any>
  buffer: Buffer
  window: Window
  tabpage: Tabpage
}

export interface Buffer {
  getOffset(buffer: Buffer, index: number): Promise<number>
  isLoaded(buffer: Buffer): Promise<boolean>
  lineCount(buffer: Buffer): Promise<number>
  attach(buffer: Buffer, send_buffer: boolean, opts: object): Promise<boolean>
  detach(buffer: Buffer): Promise<boolean>
  getLines(
    buffer: Buffer,
    start: number,
    end: number,
    strict_indexing: boolean
  ): Promise<string[]>
  setLines(
    buffer: Buffer,
    start: number,
    end: number,
    strict_indexing: boolean,
    replacement: string[]
  ): void
  getVar(buffer: Buffer, name: string): Promise<any>
  getChangedtick(buffer: Buffer): Promise<number>
  getKeymap(buffer: Buffer, mode: string): Promise<object[]>
  getCommands(buffer: Buffer, opts: object): Promise<object>
  setVar(buffer: Buffer, name: string, value: any): void
  delVar(buffer: Buffer, name: string): void
  getOption(buffer: Buffer, name: string): Promise<any>
  setOption(buffer: Buffer, name: string, value: any): void
  getNumber(buffer: Buffer): Promise<number>
  getName(buffer: Buffer): Promise<string>
  setName(buffer: Buffer, name: string): void
  isValid(buffer: Buffer): Promise<boolean>
  getMark(buffer: Buffer, name: string): Promise<number[]>
  addHighlight(
    buffer: Buffer,
    src_id: number,
    hl_group: string,
    line: number,
    col_start: number,
    col_end: number
  ): Promise<number>
  clearHighlight(
    buffer: Buffer,
    src_id: number,
    line_start: number,
    line_end: number
  ): void
  setVirtualText(
    buffer: Buffer,
    src_id: number,
    line: number,
    chunks: any[]
  ): Promise<number>
}

export interface Window {
  getBuf(window: Window): Promise<ExtContainer>
  getCursor(window: Window): Promise<number[]>
  setCursor(window: Window, pos: number[]): void
  getHeight(window: Window): Promise<number>
  setHeight(window: Window, height: number): void
  getWidth(window: Window): Promise<number>
  setWidth(window: Window, width: number): void
  getVar(window: Window, name: string): Promise<any>
  setVar(window: Window, name: string, value: any): void
  delVar(window: Window, name: string): void
  getOption(window: Window, name: string): Promise<any>
  setOption(window: Window, name: string, value: any): void
  getPosition(window: Window): Promise<number[]>
  getTabpage(window: Window): Promise<ExtContainer>
  getNumber(window: Window): Promise<number>
  isValid(window: Window): Promise<boolean>
}

export interface Tabpage {
  listWins(tabpage: Tabpage): Promise<ExtContainer[]>
  getVar(tabpage: Tabpage, name: string): Promise<any>
  setVar(tabpage: Tabpage, name: string, value: any): void
  delVar(tabpage: Tabpage, name: string): void
  getWin(tabpage: Tabpage): Promise<ExtContainer>
  getNumber(tabpage: Tabpage): Promise<number>
  isValid(tabpage: Tabpage): Promise<boolean>
}

export const Prefixes = {
  Core: 'nvim_',
  Buffer: 'nvim_buf_',
  Window: 'nvim_win_',
  Tabpage: 'nvim_tabpage_',
}

export enum ExtType {
  Buffer,
  Window,
  Tabpage,
}
