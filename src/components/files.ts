import { Plugin } from '../components/plugin-container'
import { RowNormal } from '../components/row-container'
import { h, app, vimBlur, vimFocus } from '../ui/uikit'
import FiletypeIcon from '../components/filetype-icon'
import { basename, dirname, join } from 'path'
import Input from '../components/text-input'
import Worker from '../messaging/worker'
import * as Icon from 'hyperapp-feather'
import api from '../core/instance-api'
import { cvar } from '../ui/css'

interface FileDir {
  dir: string
  file: string
}

const worker = Worker('project-file-finder')
const formatDir = (dir: string) => (dir === '.' ? '' : `${dir}/`)
const asDirFile = (files: string[], currentFile: string) =>
  files
    .filter((m) => m !== currentFile)
    .map((path) => ({
      dir: formatDir(dirname(path)),
      file: basename(path),
    }))

const state = {
  val: '',
  files: [] as FileDir[],
  cache: [] as FileDir[],
  vis: false,
  ix: 0,
  currentFile: '',
  loading: false,
}

type S = typeof state

const resetState = {
  val: '',
  vis: false,
  ix: 0,
  loading: false,
  cache: [],
  files: [],
}

const actions = {
  show: (currentFile: string) => (s: S) => (
    vimBlur(),
    {
      vis: true,
      currentFile,
      files: s.cache,
      loading: true,
    }
  ),

  hide: () => {
    worker.call.stop()
    vimFocus()
    return resetState
  },

  select: () => (s: S) => {
    vimFocus()
    if (!s.files.length) return resetState
    const { dir, file } = s.files[s.ix]
    const path = join(dir, file)
    if (file) api.nvim.cmd(`e ${path}`)
    return resetState
  },

  change: (val: string) => {
    worker.call.query(val)
    return { val, ix: 0 }
  },

  results: (files: string[]) => (s: S) => ({
    cache: !s.cache.length ? files.slice(0, 10) : s.cache,
    files: asDirFile(files, s.currentFile),
  }),

  loadingDone: () => ({ loading: false }),

  next: () => (s: S) => ({
    ix: s.ix + 1 > Math.min(s.files.length - 1, 9) ? 0 : s.ix + 1,
  }),
  prev: () => (s: S) => ({
    ix: s.ix - 1 < 0 ? Math.min(s.files.length - 1, 9) : s.ix - 1,
  }),
}

const view = ($: S, a: typeof actions) =>
  Plugin($.vis, [
    ,
    Input({
      hide: a.hide,
      select: a.select,
      change: a.change,
      next: a.next,
      prev: a.prev,
      value: $.val,
      focus: true,
      icon: Icon.FileText,
      desc: 'open file',
      // TODO: loading is so fast that this flickers and looks janky
      // use debounce or throttle to only show this if a loading operation
      // has already been going for a few ms. e.g. 150ms or more, etc.
      //loading: $.loading,
    }),

    h(
      'div',
      $.files.map(({ dir, file }, ix) =>
        RowNormal(
          {
            active: ix === $.ix,
          },
          [
            ,
            FiletypeIcon(file),

            h('span', { style: { color: cvar('foreground-50') } }, dir),

            h(
              'span',
              {
                style: {
                  color:
                    ix === $.ix
                      ? cvar('foreground-b20')
                      : cvar('foreground-30'),
                },
              },
              file
            ),
          ]
        )
      )
    ),
  ])

const ui = app({ name: 'files', state, actions, view })

worker.on.results((files: string[]) => ui.results(files))
worker.on.done(ui.loadingDone)

api.onAction('files', () => {
  worker.call.load(api.nvim.state.cwd)
  ui.show(api.nvim.state.file)
})

export const show = () => {}
