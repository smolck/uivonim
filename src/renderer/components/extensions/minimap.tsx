import { Events } from '../../../common/ipc'
import { asColor } from '../../../common/utils'
import { render } from 'inferno'
import { PluginRight } from '../plugin-container'
import { colors } from '../../render/highlight-attributes'

// Derived from https://stackoverflow.com/q/5560248
const lightenOrDarkenColor = (col: string, amt: number) => {
  var usePound = false
  if (col[0] == '#') {
    col = col.slice(1)
    usePound = true
  }

  var num = parseInt(col, 16)

  var r = (num >> 16) + amt

  if (r > 255) r = 255
  else if (r < 0) r = 0

  var b = ((num >> 8) & 0x00ff) + amt

  if (b > 255) b = 255
  else if (b < 0) b = 0

  var g = (num & 0x0000ff) + amt

  if (g > 255) g = 255
  else if (g < 0) g = 0

  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16)
}

const Minimap = ({ linesAndHighlights }: { linesAndHighlights: any }) => {
  const inViewportColor = lightenOrDarkenColor(colors.background, 20)
  const linesHtml = linesAndHighlights.map((line: any) => {
    const spansForLine: any[] = []

    let inViewport = line[0]
    line.slice(1).forEach((char: any) => {
      spansForLine.push(
        <span
          style={{
            color: char.hl ? asColor(char.hl.foreground) : undefined,
            background: char.inViewport ? '' : undefined,
          }}
        >
          {char.char}
        </span>
      )
    })

    return (
      <span
        style={{
          background: inViewport ? inViewportColor : undefined,
        }}
      >
        {spansForLine}
      </span>
    )
  })

  return (
    <PluginRight
      visible={true}
      setBackground={false}
      extraStyle={{ background: colors.background }}
      width={'150px'}
    >
      {linesHtml}
    </PluginRight>
  )
}

const container = document.createElement('div')
container.id = 'minimap'
document.getElementById('plugins')!.appendChild(container)

window.api.on(Events.minimap, (linesAndHighlights) =>
  render(<Minimap linesAndHighlights={linesAndHighlights} />, container)
)
