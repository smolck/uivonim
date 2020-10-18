import { getDirFiles, exists, pathRelativeToHome } from '../../../support/utils'
import { createVim, renameCurrentToCwd } from '../../../core/instance-manager'
import { RowNormal, RowImportant } from '../../row-container'
import { vimBlur, vimFocus } from '../../../ui/uikit'
import { Plugin } from '../../plugin-container'
import Input from '../../text-input'
import { join, sep, basename } from 'path'
import { filter } from 'fuzzaldrin-plus'
import api from '../../../core/instance-api'
import { homedir } from 'os'
import { render } from 'inferno'

const $HOME = homedir()

interface FileDir {
  name: string
  file: boolean
  dir: boolean
}

let state = {
  value: '',
  cwd: '',
  path: '',
  paths: [] as FileDir[],
  cache: [] as FileDir[],
  visible: false,
  index: 0,
  create: false,
  inputCallbacks: {},
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

const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const feather = require('feather-icons')
const ChangeProject = ({
  create,
  value,
  visible,
  path,
  paths,
  index,
  inputCallbacks,
}: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'change-project-input'}
      focus={true}
      value={value}
      icon={feather.icons['home'].toSvg()}
      desc={create ? 'create new vim session with project' : 'change project'}
    />
    <RowImportant active={/* TODO(smolck): Correct value? */ false}>
      {pathRelativeToHome(path)}
    </RowImportant>
    <WhyDiv
      onComponentDidMount={(e: HTMLElement) => {
        if (e) listElRef = e
      }}
      style={{ 'max-height': '50vh', 'overflow-y': 'hidden' }}
    >
      {paths.map(({ name }, ix) => (
        <RowNormal key={name} active={ix === index}>
          <span>{name}</span>
        </RowNormal>
      ))}
    </WhyDiv>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'change-project-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState),
  render(<ChangeProject {...state} />, container)
)

const show = ({ paths, path, cwd, create }: any) => (
  vimBlur(),
  assignStateAndRender({
    path,
    paths,
    create,
    cwd: cwd || state.cwd,
    index: 0,
    value: '',
    visible: true,
    cache: paths,
  })
)

state.inputCallbacks = {
  select: () => {
    vimFocus()
    if (!state.paths.length) {
      assignStateAndRender(resetState)
      return
    }
    const { name } = state.paths[state.index]
    if (!name) return
    const dirpath = join(state.path, name)
    state.create ? createVim(name, dirpath) : api.nvim.cmd(`cd ${dirpath}`)
    assignStateAndRender(resetState)
  },

  change: (value: string) =>
    assignStateAndRender({
      value,
      index: 0,
      paths: value
        ? filterDirs(filter(state.paths, value, { key: 'name' }))
        : state.cache,
    }),

  tab: () => {
    if (!state.paths.length) {
      assignStateAndRender(resetState)
      return
    }
    const { name } = state.paths[state.index]
    if (!name) return
    const path = join(state.path, name)
    getDirFiles(path).then((paths) => show({ path, paths: filterDirs(paths) }))
  },

  jumpNext: () => {
    const { name, dir } = state.paths[state.index]
    if (!dir) return
    const path = join(state.path, name)
    getDirFiles(path).then((paths) => show({ path, paths: filterDirs(paths) }))
  },

  jumpPrev: () => {
    const next = state.path.split(sep)
    next.pop()
    const path = join(sep, ...next)
    getDirFiles(path).then((paths) => show({ path, paths: filterDirs(paths) }))
  },

  // TODO: be more precise than this? also depends on scaled devices
  down: () => {
    listElRef.scrollTop += 300
    assignStateAndRender({
      index: Math.min(state.index + 17, state.paths.length - 1),
    })
  },

  up: () => {
    listElRef.scrollTop -= 300
    assignStateAndRender({ index: Math.max(state.index - 17, 0) })
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
      index: state.index + 1 >= state.paths.length ? 0 : state.index + 1,
    }),
  prev: () =>
    assignStateAndRender({
      index: state.index - 1 < 0 ? state.paths.length - 1 : state.index - 1,
    }),
}

const go = async (userPath: string, create = false) => {
  const cwd = (await validPath(userPath)) || api.nvim.state.cwd
  const filedirs = await getDirFiles(cwd)
  const paths = filterDirs(filedirs)
  show({ paths, cwd, path: cwd, create })
}

api.onAction('change-dir', (path = '') => go(path, false))
api.onAction('vim-create-dir', (path = '') => go(path, true))

api.nvim.watchState.cwd((cwd: string) => {
  if (cwd && homedir() !== cwd) renameCurrentToCwd(basename(cwd))
})

export const changeDir = () => go('', false)
export const createInstanceWithDir = () => go('', true)
