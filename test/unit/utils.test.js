const { src, same } = require('../util')
const m = src('support/utils')

const nix = process.platform === 'linux' || process.platform === 'darwin'

if (nix) {
  describe('path parts', () => {
    it('root path', () => {
      const testpath = '/Users/a/veonim'
      const res = m.pathParts(testpath)
      same(res, ['/', 'Users', 'a', 'veonim'])
    })

    it('relative dot path', () => {
      const testpath = './Users/a/veonim/'
      const res = m.pathParts(testpath)
      same(res, ['Users', 'a', 'veonim'])
    })

    it('relative path', () => {
      const testpath = 'a/veonim/'
      const res = m.pathParts(testpath)
      same(res, ['a', 'veonim'])
    })

    it('path segments', () => {
      const testpath = '/Users/a/../'
      const res = m.pathParts(testpath)
      same(res, ['/', 'Users'])
    })
  })
}

describe('thread safe object', () => {
  it('convert getters to plain values', () => {
    class Position {
      constructor(line, column) {
        this._line = line
        this._column = column
      }

      get line() {
        return this._line
      }
      get column() {
        return this._column
      }
    }

    class Range {
      constructor(sline, scol, eline, ecol) {
        this._start = new Position(sline, scol)
        this._end = new Position(eline, ecol)
      }

      get start() {
        return this._start
      }
      get end() {
        return this._end
      }
    }

    const input = new Range(1, 2, 3, 4)
    const output = m.threadSafeObject(input)

    const start = {
      line: 1,
      _line: 1,
      column: 2,
      _column: 2,
    }

    const end = {
      line: 3,
      _line: 3,
      column: 4,
      _column: 4,
    }

    same(output, {
      start,
      end,
      _start: start,
      _end: end,
    })
  })

  it('convert getters inside arrays', () => {
    class Galaxy {
      constructor() {
        this._distance = 'far-far-away'
      }
      get distance() {
        return this._distance
      }
    }

    const input = {
      empire: 'strikes-back',
      galaxies: ['return-of-the-jedi', new Galaxy()],
    }

    const output = m.threadSafeObject(input)

    same(output, {
      empire: 'strikes-back',
      galaxies: [
        'return-of-the-jedi',
        { distance: 'far-far-away', _distance: 'far-far-away' },
      ],
    })
  })

  it('convert an array that contains getter objects', () => {
    class Galaxy {
      constructor() {
        this._distance = 'far-far-away'
      }
      get distance() {
        return this._distance
      }
    }

    const input = [new Galaxy(), new Galaxy()]
    const output = m.threadSafeObject(input)

    same(output, [
      { _distance: 'far-far-away', distance: 'far-far-away' },
      { _distance: 'far-far-away', distance: 'far-far-away' },
    ])
  })
})

describe('promise boss', () => {
  it('resolves no cancel', async () => {
    const boss = m.PromiseBoss()
    const calls = []
    const cancel = () => calls.push('cancel')
    const promise = new Promise((fin) => setTimeout(() => fin('TACOS'), 2))
    const res = await boss.schedule({ cancel, promise }, { timeout: 10 })

    same(calls.length, 0, 'cancel calls count')
    same(res, 'TACOS')
  })

  it('cancels because of timeout', (done) => {
    const boss = m.PromiseBoss()
    const calls = []
    const cancel = () => {
      calls.push('cancel')
      same(calls, ['cancel'], 'cancel calls')
      done()
    }
    const promise = new Promise((fin) => setTimeout(() => fin('TACOS'), 10))
    boss
      .schedule({ cancel, promise }, { timeout: 2 })
      .then(() => calls.push('res'))
  })

  it('cancels previous & resolves current because a new request', (done) => {
    const boss = m.PromiseBoss()
    const calls = []
    const cancel = () => calls.push('cancel')
    const promise1 = new Promise((fin) =>
      setTimeout(() => fin('BURRITOS'), 100)
    )

    const huh = () => {
      same(calls, ['cancel', 'TACOS'], 'cancel calls')
      done()
    }

    boss
      .schedule({ cancel, promise: promise1 }, { timeout: 50 })
      .then((res) => {
        calls.push(res)
        huh()
      })

    const promise2 = new Promise((fin) => setTimeout(() => fin('TACOS'), 2))
    boss
      .schedule({ cancel, promise: promise2 }, { timeout: 50 })
      .then((res) => {
        calls.push(res)
        huh()
      })
  })

  it('cancels promise via external control', (done) => {
    const boss = m.PromiseBoss()
    const calls = []
    const cancel = () => calls.push('cancel')
    const promise = new Promise((fin) => setTimeout(() => fin('AYYLMAO'), 100))

    const huh = () => {
      same(calls, ['cancel'], 'cancel calls')
      done()
    }

    boss.schedule({ cancel, promise }, { timeout: 50 }).then((res) => {
      calls.push(res)
      huh()
    })

    setTimeout(() => {
      boss.cancelCurrentPromise()
      setImmediate(huh)
    }, 10)
  })
})
