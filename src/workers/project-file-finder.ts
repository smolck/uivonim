import { on, call } from '../messaging/worker-client'
import { NewlineSplitter } from '../support/utils'
import { filter as fuzzy } from 'fuzzaldrin-plus'
import { spawnBinary } from '../support/binaries'

const INTERVAL = 250
const AMOUNT = 10
const TIMEOUT = 15e3
const results = new Set<string>()
const cancelTokens = new Set<Function>()
let query = ''

const sendResults = ({ filter = true } = {}) => {
  if (!filter || !query) return call.results([...results].slice(0, AMOUNT))

  const queries = query.split(' ').filter((m) => m)
  // TODO: might be more performant to cache previous fuzzy results
  const items = queries.reduce((res, qry) => fuzzy(res, qry), [...results])

  call.results(items.slice(0, AMOUNT))
}

const getFilesWithRipgrep = (cwd: string) => {
  const timer = setInterval(sendResults, INTERVAL)
  const rg = spawnBinary('rg',
    ['--files', '--hidden', '--glob', '!node_modules', '--glob', '!.git'],
    { cwd }
  )
  let initialSent = false

  rg.stderr!.pipe(new NewlineSplitter()).on('data', console.error)

  rg.stdout!.pipe(new NewlineSplitter()).on('data', (path: string) => {
    const shouldSendInitialBatch = !initialSent && results.size >= AMOUNT
    results.add(path)

    if (shouldSendInitialBatch) {
      sendResults({ filter: false })
      initialSent = true
    }
  })

  rg.on('close', () => {
    clearInterval(timer)
    sendResults({ filter: initialSent })
    call.done()
  })

  const reset = () => results.clear()
  const stop = () => {
    rg.kill()
    clearInterval(timer)
  }

  setImmediate(() => sendResults({ filter: false }))
  setTimeout(stop, TIMEOUT)
  return () => (stop(), reset())
}

on.load((cwd: string) => {
  results.clear()
  query = ''

  const stopRipgrepSearch = getFilesWithRipgrep(cwd)
  cancelTokens.add(stopRipgrepSearch)
})

on.stop(() => {
  query = ''
  cancelTokens.forEach((cancel) => cancel())
  cancelTokens.clear()
})

on.query((data: string) => {
  query = data
  sendResults()
})
