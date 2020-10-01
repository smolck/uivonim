import { shell, exists, watchFile } from '../support/utils'
import { EventEmitter } from 'events'
import nvim from '../neovim/api'
import * as path from 'path'

export interface GitStatus {
  additions: number
  deletions: number
}

export interface GitInfo {
  branch: string
  status: GitStatus
}

const ee = new EventEmitter()
export const onStatus = (fn: (status: GitStatus) => void) => ee.on('status', fn)
export const onBranch = (fn: (branch: string) => void) => ee.on('branch', fn)
export const getGitInfo = async (): Promise<GitInfo> => {
  if (!nvim.state.cwd)
    return { status: { additions: 0, deletions: 0 }, branch: '' }

  const [status, branch] = await Promise.all([
    getStatus(nvim.state.cwd),
    getBranch(nvim.state.cwd),
  ])

  return { status, branch }
}

const watchers: { branch: any; status: any } = {
  branch: undefined,
  status: undefined,
}

const getStatus = async (cwd: string) => {
  const res = await shell(`git diff --numstat`, { cwd })
  return res
    .split('\n')
    .map((s) => {
      const [, additions, deletions] =
        s.match(/^(\d+)\s+(\d+)\s+.*$/) || ([] as any)
      return {
        additions: parseInt(additions) || 0,
        deletions: parseInt(deletions) || 0,
      }
    })
    .reduce(
      (total, item) => {
        total.additions += item.additions
        total.deletions += item.deletions
        return total
      },
      { additions: 0, deletions: 0 }
    )
}

const getBranch = (cwd: string) =>
  shell(`git rev-parse --abbrev-ref HEAD`, { cwd })

const updateStatus = async (cwd: string) => {
  const status = await getStatus(cwd)
  ee.emit('status', status)
}

const updateBranch = async (cwd: string) => {
  const branch = await getBranch(cwd)
  ee.emit('branch', branch)
}

nvim.on.bufWrite(() => updateStatus(nvim.state.cwd))

nvim.watchState.cwd(async (cwd: string) => {
  updateBranch(cwd)
  updateStatus(cwd)

  if (watchers.branch) watchers.branch.close()
  if (watchers.status) watchers.status.close()

  const headPath = path.join(cwd, '.git/HEAD')
  const indexPath = path.join(cwd, '.git/index')

  if (await exists(headPath)) {
    watchers.branch = await watchFile(
      headPath,
      () => (updateBranch(cwd), updateStatus(cwd))
    )
  }
  if (await exists(indexPath)) {
    watchers.status = await watchFile(indexPath, () => updateStatus(cwd))
  }
})
