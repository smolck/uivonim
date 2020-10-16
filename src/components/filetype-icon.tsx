import { basename, extname } from 'path'
// TODO(smolck): import * as Icons from 'hyperapp-seti'
import Icon from './icon'

const customMappings = new Map<string, string>([
  ['readme.md', 'info'],
  ['gif', 'image'],
  ['jpg', 'image'],
  ['jpeg', 'image'],
  ['png', 'image'],
  ['svg', 'image'],
])

const feather = require('feather-icons')
const findIconCustom = (filename: string, extension: string) => {
  const mapping = customMappings.get(extension) || customMappings.get(filename)
  return mapping && <Icon iconHtml={feather.icons[mapping].toSvg()} />
}

const getIcon = (path = '') => {
  const filename = basename(path).toLowerCase()
  const extension = extname(filename).replace(/^\./, '').toLowerCase()

  return (
    findIconCustom(filename, extension) ||
    <Icon iconHtml={feather.icons['file-text'].toSvg()}/>
  )
}

const featherStyle: CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  'align-items': 'center',
  'margin-right': '8px',
  'margin-left': '3px',
  'font-size': '1.1rem',
}

export const Folder = (
  <div style={featherStyle}>
    <Icon iconHtml={feather.icons['folder'].toSvg()} />
  </div>
)

export const Terminal = (
  <div style={featherStyle}>
    <Icon iconHtml={feather.icons['terminal'].toSvg()} />
  </div>
)

export default (fileTypeOrPath: string) => (
  <div
    style={{
      display: 'flex',
      color: '#ccc',
      'justify-content': 'center',
      'align-items': 'center',
      'margin-right': '6px',
      'margin-top': '2px',
      'font-size': '1.5rem',
    }}
  >
    {getIcon(fileTypeOrPath)}
  </div>
)
