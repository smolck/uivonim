import * as workspace from '../core/workspace'
import Icon from './icon'

interface LoaderParams {
  size?: number
  color?: string
}

// [, h(Loader, { size })]

const feather = require('feather-icons')
export default (
  { color, size = workspace.font.size + 2 } = {} as LoaderParams
) => (
  <div
    style={{
      color: color || 'rgba(255, 255, 255, 0.3)',
      animation: 'spin 2.5s linear infinite',
      height: `${size}px`,
      width: `${size}px`,
    }}
  >
    <Icon iconHtml={feather.icons['loader'].toSvg()} style={{ size }} />
  </div>
)
