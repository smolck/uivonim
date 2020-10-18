import { Plugin } from '../plugin-container'
import { RowNormal } from '../row-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import FiletypeIcon from '../filetype-icon'
import { basename, dirname, join } from 'path'
import Input from '../text-input'
import Worker from '../../messaging/worker'
import api from '../../core/instance-api'
import { cvar } from '../../ui/css'
import { render } from 'inferno'

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

let state = {
  val: '',
  files: [] as FileDir[],
  cache: [] as FileDir[],
  visible: false,
  ix: 0,
  currentFile: '',
  loading: false,
  inputCallbacks: {},
}

type S = typeof state

const resetState = {
  val: '',
  visible: false,
  ix: 0,
  loading: false,
  cache: [],
  files: [],
}

const feather = require('feather-icons')
// TODO: loading is so fast that setting `loading` on the Input flickers
// and looks janky use debounce or throttle to only show this if a
// loading operation has already been going for a few ms. e.g. 150ms or
// more, etc.
const Files = ({ visible, inputCallbacks, val, files, ix: index }: S) => (
  <Plugin visible={visible}>
    <Input
      {...inputCallbacks}
      id={'files-input'}
      value={val}
      focus={true}
      icon={feather.icons['file-text'].toSvg()}
      desc={'open file'}
    />

    <div>
      {files.map(({ dir, file }, ix) => (
        <RowNormal active={ix === index}>
          {FiletypeIcon(file)}

          <span style={{ color: cvar('foreground-50') }}>{dir}</span>
          <span
            style={{
              color:
                ix === index ? cvar('foreground-b20') : cvar('foreground-30'),
            }}
          >
            {file}
          </span>
        </RowNormal>
      ))}
    </div>
  </Plugin>
)

const container = document.createElement('div')
container.id = 'files-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<Files {...state} />, container)
)

const show = (currentFile: string) => (
  vimBlur(),
  assignStateAndRender({
    visible: true,
    currentFile,
    files: state.cache,
    loading: true,
  })
)

const loadingDone = () => assignStateAndRender({ loading: false })

const results = (files: string[]) =>
  assignStateAndRender({
    cache: !state.cache.length ? files.slice(0, 10) : state.cache,
    files: asDirFile(files, state.currentFile),
  })

state.inputCallbacks = {
  hide: () => {
    worker.call.stop()
    vimFocus()
    assignStateAndRender(resetState)
  },

  select: () => {
    vimFocus()
    if (!state.files.length) {
      assignStateAndRender(resetState)
      return
    }
    const { dir, file } = state.files[state.ix]
    const path = join(dir, file)
    if (file) api.nvim.cmd(`e ${path}`)
    assignStateAndRender(resetState)
  },

  change: (val: string) => {
    worker.call.query(val)
    assignStateAndRender({ val, ix: 0 })
  },

  next: () =>
    assignStateAndRender({
      ix: state.ix + 1 > Math.min(state.files.length - 1, 9) ? 0 : state.ix + 1,
    }),
  prev: () =>
    assignStateAndRender({
      ix: state.ix - 1 < 0 ? Math.min(state.files.length - 1, 9) : state.ix - 1,
    }),
}

worker.on.results((files: string[]) => results(files))
worker.on.done(loadingDone)

api.onAction('files', () => {
  worker.call.load(api.nvim.state.cwd)
  show(api.nvim.state.file)
})
