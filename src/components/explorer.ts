import {
  getDirFiles,
  pathRelativeToHome,
  pathRelativeToCwd,
  getDirs,
  $HOME,
} from '../support/utils'
import { RowNormal, RowImportant } from '../components/row-container'
import FiletypeIcon, { Folder } from '../components/filetype-icon'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import { Plugin } from '../components/plugin-container'
import { join, sep, basename, dirname } from 'path'
import Input from '../components/text-input'
import { BufferType } from '../neovim/types'
import { filter } from 'fuzzaldrin-plus'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { colors } from '../ui/styles'
import { cvar } from '../ui/css'

interface FileDir {
  name: string
  file: boolean
  dir: boolean
}

const state = {
  val: '',
  cwd: '',
  path: '',
  paths: [] as FileDir[],
  cache: [] as FileDir[],
  vis: false,
  ix: 0,
  pathMode: false,
  pathValue: '',
}

const sortDirFiles = (filedirs: FileDir[]) => {
  const dirs = filedirs.filter((f) => f.dir)
  const files = filedirs.filter((f) => f.file)
  return [...dirs, ...files]
}

const absolutePath = (path: string) => path.replace(/^~\//, `${$HOME}/`)

const pathExplore = async (path: string) => {
  const fullpath = absolutePath(path)
  const complete = fullpath.endsWith('/')
  const dir = complete ? fullpath : dirname(fullpath)
  const top = basename(fullpath)
  const dirs = await getDirs(dir)
  return complete ? dirs : filter(dirs, top, { key: 'name' })
}

const resetState = { val: '', path: '', vis: false, ix: 0 }

type S = typeof state

const actions = {
  // TODO: when choosing custom path and go back, make sure it updates correctly
  // like ~/proj/veonim/ -> OK
  // but  ~/proj/veonim -> DERP!

  ctrlG: () => ({ pathMode: true, ix: 0, val: '', pathValue: '' }),

  completePath: () => (s: S) => {
    if (!s.paths.length) return
    const dir = dirname(absolutePath(s.pathValue))
    const { name } = s.paths[s.ix]
    const next = `${join(dir, name)}/`
    pathExplore(next).then(ui.updatePaths)
    return { ix: 0, pathValue: next }
  },

  normalMode: () => ({ pathMode: false }),
  updatePaths: (paths: FileDir[]) => ({ paths }),

  selectPath: () => (s: S) => {
    if (!s.pathValue) return { pathMode: false, ix: 0 }
    getDirFiles(s.pathValue).then((paths) =>
      ui.updatePaths(sortDirFiles(paths))
    )
    return { pathMode: false, path: s.pathValue, ix: 0 }
  },

  changePath: (pathValue: string) => {
    pathExplore(pathValue).then(ui.updatePaths)
    return { pathValue }
  },

  nextPath: () => (s: S) => {
    const ix = s.ix + 1 >= s.paths.length ? 0 : s.ix + 1
    const fullpath = absolutePath(s.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = s.paths[ix]
    const pathValue = `${join(goodPath, name)}`
    return { ix, pathValue }
  },

  prevPath: () => (s: S) => {
    const ix = s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1
    const fullpath = absolutePath(s.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = s.paths[ix]
    const pathValue = `${join(goodPath, name)}`
    return { ix, pathValue }
  },

  select: () => (s: S) => {
    vimFocus()
    if (!s.paths.length) return resetState

    const { name, file } = s.paths[s.ix]
    if (!name) return

    if (file) {
      api.nvim.cmd(`e ${pathRelativeToCwd(join(s.path, name), s.cwd)}`)
      return resetState
    }

    const path = join(s.path, name)
    getDirFiles(path).then((paths) =>
      ui.show({ path, paths: sortDirFiles(paths) })
    )
  },

  change: (val: string) => (s: S) => ({
    val,
    ix: 0,
    paths: val ? sortDirFiles(filter(s.paths, val, { key: 'name' })) : s.cache,
  }),

  ctrlH: async () => {
    const { cwd } = api.nvim.state
    const filedirs = await getDirFiles(cwd)
    const paths = sortDirFiles(filedirs)
    ui.show({ paths, cwd, path: cwd })
  },

  jumpPrev: () => (s: S) => {
    const next = s.path.split(sep)
    next.pop()
    const path = join(sep, ...next)
    getDirFiles(path).then((paths) =>
      ui.show({ path, paths: sortDirFiles(paths) })
    )
  },

  show: ({ paths, path, cwd }: any) => (s: S) => (
    vimBlur(),
    {
      ...resetState,
      path,
      paths,
      vis: true,
      cache: paths,
      cwd: cwd || s.cwd,
    }
  ),

  // TODO: be more precise than this? also depends on scaled devices
  down: () => (s: S) => {
    listElRef.scrollTop += 300
    return { ix: Math.min(s.ix + 17, s.paths.length - 1) }
  },

  up: () => (s: S) => {
    listElRef.scrollTop -= 300
    return { ix: Math.max(s.ix - 17, 0) }
  },

  top: () => {
    listElRef.scrollTop = 0
  },
  bottom: () => {
    listElRef.scrollTop = listElRef.scrollHeight
  },
  hide: () => (vimFocus(), resetState),
  next: () => (s: S) => ({ ix: s.ix + 1 >= s.paths.length ? 0 : s.ix + 1 }),
  prev: () => (s: S) => ({ ix: s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1 }),
}

let listElRef: HTMLElement

type A = typeof actions

const view = ($: S, a: A) =>
  Plugin($.vis, [
    ,
    Input({
      value: $.val,
      focus: !$.pathMode,
      icon: Icon.HardDrive,
      desc: 'explorer',
      change: a.change,
      hide: a.hide,
      next: a.next,
      prev: a.prev,
      select: a.select,
      jumpPrev: a.jumpPrev,
      down: a.down,
      up: a.up,
      ctrlG: a.ctrlG,
      ctrlH: a.ctrlH,
    }),

    !$.pathMode && h(RowImportant, [, h('span', pathRelativeToHome($.path))]),

    $.pathMode &&
      Input({
        change: a.changePath,
        hide: a.normalMode,
        select: a.selectPath,
        tab: a.completePath,
        next: a.nextPath,
        prev: a.prevPath,
        value: pathRelativeToHome($.pathValue),
        background: cvar('background-50'),
        color: colors.important,
        icon: Icon.Search,
        desc: 'open path',
        small: true,
        focus: true,
        pathMode: true,
      }),

    h(
      'div',
      {
        oncreate: (e: HTMLElement) => (listElRef = e),
        style: {
          maxHeight: '50vh',
          overflowY: 'hidden',
        },
      },
      $.paths.map(({ name, dir }, ix) =>
        h(
          RowNormal,
          {
            key: `${name}-${dir}`,
            active: ix === $.ix,
          },
          [
            ,
            dir ? Folder : FiletypeIcon(name),

            h(
              'span',
              {
                style: {
                  color: dir && ix !== $.ix ? cvar('foreground-50') : undefined,
                },
              },
              name
            ),
          ]
        )
      )
    ),
  ])

const ui = app({ name: 'explorer', state, actions, view })

api.onAction('explorer', async (customDir?: string) => {
  const { cwd, bufferType } = api.nvim.state
  const isTerminal = bufferType === BufferType.Terminal
  const currentDir = isTerminal ? cwd : api.nvim.state.dir
  const path = customDir || currentDir

  const paths = sortDirFiles(await getDirFiles(path))
  ui.show({ cwd, path, paths })
})
