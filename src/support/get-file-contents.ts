import Worker from '../messaging/worker'
import nvim from '../neovim/api'

interface LineContents {
  ix: number
  line: string
}

const worker = Worker('get-file-lines')
const isCurrentBuffer = (path: string) => path === nvim.state.absoluteFilepath

const getFromCurrentBuffer = async (lines: number[]) => {
  const buffer = nvim.current.buffer
  const getLineRequests = lines.map(async (ix) => ({
    ix,
    line: await buffer.getLine(ix),
  }))

  return Promise.all(getLineRequests)
}

export const getLines = (
  path: string,
  lines: number[]
): Promise<LineContents[]> =>
  isCurrentBuffer(path)
    ? getFromCurrentBuffer(lines)
    : worker.request.getLines(path, lines)
