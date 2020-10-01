import { exec } from 'child_process'
import { clipboard } from 'electron'
import { remote } from 'electron'
import { totalmem } from 'os'

interface Process {
  cmd: string
  pid: number
  cpu: number
  memory: number
}

interface ProcessHistory {
  cmd: string
  pid: number
  count: number
  maxMemory: number
  maxCPU: number
  averageMemory: number
  averageCPU: number
  usages: Map<number, number>
}

interface ProcessStats {
  cmd: string
  pid: number
  parentPid: number
  load: number
  memory: number
}

interface ProcessItem extends ProcessStats {
  children?: ProcessItem[]
}

const MB = 1024 * 1024
const CMD = '/bin/ps -ax -o pid=,ppid=,pcpu=,pmem=,command='
const PID_CMD = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)\s+(.+)$/
const usageHistory = new Map<number, ProcessHistory>()
const container = document.getElementById('process-list') as HTMLElement
const historyContainer = document.getElementById(
  'process-history'
) as HTMLElement
const copyHistoryButton = document.getElementById('copy-history') as HTMLElement
let elapsedTime = 0

const listProcesses = (rootPid: number): Promise<ProcessItem> =>
  new Promise((done) => {
    let rootItem: ProcessItem
    const map = new Map<number, ProcessItem>()

    const addToTree = ({ cmd, pid, parentPid, load, memory }: ProcessStats) => {
      const parent = map.get(parentPid)
      const isParent = pid === rootPid || parent
      if (!isParent) return

      const item: ProcessStats = {
        cmd,
        pid,
        parentPid,
        load,
        memory,
      }

      map.set(pid, item)

      if (pid === rootPid) rootItem = item

      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(item)
        if (parent.children.length > 1) {
          parent.children = parent.children.sort((a, b) => a.pid - b.pid)
        }
      }
    }

    exec(CMD, { maxBuffer: 1000 * 1024 }, (err, stdout, stderr) => {
      if (err || stderr) return console.error(err || stderr.toString())

      stdout
        .toString()
        .split('\n')
        .map((line) => {
          const [, pid, ppid, load, mem, cmd] =
            PID_CMD.exec(line.trim()) || ([] as any)
          const stats = {
            cmd,
            pid: parseInt(pid),
            parentPid: parseInt(ppid),
            load: parseFloat(load),
            memory: parseFloat(mem),
          }

          addToTree(stats)
        })

      done(rootItem)
    })
  })

const findName = (cmd: string): string => {
  const SHARED_PROCESS_HINT = /--disable-blink-features=Auxclick/
  const WINDOWS_WATCHER_HINT = /\\watcher\\win32\\CodeHelper\.exe/
  const WINDOWS_CRASH_REPORTER = /--crashes-directory/
  const WINDOWS_PTY = /\\pipe\\winpty-control/
  const WINDOWS_CONSOLE_HOST = /conhost\.exe/
  const TYPE = /--type=([a-zA-Z-]+)/

  // find windows file watcher
  if (WINDOWS_WATCHER_HINT.exec(cmd)) return 'watcherService '

  // find windows crash reporter
  if (WINDOWS_CRASH_REPORTER.exec(cmd)) return 'electron-crash-reporter'

  // find windows pty process
  if (WINDOWS_PTY.exec(cmd)) return 'winpty-process'

  //find windows console host process
  if (WINDOWS_CONSOLE_HOST.exec(cmd))
    return 'console-window-host (Windows internal process)'

  // find "--type=xxxx"
  let matches = TYPE.exec(cmd)
  if (matches && matches.length === 2) {
    if (matches[1] === 'renderer') {
      if (SHARED_PROCESS_HINT.exec(cmd)) {
        return 'shared-process'
      }

      return `window`
    }
    return matches[1]
  }

  // find all xxxx.js
  const JS = /[a-zA-Z-]+\.js/g
  let result = ''
  do {
    matches = JS.exec(cmd)
    if (matches) {
      result += matches + ' '
    }
  } while (matches)

  if (result) {
    if (cmd.indexOf('node ') !== 0) {
      return `electron_node ${result}`
    }
  }
  return cmd
}

const parseName = (cmd: string, pid: number): string => {
  // browser windows (renderer processes)
  if (pid === remote.process.pid) return 'Veonim'
  if (pid === process.pid) return 'window: Process Explorer'
  if (cmd.includes('background-color=#222')) return 'window: Main'

  // neovim
  if (cmd.includes('nvim') && cmd.includes('call rpcnotify')) return 'Neovim'
  if (cmd.includes('nvim') && cmd.includes('--cmd colorscheme veonim'))
    return 'Neovim - Auxillary Syntax Highlighter'
  if (
    cmd.includes('nvim') &&
    cmd.includes('--cmd com! -nargs=+ -range Veonim 1')
  )
    return 'Neovim - "errorformat" Parser'

  return findName(cmd)
}

const objToItem = (
  { cmd, pid, load, memory, children = [] }: ProcessItem,
  list: Process[],
  depth = 0
) => {
  const mem =
    process.platform === 'win32' ? memory : totalmem() * (memory / 100)

  const item: Process = {
    cmd: '&nbsp;'.repeat(depth * 4) + parseName(cmd, pid),
    cpu: Number(load.toFixed(0)),
    pid: Number(pid.toFixed(0)),
    memory: Number((mem / MB).toFixed(0)),
  }

  list.push(item)
  children.forEach((pi) => objToItem(pi, list, depth + 1))
}

const processTreeToList = (processes: ProcessItem): Process[] => {
  let depth = 0
  let list = [] as Process[]
  objToItem(processes, list, depth)
  return list
}

const rollingAverage = (
  currentAverage: number,
  count: number,
  nextValue: number
): number => {
  let average = currentAverage
  average -= average / count
  average += nextValue / count
  return Math.round(average)
}

const collectHistory = (procs: Process[]) =>
  procs.forEach((proc) => {
    const item = usageHistory.get(proc.pid) || {
      pid: proc.pid,
      cmd: proc.cmd.replace(/&nbsp;/g, ''),
      count: 0,
      maxMemory: proc.memory,
      maxCPU: proc.cpu,
      averageMemory: proc.memory,
      averageCPU: proc.cpu,
      usages: new Map<number, number>(),
    }

    item.count += 1

    if (proc.memory > item.maxMemory) item.maxMemory = proc.memory
    if (proc.cpu > item.maxCPU) item.maxCPU = proc.cpu

    item.averageMemory = rollingAverage(
      item.averageMemory,
      item.count,
      proc.memory
    )
    item.averageCPU = rollingAverage(item.averageCPU, item.count, proc.cpu)

    const roundedUsage = Math.round(proc.cpu / 10) * 10
    const prevUsage = item.usages.get(roundedUsage) || 0
    item.usages.set(roundedUsage, prevUsage + 1)

    usageHistory.set(proc.pid, item)
  })

const renderHistory = () => {
  const history = [...usageHistory.values()]

  historyContainer.innerHTML = history
    .map((hist) => {
      const usageValues = [...hist.usages.entries()]
      const usages = usageValues
        .sort((a, b) => b[0] - a[0])
        .map((u) => `<div>${u[0]}% - ${u[1]}s</div>`)
        .join('')

      return `<div>
      <div style="padding-bottom: 10px; padding-top: 40px;">
        <strong style="font-size: 20px">${hist.cmd}</strong>
        <span style="color: #666"> (${hist.pid})<span>
      </div>
      <div style="color: #999; font-size: 13px; padding-bottom: 8px;">Average / Max</div>
      <div style="padding-bottom: 4px;">CPU: <strong>${hist.averageCPU} / ${hist.maxCPU}</strong></div>
      <div style="padding-bottom: 4px;">Memory (MB): <strong>${hist.averageMemory} / ${hist.maxMemory}</strong></div>
      <div style="padding-top: 10px">${usages}</div>
    </div>
    <br/>`
    })
    .join('')
}

const renderProcesses = (procs: Process[]) => {
  const head = `
    <tr>
      <th align="left">CPU %</th>
      <th align="left">Memory (MB)</th>
      <th align="left">PID</th>
      <th align="left">Name</th>
      <th align="left"></th>
      <th align="left"></th>
    </tr>`

  const body = procs.reduce((res, p) => {
    res += `
      <tr id=${p.pid}>
        <td align="center">${p.cpu}</td>
        <td align="center">${p.memory}</td>
        <td align="center" style="color: #999">${p.pid}</td>
        <td>${p.cmd}</td>
        <td><button id=${p.pid} action="kill">KILL</button></td>
        <td><button id=${p.pid} action="force-kill">FORCE KILL</button></td>
      </tr>`
    return res
  }, '')

  container.innerHTML = `<table>
    <thead>${head}</thead>
    <tbody>${body}</tbody>
  </table>`
}

container.addEventListener('click', (e) => {
  const el = e.target as HTMLElement
  const action = el.getAttribute('action')
  const id = el.getAttribute('id')

  if (!id) return alert('no PID exists for this process?? wat')
  if (!action) return alert('no kill action exists for this process?? wat')

  const kaput = action === 'force-kill' ? 'SIGKILL' : 'SIGTERM'

  process.kill(<any>id - 0, kaput)
})

copyHistoryButton.addEventListener('click', () => {
  const collected = [...usageHistory.values()].map((hist) => ({
    ...hist,
    usages: [...hist.usages.entries()].map((m) => ({
      percentage: m[0],
      time: m[1],
    })),
  }))

  const data = JSON.stringify({
    elapsedTime,
    history: collected,
  })

  clipboard.writeText(data)
  alert('copied history JSON to clipboard')
})

const refresh = async () => {
  elapsedTime += 1
  const processTree = await listProcesses(remote.process.pid)
  const processList = processTreeToList(processTree)
  renderProcesses(processList)
  const relevantProcesses = processList.filter(
    (p) => !p.cmd.includes('/bin/ps -ax')
  )
  collectHistory(relevantProcesses)
  renderHistory()
}

refresh()
setInterval(refresh, 1000)
