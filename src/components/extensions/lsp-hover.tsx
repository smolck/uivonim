import Overlay from '../overlay'
import { docStyle } from '../../ui/styles'
import { parse as stringToMarkdown, setOptions } from 'marked'
import WindowManager from '../../windows/window-manager'

setOptions({
  highlight: (code, lang, _) => {
    const hljs = require('highlight.js/lib/core')
    hljs.registerLanguage(lang, require(`highlight.js/lib/languages/${lang}`))

    const highlightedCode = hljs.highlight(code, { language: lang }).value
    return highlightedCode
  },
})

// TODO(smolck): Should sanitize this HTML probably because safety.
const docs = (data: string) => (
  <div
    style={docStyle as CSSProperties}
    dangerouslySetInnerHTML={{ __html: `<div>${stringToMarkdown(data)}` }}
  />
)

type Props = {
  visible: boolean
  doc: string
  maxWidth: number
  workspaceWidth: number
  windowManager: WindowManager
  x: number
  y: number
}

export default (props: Props) => {
  return (
    <Overlay
      id={'hover'}
      visible={props.visible}
      x={props.x}
      y={props.y}
      anchorAbove={false}
      maxWidth={Math.max(0, Math.min(props.maxWidth, props.workspaceWidth))}
    >
      {props.doc && docs(props.doc)}
    </Overlay>
  )
}