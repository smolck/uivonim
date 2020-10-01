import VscodeTestRunner from '../dev/vscode-test-runner'
import Playground from '../dev/playground'
import { createServer } from 'http'
import nvim from '../neovim/api'
import { join } from 'path'

const testDataPath = join(__dirname, '../../test/data')
// @ts-ignore
global.testDataPath = testDataPath
// @ts-ignore
global.nvim = nvim

const server = createServer((req, res) => {
  if (req.url === '/test/vscode') VscodeTestRunner(testDataPath)
  if (req.url === '/playground') Playground()

  res.writeHead(200)
  res.end()
})

server.listen(22444, () =>
  console.log(`ext-host-dev server ${server.address()}`)
)
