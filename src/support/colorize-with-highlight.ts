import { ColorData } from '../services/colorizer'

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

interface ColorizedFilterResult extends FilterResult {
  colorizedLine: ColorData[]
}

const recolor = (
  colors: ColorData[],
  start: number,
  end: number,
  color: string
) =>
  colors.reduce((res, m, ix) => {
    const prev: ColorData = res[res.length - 1]
    const needsRecolor = ix >= start && ix <= end
    const colorOfInterest = needsRecolor ? color : m.color
    const reusePreviousGroup = prev && prev.color === colorOfInterest

    reusePreviousGroup
      ? (prev.text += m.text)
      : res.push({ color: colorOfInterest, text: m.text })

    return res
  }, [] as ColorData[])

const markAsHighlight = (colors: ColorData[], start: number, end: number) =>
  colors.reduce((res, m, ix) => {
    const prev: ColorData = res[res.length - 1]
    const charIsHighlighted = ix >= start && ix <= end
    const reusePreviousGroup =
      prev && prev.color === m.color && prev.highlight === charIsHighlighted

    reusePreviousGroup
      ? (prev.text += m.text)
      : res.push({ color: m.color, text: m.text, highlight: charIsHighlighted })

    return res
  }, [] as ColorData[])

export default (data: ColorizedFilterResult, highlightColor?: string) =>
  highlightColor
    ? recolor(
        data.colorizedLine,
        data.start.column,
        data.end.column,
        highlightColor
      )
    : markAsHighlight(data.colorizedLine, data.start.column, data.end.column)
