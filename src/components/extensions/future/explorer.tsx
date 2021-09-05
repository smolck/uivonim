import { RowNormal, RowImportant } from '../row-container'
import FiletypeIcon, { Folder } from '../filetype-icon'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { Plugin } from '../plugin-container'
import { join, sep, basename, dirname } from 'path'
import Input from '../text-input'
import { BufferType } from '../../types'
import { filter } from 'fuzzaldrin-plus'
import { colors } from '../../ui/styles'
import { cvar } from '../../ui/css'
import { render } from 'inferno'
import { pathRelativeTo } from '../../utils'

import { homeDir } from '@tauri-apps/api/path'
import { readDir, FileEntry } from '@tauri-apps/api/fs'
import { listen, invoke, currentNvimState } from '../../helpers'

let state = {
  homeDir: '',
  val: '',
  cwd: '',
  path: '',
  paths: [] as FileEntry[],
  cache: [] as FileEntry[],
  vis: false,
  ix: 0,
  pathMode: false,
  pathValue: '',
  inputCallbacks: {},
  pathModeInputCallbacks: {},
}

const sortDirFiles = (filedirs: FileEntry[]) => {
  const dirs = filedirs.filter((f) => f.path)
  const files = filedirs.filter((f) => f.name)
  return [...dirs, ...files]
}

const absolutePath = (path: string) =>
  path.replace(/^~\//, `${state.homeDir}/`)

const getDirs = (path: string) => readDir(path)
const getDirFiles = (path: string) => readDir(path) //.then((entries) => entries.filter((e) => !e.children && e.name))

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

let listElRef: HTMLElement

const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const Explorer = ({
  ix: index,
  vis: visible,
  val: value,
  path,
  pathMode,
  inputCallbacks,
  pathModeInputCallbacks,
  pathValue,
  paths,
}: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'explorer-input'}
      value={value}
      focus={!pathMode}
      desc={'explorer'}
      icon={'hard-drive'}
    />

    {!pathMode && (
      <RowImportant active={/* TODO(smolck): Is this right? */ false}>
        <span>{pathRelativeTo(path, state.homeDir)}</span>
      </RowImportant>
    )}

    {pathMode && (
      <Input
        {...pathModeInputCallbacks}
        id={'explorer-path-mode-input'}
        value={pathRelativeTo(pathValue, state.homeDir)}
        color={colors.important}
        icon={'search'}
        desc={'open path'}
        small={true}
        focus={true}
        pathMode={true}
        background={cvar('background-50')}
      />
    )}

    <WhyDiv
      onComponentDidMount={(e: HTMLElement) => (listElRef = e)}
      style={{ 'max-height': '50vh', 'overflow-y': 'hidden' }}
    >
      {paths.map(({ name, path }, ix) => (
        <RowNormal key={`${name}-${path}`} active={ix === index}>
          {path ? Folder : FiletypeIcon(name!)}

          <span
            style={{
              color: path && ix !== index ? cvar('foreground-50') : undefined,
            }}
          >
            {name}
          </span>
        </RowNormal>
      ))}
    </WhyDiv>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'explorer-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<Explorer {...state} />, container)
)

const updatePaths = (paths: FileEntry[]) => assignStateAndRender({ paths })

state.pathModeInputCallbacks = {
  change: (pathValue: string) => {
    pathExplore(pathValue).then(updatePaths)
    assignStateAndRender({ pathValue })
  },

  hide: () => assignStateAndRender({ pathMode: false }),

  select: () => {
    if (!state.pathValue) {
      assignStateAndRender({ pathMode: false, ix: 0 })
      return
    }
    getDirFiles(state.pathValue).then((paths) =>
      updatePaths(sortDirFiles(paths))
    )
    assignStateAndRender({ pathMode: false, path: state.pathValue, ix: 0 })
  },

  tab: () => {
    if (!state.paths.length) return
    const dir = dirname(absolutePath(state.pathValue))
    const { name } = state.paths[state.ix]
    const next = `${join(dir, name!)}/`
    pathExplore(next).then(updatePaths)
    assignStateAndRender({ ix: 0, pathValue: next })
  },

  next: () => {
    const ix = state.ix + 1 >= state.paths.length ? 0 : state.ix + 1
    const fullpath = absolutePath(state.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = state.paths[ix]
    const pathValue = `${join(goodPath, name!)}`
    assignStateAndRender({ ix, pathValue })
  },

  prev: () => {
    const ix = state.ix - 1 < 0 ? state.paths.length - 1 : state.ix - 1
    const fullpath = absolutePath(state.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = state.paths[ix]
    const pathValue = `${join(goodPath, name!)}`
    assignStateAndRender({ ix, pathValue })
  },
}

const show = ({ paths, path, cwd }: any) => (
  vimBlur(),
  assignStateAndRender({
    ...resetState,
    path,
    paths,
    vis: true,
    cache: paths,
    cwd: cwd || state.cwd,
  })
)

state.inputCallbacks = {
  // TODO: when choosing custom path and go back, make sure it updates correctly
  // like ~/proj/veonim/ -> OK
  // but  ~/proj/veonim -> DERP!

  ctrlG: () =>
    assignStateAndRender({ pathMode: true, ix: 0, val: '', pathValue: '' }),

  ctrlH: async () => {
    const { cwd } = currentNvimState()
    const filedirs = await getDirFiles(cwd)
    const paths = sortDirFiles(filedirs)
    show({ paths, cwd, path: cwd })
  },

  select: () => {
    vimFocus()
    if (!state.paths.length) {
      assignStateAndRender(resetState)
      return
    }

    const { name, path } = state.paths[state.ix]
    if (!name) return

    if (path) {
        invoke.nvimCmd({
          cmd: `e ${pathRelativeTo(join(state.path, name), state.cwd)}`
          })
        .then(() => assignStateAndRender(resetState))
      return
    }

    const pathNess = join(state.path, name)
    getDirFiles(pathNess).then((paths) =>
      show({ path, paths: sortDirFiles(paths) })
    )
  },

  change: (val: string) =>
    assignStateAndRender({
      val,
      ix: 0,
      paths: val
        ? sortDirFiles(filter(state.paths, val, { key: 'name' }))
        : state.cache,
    }),

  jumpPrev: () => {
    const next = state.path.split(sep)
    next.pop()
    const path = join(sep, ...next)
    getDirFiles(path).then((paths) =>
      show({ path, paths: sortDirFiles(paths) })
    )
  },

  // TODO: be more precise than this? also depends on scaled devices
  down: () => {
    listElRef.scrollTop += 300
    assignStateAndRender({
      ix: Math.min(state.ix + 17, state.paths.length - 1),
    })
  },

  up: () => {
    listElRef.scrollTop -= 300
    assignStateAndRender({ ix: Math.max(state.ix - 17, 0) })
  },

  top: () => {
    listElRef.scrollTop = 0
  },

  bottom: () => {
    listElRef.scrollTop = listElRef.scrollHeight
  },

  hide: () => (vimFocus(), assignStateAndRender(resetState)),
  next: () =>
    assignStateAndRender({
      ix: state.ix + 1 >= state.paths.length ? 0 : state.ix + 1,
    }),
  prev: () =>
    assignStateAndRender({
      ix: state.ix - 1 < 0 ? state.paths.length - 1 : state.ix - 1,
    }),
}

// TODO(smolck): I don't care to fix this component right now, but should
// probably do that.
listen.showExplorer(async (customDir?: string) => {
  state.homeDir = await homeDir()
  const { cwd, buffer_type, dir } = currentNvimState()
  const isTerminal = buffer_type === BufferType.Terminal
  const currentDir = isTerminal ? cwd : dir
  const path = customDir || currentDir

  const paths = sortDirFiles(await getDirFiles(path))
  show({ cwd, path, paths })
})
