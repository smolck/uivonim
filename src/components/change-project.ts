import { getDirFiles, exists, pathRelativeToHome } from '../support/utils'
import { createVim, renameCurrentToCwd } from '../core/instance-manager'
import { RowNormal, RowImportant } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { Plugin } from '../components/plugin-container'
import Input from '../components/text-input'
import { join, sep, basename } from 'path'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { homedir } from 'os'

const $HOME = homedir()

interface FileDir {
  name: string
  file: boolean
  dir: boolean
}

const state = {
  value: '',
  cwd: '',
  path: '',
  paths: [] as FileDir[],
  cache: [] as FileDir[],
  visible: false,
  index: 0,
  create: false,
}

type S = typeof state

const absPath = (path = '') =>
  path.startsWith('~') ? join($HOME, path.slice(1)) : path
const validPath = async (path = '') => {
  if (!path) return ''
  const fullpath = absPath(path)
  return (await exists(fullpath)) ? fullpath : ''
}

const filterDirs = (filedirs: FileDir[]) => filedirs.filter((f) => f.dir)

let listElRef: HTMLElement

const resetState = { value: '', path: '', visible: false, index: 0 }

const actions = {
  select: () => (s: S) => {
    vimFocus()
    if (!s.paths.length) return resetState
    const { name } = s.paths[s.index]
    if (!name) return
    const dirpath = join(s.path, name)
    s.create ? createVim(name, dirpath) : api.nvim.cmd(`cd ${dirpath}`)
    return resetState
  },

  change: (value: string) => (s: S) => ({
    value,
    index: 0,
    paths: value
      ? filterDirs(filter(s.paths, value, { key: 'name' }))
      : s.cache,
  }),

  tab: () => (s: S) => {
    if (!s.paths.length) return resetState
    const { name } = s.paths[s.index]
    if (!name) return
    const path = join(s.path, name)
    getDirFiles(path).then((paths) =>
      ui.show({ path, paths: filterDirs(paths) })
    )
  },

  jumpNext: () => (s: S) => {
    const { name, dir } = s.paths[s.index]
    if (!dir) return
    const path = join(s.path, name)
    getDirFiles(path).then((paths) =>
      ui.show({ path, paths: filterDirs(paths) })
    )
  },

  jumpPrev: () => (s: S) => {
    const next = s.path.split(sep)
    next.pop()
    const path = join(sep, ...next)
    getDirFiles(path).then((paths) =>
      ui.show({ path, paths: filterDirs(paths) })
    )
  },

  show: ({ paths, path, cwd, create }: any) => (s: S) => (
    vimBlur(),
    {
      path,
      paths,
      create,
      cwd: cwd || s.cwd,
      index: 0,
      value: '',
      visible: true,
      cache: paths,
    }
  ),

  // TODO: be more precise than this? also depends on scaled devices
  down: () => (s: S) => {
    listElRef.scrollTop += 300
    return { index: Math.min(s.index + 17, s.paths.length - 1) }
  },

  up: () => (s: S) => {
    listElRef.scrollTop -= 300
    return { index: Math.max(s.index - 17, 0) }
  },

  top: () => {
    listElRef.scrollTop = 0
  },
  bottom: () => {
    listElRef.scrollTop = listElRef.scrollHeight
  },
  hide: () => (vimFocus(), resetState),
  next: () => (s: S) => ({
    index: s.index + 1 >= s.paths.length ? 0 : s.index + 1,
  }),
  prev: () => (s: S) => ({
    index: s.index - 1 < 0 ? s.paths.length - 1 : s.index - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Plugin($.visible, [
    ,
    Input({
      up: a.up,
      top: a.top,
      tab: a.tab,
      next: a.next,
      prev: a.prev,
      down: a.down,
      hide: a.hide,
      select: a.select,
      change: a.change,
      bottom: a.bottom,
      jumpNext: a.jumpNext,
      jumpPrev: a.jumpPrev,
      value: $.value,
      focus: true,
      icon: Icon.Home,
      desc: $.create ? 'create new vim session with project' : 'change project',
    }),

    h(RowImportant, [, h('span', pathRelativeToHome($.path))]),

    h(
      'div',
      {
        oncreate: (e: HTMLElement) => {
          if (e) listElRef = e
        },
        style: {
          maxHeight: '50vh',
          overflowY: 'hidden',
        },
      },
      $.paths.map(({ name }, ix) =>
        h(
          RowNormal,
          {
            key: name,
            active: ix === $.index,
          },
          [, h('span', name)]
        )
      )
    ),
  ])

const ui = app({ name: 'change-project', state, actions, view })

const go = async (userPath: string, create = false) => {
  const cwd = (await validPath(userPath)) || api.nvim.state.cwd
  const filedirs = await getDirFiles(cwd)
  const paths = filterDirs(filedirs)
  ui.show({ paths, cwd, path: cwd, create })
}

api.onAction('change-dir', (path = '') => go(path, false))
api.onAction('vim-create-dir', (path = '') => go(path, true))

api.nvim.watchState.cwd((cwd: string) => {
  if (cwd && homedir() !== cwd) renameCurrentToCwd(basename(cwd))
})

export const changeDir = () => go('', false)
export const createInstanceWithDir = () => go('', true)
