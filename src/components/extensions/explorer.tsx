import {
  getDirFiles,
  pathRelativeToHome,
  pathRelativeToCwd,
  getDirs,
  $HOME,
} from '../../support/utils'
import { RowNormal, RowImportant } from '../row-container'
import FiletypeIcon, { Folder } from '../filetype-icon'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { Plugin } from '../plugin-container'
import { join, sep, basename, dirname } from 'path'
import Input from '../text-input'
import { BufferType } from '../../neovim/types'
import { filter } from 'fuzzaldrin-plus'
import api from '../../core/instance-api'
import { colors } from '../../ui/styles'
import { cvar } from '../../ui/css'
import { render } from 'inferno'

interface FileDir {
  name: string
  file: boolean
  dir: boolean
}

let state = {
  val: '',
  cwd: '',
  path: '',
  paths: [] as FileDir[],
  cache: [] as FileDir[],
  vis: false,
  ix: 0,
  pathMode: false,
  pathValue: '',
  inputCallbacks: {},
  pathModeInputCallbacks: {},
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

let listElRef: HTMLElement

const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const feather = require('feather-icons')
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
      icon={feather.icons['hard-drive'].toSvg({
        width: 12,
        height: 12,
      })}
    />

    {!pathMode && (
      <RowImportant active={/* TODO(smolck): Is this right? */ false}>
        <span>{pathRelativeToHome(path)}</span>
      </RowImportant>
    )}

    {pathMode && (
      <Input
        {...pathModeInputCallbacks}
        id={'explorer-path-mode-input'}
        value={pathRelativeToHome(pathValue)}
        color={colors.important}
        icon={feather.icons['search'].toSvg({ width: 12, height: 12 })}
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
      {paths.map(({ name, dir }, ix) => (
        <RowNormal key={`${name}-${dir}`} active={ix === index}>
          {dir ? Folder : FiletypeIcon(name)}

          <span
            style={{
              color: dir && ix !== index ? cvar('foreground-50') : undefined,
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

const updatePaths = (paths: FileDir[]) => assignStateAndRender({ paths })

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
    const next = `${join(dir, name)}/`
    pathExplore(next).then(updatePaths)
    assignStateAndRender({ ix: 0, pathValue: next })
  },

  next: () => {
    const ix = state.ix + 1 >= state.paths.length ? 0 : state.ix + 1
    const fullpath = absolutePath(state.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = state.paths[ix]
    const pathValue = `${join(goodPath, name)}`
    assignStateAndRender({ ix, pathValue })
  },

  prev: () => {
    const ix = state.ix - 1 < 0 ? state.paths.length - 1 : state.ix - 1
    const fullpath = absolutePath(state.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = state.paths[ix]
    const pathValue = `${join(goodPath, name)}`
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
    const { cwd } = api.nvim.state
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

    const { name, file } = state.paths[state.ix]
    if (!name) return

    if (file) {
      api.nvim.cmd(`e ${pathRelativeToCwd(join(state.path, name), state.cwd)}`)
      assignStateAndRender(resetState)
      return
    }

    const path = join(state.path, name)
    getDirFiles(path).then((paths) =>
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

api.onAction('explorer', async (customDir?: string) => {
  const { cwd, bufferType } = api.nvim.state
  const isTerminal = bufferType === BufferType.Terminal
  const currentDir = isTerminal ? cwd : api.nvim.state.dir
  const path = customDir || currentDir

  const paths = sortDirFiles(await getDirFiles(path))
  show({ cwd, path, paths })
})
