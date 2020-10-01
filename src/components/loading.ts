import * as workspace from '../core/workspace'
import { Loader } from 'hyperapp-feather'
import { h } from '../ui/uikit'

interface LoaderParams {
  size?: number
  color?: string
}

export default (
  { color, size = workspace.font.size + 2 } = {} as LoaderParams
) =>
  h(
    'div',
    {
      style: {
        color: color || 'rgba(255, 255, 255, 0.3)',
        animation: 'spin 2.5s linear infinite',
        height: `${size}px`,
        width: `${size}px`,
      },
    },
    [, h(Loader, { size })]
  )
