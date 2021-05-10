import { Events } from '../../../common/ipc'
import { asColor } from '../../../common/utils'
import { render } from 'inferno'
import { PluginRight } from '../plugin-container'

type Hl = {
  reverse?: boolean
  foreground?: string
  background?: string
  text: string
  blah: number
}
/// [row, highlights]
type Hls = [number, Hl[]][]

const Minimap = ({ linesAndHighlights }: { linesAndHighlights: any }) => {
  const linesHtml = linesAndHighlights.map((line: any) => {
    const spansForLine: any[] = []
    line.forEach((char: any) => {
      if (typeof char === 'string') {
        spansForLine.push(<span>{char}</span>)
      } else {
        spansForLine.push(
          <span style={{ color: asColor(char.hl.foreground) }}>
            {char.char}
          </span>
        )
      }
    })

    return <span>{spansForLine}</span>
  })

  return (
    <PluginRight
      visible={true}
      setBackground={false}
      extraStyle={{ background: 'black' }}
      width={'200px'}
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
