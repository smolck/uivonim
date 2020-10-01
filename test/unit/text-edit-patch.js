const { src, same } = require('../util')
const { append, replace, remove } = src('neovim/text-edit-patch')
const { Position } = src('vscode/types')

describe('text edit patch', () => {
  it('append', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      column: 13,
      text: 'JEDI ',
    }

    const patch = append(req)
    same(patch, [
      'you were the JEDI chosen one',
      'you were supposed to destroy the sith',
      'not join them',
    ])
  })

  it('append with newlines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      column: 13,
      text: 'JEDI\nonly a sith\ndeals in absolutes\n',
    }

    const patch = append(req)
    same(patch, [
      'you were the JEDI',
      'only a sith',
      'deals in absolutes',
      'chosen one',
      'you were supposed to destroy the sith',
      'not join them',
    ])
  })

  it('replace', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: new Position(1, 5),
      end: new Position(1, 21),
      text: 'hello there',
    }

    const patch = replace(req)
    same(patch, [
      'you were the chosen one',
      'you hello there destroy the sith',
      'not join them',
    ])
  })

  it('replace across multiple lines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: new Position(1, 5),
      end: new Position(2, 5),
      text: 'general kenobi',
    }

    const patch = replace(req)
    same(patch, ['you were the chosen one', 'you general kenobi join them'])
  })

  it('replace with newlines', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: new Position(1, 5),
      end: new Position(2, 6),
      text: `did you ever hear\nthe tragedy of darth plagueis the wise\nit's not a story\nthe jedi would tell you\n`,
    }

    const patch = replace(req)
    same(patch, [
      'you were the chosen one',
      'you did you ever hear',
      'the tragedy of darth plagueis the wise',
      `it's not a story`,
      'the jedi would tell you',
      'join them',
    ])
  })

  it('remove', () => {
    const req = {
      lines: [
        'you were the chosen one',
        'you were supposed to destroy the sith',
        'not join them',
      ],
      start: new Position(1, 5),
      end: new Position(2, 2),
    }

    const patch = remove(req)
    same(patch, ['you were the chosen one', 'you not join them'])
  })
})
