import { Position } from '../neovim/types'

interface AppendPatch {
  lines: string[]
  column: number
  text: string
}

interface ReplacePatch {
  lines: string[]
  start: Position
  end: Position
  text: string
}

interface DeletePatch {
  lines: string[]
  start: Position
  end: Position
}

export const positionToOffset = (
  lines: string[],
  position: Position
): number => {
  let offset = 0
  const totalol = lines.length
  for (let ix = 0; ix < totalol; ix++) {
    const line = lines[ix]
    if (position.line === ix) return position.character + offset
    offset += line.length
  }
  return offset
}

export const append = ({ lines, column, text }: AppendPatch): string[] => {
  const joinedLines = lines.join('\n')
  const start = joinedLines.slice(0, column)
  const end = joinedLines.slice(column)
  const next = start + text + end
  return next.split('\n')
}

export const replace = ({
  lines,
  start,
  end,
  text,
}: ReplacePatch): string[] => {
  const startIx = positionToOffset(lines, start)
  const endIx = positionToOffset(lines, end)
  const joinedLines = lines.join('\n')
  const startText = joinedLines.slice(0, startIx)
  const endText = joinedLines.slice(endIx)
  const next = startText + text + endText
  return next.split('\n')
}

export const remove = ({ lines, start, end }: DeletePatch): string[] => {
  const startIx = positionToOffset(lines, start)
  const endIx = positionToOffset(lines, end)
  const joinedLines = lines.join('\n')
  const startText = joinedLines.slice(0, startIx)
  const endText = joinedLines.slice(endIx)
  const next = startText + endText
  return next.split('\n')
}
