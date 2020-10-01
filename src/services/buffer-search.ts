import { filter as fuzzyFilter, match } from 'fuzzaldrin-plus'
import nvim from '../neovim/api'

interface FilterResult {
  line: string
  start: {
    line: number
    column: number
  }
  end: {
    line: number
    column: number
  }
}

const buffers = new Map<string, string[]>()

const getLocations = (str: string, query: string, buffer: string[]) => {
  const line = buffer.indexOf(str)
  const locations = match(str, query)

  return {
    start: { line, column: locations[0] },
    end: { line, column: locations[locations.length - 1] },
  }
}

const asFilterResults = (
  results: string[],
  lines: string[],
  query: string
): FilterResult[] =>
  [...new Set(results)].map((m) => ({
    line: m,
    ...getLocations(m, query, lines),
  }))

export const fuzzy = async (
  file: string,
  query: string,
  maxResults = 20
): Promise<FilterResult[]> => {
  const bufferData = buffers.get(file) || []
  const results = fuzzyFilter(bufferData, query, { maxResults })
  return asFilterResults(results, bufferData, query)
}

export const fuzzyVisible = async (query: string): Promise<FilterResult[]> => {
  const { editorTopLine: start, editorBottomLine: end } = nvim.state
  const visibleLines = await nvim.current.buffer.getLines(start, end)
  const results = fuzzyFilter(visibleLines, query)
  return asFilterResults(results, visibleLines, query)
}
