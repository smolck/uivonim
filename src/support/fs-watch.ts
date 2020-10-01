import { throttle } from '../support/utils'
import { promisify as P } from 'util'
import { EventEmitter } from 'events'
import { join } from 'path'
import * as fs from 'fs'

const watchers = new EventEmitter()
const watchedParentPaths = new Map<string, string>()

const emptyStat = { isSymbolicLink: () => false }
const getFSStat = async (path: string) =>
  P(fs.lstat)(path).catch((_) => emptyStat)

const getRealPath = async (path: string) => {
  const stat = await getFSStat(path)
  const isSymbolicLink = stat.isSymbolicLink()
  if (!isSymbolicLink) return path
  return P(fs.readlink)(path)
}

const watchDir = (path: string) =>
  fs.watch(path, (_, file) => {
    const fullpath = join(path, file)
    watchers.emit(fullpath)
  })

export const watchFile = async (path: string, callback: () => void) => {
  const realpath = await getRealPath(path)
  const parentPath = join(realpath, '../')
  const notifyCallback = throttle(callback, 15)
  watchers.on(realpath, notifyCallback)
  if (!watchedParentPaths.has(parentPath)) watchDir(parentPath)
  return { close: () => watchers.removeListener(realpath, notifyCallback) }
}
