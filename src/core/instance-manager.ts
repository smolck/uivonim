import { onExit, attachTo, switchTo, create } from '../core/master-control'
import Worker from '../messaging/worker'
import { EventEmitter } from 'events'
import { remote } from 'electron'

interface Nvim {
  id: number
  name: string
  active: boolean
  path: string
  nameFollowsCwd: boolean
  instance: ReturnType<typeof Worker>
}

interface NvimInfo {
  id: number
  path: string
}

const ee = new EventEmitter()
ee.setMaxListeners(200)
const vims = new Map<number, Nvim>()
let currentVimID = -1

export const getActiveInstance = () => {
  const nvim = vims.get(currentVimID)
  if (!nvim)
    throw new Error(
      `failed to get active instance. this should probably not happen... ever`
    )
  return nvim.instance
}

export const createVim = async (name: string, dir?: string) => {
  const { id, path } = await create({ dir })
  const lastId = currentVimID
  const instance = Worker('instance', {
    workerData: { id, nvimPath: path },
  })
  currentVimID = id
  vims.forEach((v) => (v.active = false))
  vims.set(id, {
    id,
    path,
    name,
    instance,
    active: true,
    nameFollowsCwd: !!dir,
  })
  ee.emit('create', { id, path })
  attachTo(id)
  switchTo(id)
  ee.emit('switch', id, lastId)
}

export const switchVim = async (id: number) => {
  if (!vims.has(id)) return
  const lastId = currentVimID
  currentVimID = id
  switchTo(id)
  vims.forEach((v) => {
    v.active = v.id === id
    v.instance.call.instanceActiveStatus(v.id === id)
  })
  ee.emit('switch', id, lastId)
}

const renameVim = (id: number, newName: string) => {
  if (!vims.has(id)) return
  const vim = vims.get(id)!
  vim.name = newName
  vim.nameFollowsCwd = false
}

export const getCurrentName = () => {
  const active = [...vims.values()].find((v) => v.active)
  return active ? active.name : ''
}

export const renameCurrent = (name: string) => {
  const active = [...vims.values()].find((v) => v.active)
  if (!active) return
  renameVim(active.id, name)
}

export const renameCurrentToCwd = (cwd: string) => {
  const active = [...vims.values()].find((v) => v.active)
  if (!active) return
  if (active.nameFollowsCwd) active.name = cwd
}

export const list = () =>
  [...vims.values()]
    .filter((v) => !v.active)
    .map((v) => ({ id: v.id, name: v.name }))

export const instances = {
  get current() {
    return currentVimID
  },
}

export const onCreateVim = (fn: (info: NvimInfo) => void) => {
  ee.on('create', (info: NvimInfo) => fn(info))
  ;[...vims.entries()].forEach(([id, vim]) => fn({ id, path: vim.path }))
}

export const onSwitchVim = (fn: (id: number, lastId: number) => void) => {
  ee.on('switch', (id, lastId) => fn(id, lastId))
}

// because of circular dependency chain. master-control exports onExit.
// master-control imports a series of dependencies which eventually
// import this module. thus onExit will not be exported yet.
setImmediate(() =>
  onExit((id: number) => {
    const vim = vims.get(id)

    if (vim) {
      vim.instance.terminate()
      vims.delete(id)
    }

    if (!vims.size) return remote.app.quit()

    const next = Math.max(...vims.keys())
    switchVim(next)
  })
)
