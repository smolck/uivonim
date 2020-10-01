const { src, same, globalProxy } = require('../util')
const { EventEmitter } = require('events')
const childProcess = require('child_process')

describe.skip('markdown to HTML with syntax highlighting', () => {
  const watchers = new EventEmitter()

  const request = (method, ...data) =>
    new Promise((done) => {
      const reqId = Date.now()
      global.onmessage({ data: [method, data, reqId] })
      watchers.once(reqId, done)
    })

  let undoGlobalProxy
  let nvimProc

  before(() => {
    global.onmessage = () => {}
    global.postMessage = ([ev, args, id]) => watchers.emit(id, args)

    undoGlobalProxy = globalProxy('child_process', {
      ...childProcess,
      spawn: (...args) => {
        const proc = childProcess.spawn(...args)
        if (args[0].includes('nvim')) nvimProc = proc
        return proc
      },
    })

    src('workers/neovim-colorizer')
  })

  after(() => {
    nvimProc.kill('SIGKILL')
    undoGlobalProxy()
    delete global.onmessage
    delete global.postMessage
  })

  it('happy path', async () => {
    const markdown = [
      '# STAR WARS',
      '## ESB',
      '*italic* **bold** `code`',
      '```javascript',
      'const generalKenobi = "hello there!"',
      'console.log(generalKenobi)',
      '```',
    ].join('\n')

    const res = await request('colorizeMarkdownToHTML', markdown)

    // TODO: we are currently not getting colors back from nvim
    // this could be because:
    // - colorscheme is not loaded (checked $runtime but it seems correct)
    // - no syntax files for filetype
    // - wrong filetype
    const expected = [
      '<h1 id="star-wars">STAR WARS</h1>',
      '<h2 id="esb">ESB</h2>',
      '<p><em>italic</em> <strong>bold</strong> <code>code</code></p>',
      '<pre><code class="language-javascript"><span style="color: red">const generalKenobi = "hello there!"</span><span>console.log(generalKenobi)</span></code></pre>',
      '',
    ].join('\n')

    same(res, expected)
  })
})
