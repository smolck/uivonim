import { Range } from '../neovim/types'

interface Distance<T> {
  reference: T
  lines: number
  characters: number
}

export interface LocationItem {
  path: string
  range: Range
}

const distanceAsc = <T>(a: Distance<T>, b: Distance<T>) =>
  a.lines === b.lines ? a.characters < b.characters : a.lines < b.lines

const distanceDesc = <T>(a: Distance<T>, b: Distance<T>) =>
  a.lines === b.lines ? a.characters > b.characters : a.lines > b.lines

const locationItemAsDistance = (line: number, column: number) => <
  T extends LocationItem
>(
  item: T
) =>
  ({
    reference: item,
    lines: item.range.start.line - line,
    characters: item.range.start.character - column,
  } as Distance<T>)

const findNextItem = <T extends LocationItem>(
  items: T[],
  line: number,
  column: number
) => {
  const distances = items.map(locationItemAsDistance(line, column))
  const sortedDistances = distances.sort((a, b) => (distanceDesc(a, b) ? 1 : 0))
  return sortedDistances.find((m) =>
    m.lines === 0 ? m.characters > 0 : m.lines > 0
  )
}

const findPreviousItem = <T extends LocationItem>(
  items: T[],
  line: number,
  column: number
) => {
  const distances = items.map(locationItemAsDistance(line, column))
  const sortedDistances = distances.sort((a, b) => (distanceAsc(a, b) ? 1 : 0))
  return sortedDistances.find((m) =>
    m.lines === 0 ? m.characters < 0 : m.lines < 0
  )
}

const itemContainsPosition = <T extends LocationItem>(
  item: T,
  line: number,
  column: number
) => {
  if (item.range.start.line !== line) return false
  return (
    column >= item.range.start.character && column <= item.range.end.character
  )
}

// there is no guarantee that the item results will be grouped together by path
// could be -> a a b a b b a. we need to guarantee that the paths are in order so
// when we sort by lines/columns we are sorting them relative to the current file
const sortItems = <T extends LocationItem>(items: T[]) =>
  items
    .sort((a, b) => a.path.toLowerCase().localeCompare(b.path.toLowerCase()))
    .sort((a, b) =>
      a.range.start.line === b.range.start.line
        ? a.range.start.character - b.range.start.character
        : a.range.start.line - b.range.start.line
    )

const findInCurrent = <T extends LocationItem>(
  items: T[],
  line: number,
  column: number,
  findNext: boolean
) => {
  const sortedItems = sortItems(items)
  const foundItem = findNext
    ? findNextItem(sortedItems, line, column)
    : findPreviousItem(sortedItems, line, column)

  if (!foundItem)
    return findNext ? sortedItems[0] : sortedItems[sortedItems.length - 1]

  // this really only happens when trying to find items backwards
  // (because distances and jump locations always use the start range)
  if (itemContainsPosition(foundItem.reference, line, column)) {
    const possiblyAnother = findPreviousItem(
      sortedItems,
      line,
      foundItem.reference.range.start.character - 1
    )
    if (possiblyAnother) return possiblyAnother.reference
  }

  return foundItem.reference
}

const findInNextPath = <T extends LocationItem>(
  items: T[],
  findNext: boolean
) => {
  const sortedItems = sortItems(items)
  return findNext ? sortedItems[0] : sortedItems[sortedItems.length - 1]
}

const findClosest = <T extends LocationItem>(
  items: T[],
  currentPath: string,
  line: number,
  column: number,
  findNext: boolean
) => {
  if (!items.length) return

  const currentPathItems = items.filter((m) => m.path === currentPath)
  const nextPathItems = currentPathItems.length
    ? []
    : items.filter((m) => m.path === items[0].path)

  return currentPathItems.length
    ? findInCurrent(currentPathItems, line, column, findNext)
    : findInNextPath(nextPathItems, findNext)
}

export const findNext = <T extends LocationItem>(
  items: T[],
  currentPath: string,
  line: number,
  column: number
) => findClosest(items, currentPath, line, column, true)

export const findPrevious = <T extends LocationItem>(
  items: T[],
  currentPath: string,
  line: number,
  column: number
) => findClosest(items, currentPath, line, column, false)
