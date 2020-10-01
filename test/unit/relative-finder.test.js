const { src, same } = require('../util')
const { findNext, findPrevious } = src('support/relative-finder')

const getA = () => [
  {
    path: '/main/a.ts',
    range: {
      start: { line: 4, character: 7 },
      end: { line: 4, character: 9 },
    },
  },
  {
    path: '/main/a.ts',
    range: {
      start: { line: 1, character: 1 },
      end: { line: 1, character: 5 },
    },
  },
  {
    path: '/main/a.ts',
    range: {
      start: { line: 9, character: 2 },
      end: { line: 9, character: 4 },
    },
  },
]

const getC = () => [
  {
    path: '/main/c.ts',
    range: {
      start: { line: 3, character: 1 },
      end: { line: 3, character: 9 },
    },
  },
  {
    path: '/main/c.ts',
    range: {
      start: { line: 1, character: 7 },
      end: { line: 1, character: 9 },
    },
  },
]

const getItems = () => [...getA(), ...getC()]

describe('relative finder', () => {
  it('find next', () => {
    const next = findNext(getItems(), '/main/a.ts', 2, 1)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 4, character: 7 },
        end: { line: 4, character: 9 },
      },
    })
  })

  it('find next file (and first item) when none in current', () => {
    const next = findNext(getC(), '/main/a.ts', 9, 2)

    same(next, {
      path: '/main/c.ts',
      range: {
        start: { line: 1, character: 7 },
        end: { line: 1, character: 9 },
      },
    })
  })

  it('when last loopback to first', () => {
    const next = findNext(getItems(), '/main/a.ts', 9, 2)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 1, character: 1 },
        end: { line: 1, character: 5 },
      },
    })
  })

  it('find previous', () => {
    const next = findPrevious(getItems(), '/main/a.ts', 2, 1)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 1, character: 1 },
        end: { line: 1, character: 5 },
      },
    })
  })

  it('find prev file (and last item) when none is current', () => {
    const next = findPrevious(getA(), '/main/c.ts', 1, 7)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 9, character: 2 },
        end: { line: 9, character: 4 },
      },
    })
  })

  it('when first loopback to last', () => {
    const next = findPrevious(getItems(), '/main/a.ts', 1, 1)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 9, character: 2 },
        end: { line: 9, character: 4 },
      },
    })
  })

  it('find previous when in middle of current item', () => {
    const next = findPrevious(getItems(), '/main/a.ts', 4, 8)

    same(next, {
      path: '/main/a.ts',
      range: {
        start: { line: 1, character: 1 },
        end: { line: 1, character: 5 },
      },
    })
  })
})
