import { requireDir } from '../support/utils'
import nvim from '../neovim/api'
import { join } from 'path'

const testDataPath = join(__dirname, '../../test/data')

;(global as any).testDataPath = testDataPath
;(global as any).nvim = nvim

export default () => {
  console.log(
    '%c TESTING --> %cVSCODE API ',
    'color: #aaa; background: #000',
    'color: yellow; background: #000'
  )

  const results = { pass: 0, fail: 0 }
  const q: any[] = []

  const eq = (a: any, b: any) => {
    try {
      require('assert').deepStrictEqual(a, b)
      return true
    } catch (_) {
      return false
    }
  }

  ;(global as any).test = (name: string, func: Function) => {
    const assert = (result: any, expected: any, msg?: any) => {
      const ok = eq(result, expected)
      ok ? results.pass++ : results.fail++
      if (msg) return console.assert(ok, `${name} --> ${msg}`)
      console.assert(
        ok,
        `${name} --> expected ${JSON.stringify(
          result
        )} to equal ${JSON.stringify(expected)}`
      )
    }

    typeof func === 'function' && q.push(func(assert))
  }

  nvim.untilStateValue.cwd.is(testDataPath).then(async () => {
    console.time('VSCODE API TESTS')

    await requireDir(`${__dirname}/../../test/vscode`)
    await Promise.all(q)

    console.timeEnd('VSCODE API TESTS')
    console.log('VSCODE API test results ::', results)
  })

  setTimeout(() => nvim.cmd(`cd ${testDataPath}`), 150)
}
