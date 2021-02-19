// AUTO-GENERATED! This file automagically generated with gen-api.js
// Fri, 29 Jan 2021 03:33:45 GMT
// Neovim version: 0.5.0

export interface ExtContainer {
  extContainer: boolean
  kind: number
  id: any
}

export interface Events {
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
  suspend(): void
  set_title(title: string): void
  set_icon(icon: string): void
  screenshot(path: string): void
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
  hl_attr_define(
    id: number,
    rgb_attrs: object,
    cterm_attrs: object,
    info: any[]
  ): void
  hl_group_set(name: string, id: number): void
  grid_resize(grid: number, width: number, height: number): void
  grid_clear(grid: number): void
  grid_cursor_goto(grid: number, row: number, col: number): void
  grid_line(grid: number, row: number, col_start: number, data: any[]): void
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
  win_pos(
    grid: number,
    win: ExtContainer,
    startrow: number,
    startcol: number,
    width: number,
    height: number
  ): void
  win_float_pos(
    grid: number,
    win: ExtContainer,
    anchor: string,
    anchor_grid: number,
    anchor_row: number,
    anchor_col: number,
    focusable: boolean
  ): void
  win_external_pos(grid: number, win: ExtContainer): void
  win_hide(grid: number): void
  win_close(grid: number): void
  msg_set_pos(
    grid: number,
    row: number,
    scrolled: boolean,
    sep_char: string
  ): void
  win_viewport(
    grid: number,
    win: ExtContainer,
    topline: number,
    botline: number,
    curline: number,
    curcol: number
  ): void
  popupmenu_show(
    items: any[],
    selected: number,
    row: number,
    col: number,
    grid: number
  ): void
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
  msg_show(kind: string, content: any[], replace_last: boolean): void
  msg_clear(): void
  msg_showcmd(content: any[]): void
  msg_showmode(content: any[]): void
  msg_ruler(content: any[]): void
  msg_history_show(entries: any[]): void
}

export interface Api {
  commandOutput(command: string): Promise<string>
  executeLua(code: string, args: any[]): Promise<any>
  uiAttach(width: number, height: number, options: object): void
  uiDetach(): void
  uiTryResize(width: number, height: number): void
  uiSetOption(name: string, value: any): void
  uiTryResizeGrid(grid: number, width: number, height: number): void
  uiPumSetHeight(height: number): void
  uiPumSetBounds(width: number, height: number, row: number, col: number): void
  exec(src: string, output: boolean): Promise<string>
  command(command: string): void
  getHlByName(name: string, rgb: boolean): Promise<object>
  getHlById(hl_id: number, rgb: boolean): Promise<object>
  getHlIdByName(name: string): Promise<number>
  setHl(ns_id: number, name: string, val: object): void
  setHlNs(ns_id: number): void
  feedkeys(keys: string, mode: string, escape_csi: boolean): void
  input(keys: string): Promise<number>
  inputMouse(
    button: string,
    action: string,
    modifier: string,
    grid: number,
    row: number,
    col: number
  ): void
  replaceTermcodes(
    str: string,
    from_part: boolean,
    do_lt: boolean,
    special: boolean
  ): Promise<string>
  eval(expr: string): Promise<any>
  execLua(code: string, args: any[]): Promise<any>
  callFunction(fn: string, args: any[]): Promise<any>
  callDictFunction(dict: any, fn: string, args: any[]): Promise<any>
  strwidth(text: string): Promise<number>
  listRuntimePaths(): Promise<string[]>
  getRuntimeFile(name: string, all: boolean): Promise<string[]>
  setCurrentDir(dir: string): void
  getCurrentLine(): Promise<string>
  setCurrentLine(line: string): void
  delCurrentLine(): void
  getVar(name: string): Promise<any>
  setVar(name: string, value: any): void
  delVar(name: string): void
  getVvar(name: string): Promise<any>
  setVvar(name: string, value: any): void
  getOption(name: string): Promise<any>
  getAllOptionsInfo(): Promise<object>
  getOptionInfo(name: string): Promise<object>
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
  createBuf(listed: boolean, scratch: boolean): Promise<ExtContainer>
  openWin(buffer: Buffer, enter: boolean, config: object): Promise<ExtContainer>
  listTabpages(): Promise<ExtContainer[]>
  getCurrentTabpage(): Promise<ExtContainer>
  setCurrentTabpage(tabpage: Tabpage): void
  createNamespace(name: string): Promise<number>
  getNamespaces(): Promise<object>
  paste(data: string, crlf: boolean, phase: number): Promise<boolean>
  put(lines: string[], type: string, after: boolean, follow: boolean): void
  subscribe(event: string): void
  unsubscribe(event: string): void
  getColorByName(name: string): Promise<number>
  getColorMap(): Promise<object>
  getContext(opts: object): Promise<object>
  loadContext(dict: object): Promise<any>
  getMode(): Promise<object>
  getKeymap(mode: string): Promise<object[]>
  setKeymap(mode: string, lhs: string, rhs: string, opts: object): void
  delKeymap(mode: string, lhs: string): void
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
  selectPopupmenuItem(
    item: number,
    insert: boolean,
    finish: boolean,
    opts: object
  ): void
  setDecorationProvider(ns_id: number, opts: object): void
  buffer: Buffer
  window: Window
  tabpage: Tabpage
}

export interface Buffer {
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
  getOffset(buffer: Buffer, index: number): Promise<number>
  getVar(buffer: Buffer, name: string): Promise<any>
  getChangedtick(buffer: Buffer): Promise<number>
  getKeymap(buffer: Buffer, mode: string): Promise<object[]>
  setKeymap(
    buffer: Buffer,
    mode: string,
    lhs: string,
    rhs: string,
    opts: object
  ): void
  delKeymap(buffer: Buffer, mode: string, lhs: string): void
  getCommands(buffer: Buffer, opts: object): Promise<object>
  setVar(buffer: Buffer, name: string, value: any): void
  delVar(buffer: Buffer, name: string): void
  getOption(buffer: Buffer, name: string): Promise<any>
  setOption(buffer: Buffer, name: string, value: any): void
  getName(buffer: Buffer): Promise<string>
  setName(buffer: Buffer, name: string): void
  isLoaded(buffer: Buffer): Promise<boolean>
  delete(buffer: Buffer, opts: object): void
  isValid(buffer: Buffer): Promise<boolean>
  getMark(buffer: Buffer, name: string): Promise<number[]>
  getExtmarkById(
    buffer: Buffer,
    ns_id: number,
    id: number,
    opts: object
  ): Promise<number[]>
  getExtmarks(
    buffer: Buffer,
    ns_id: number,
    start: any,
    end: any,
    opts: object
  ): Promise<any[]>
  setExtmark(
    buffer: Buffer,
    ns_id: number,
    line: number,
    col: number,
    opts: object
  ): Promise<number>
  delExtmark(buffer: Buffer, ns_id: number, id: number): Promise<boolean>
  addHighlight(
    buffer: Buffer,
    src_id: number,
    hl_group: string,
    line: number,
    col_start: number,
    col_end: number
  ): Promise<number>
  clearNamespace(
    buffer: Buffer,
    ns_id: number,
    line_start: number,
    line_end: number
  ): void
  setVirtualText(
    buffer: Buffer,
    src_id: number,
    line: number,
    chunks: any[],
    opts: object
  ): Promise<number>
  // TODO(smolck): Not exactly sure what this is, or what LuaRef should be in TS
  // call(buffer: Buffer, fun: LuaRef): Promise<any>
  getNumber(buffer: Buffer): Promise<number>
  clearHighlight(
    buffer: Buffer,
    ns_id: number,
    line_start: number,
    line_end: number
  ): void
}

export interface Window {
  getBuf(window: Window): Promise<ExtContainer>
  setBuf(window: Window, buffer: Buffer): void
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
  setConfig(window: Window, config: object): void
  getConfig(window: Window): Promise<object>
  close(window: Window, force: boolean): void
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