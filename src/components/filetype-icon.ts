import * as FeatherIcon from 'hyperapp-feather'
import { pascalCase } from '../support/utils'
import { basename, extname } from 'path'
import * as Icons from 'hyperapp-seti'
import { h } from '../ui/uikit'

const findIcon = (id: string) => id && Reflect.get(Icons, pascalCase(id))

const customMappings = new Map<string, string>([
  ['readme.md', 'info'],
  ['gif', 'image'],
  ['jpg', 'image'],
  ['jpeg', 'image'],
  ['png', 'image'],
  ['svg', 'image'],
])

const findIconCustom = (filename: string, extension: string) => {
  const mapping = customMappings.get(extension) || customMappings.get(filename)
  return mapping && findIcon(mapping)
}

const getIcon = (path = '') => {
  const filename = basename(path).toLowerCase()
  const extension = extname(filename).replace(/^\./, '').toLowerCase()

  return (
    findIconCustom(filename, extension) ||
    findIcon(extension) ||
    findIcon(filename) ||
    findIcon(path.toLowerCase()) ||
    Icons.Shell
  )
}

const featherStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: '8px',
  marginLeft: '3px',
  fontSize: '1.1rem',
}

export const Folder = h(
  'div',
  {
    style: featherStyle,
  },
  [, h(FeatherIcon.Folder)]
)

export const Terminal = h(
  'div',
  {
    style: featherStyle,
  },
  [, h(FeatherIcon.Terminal)]
)

export default (fileTypeOrPath: string) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '6px',
        marginTop: '2px',
        fontSize: '1.5rem',
        color: '#ccc',
      },
    },
    [, h(getIcon(fileTypeOrPath))]
  )
