import { is } from '../support/utils'
import { h } from '../ui/uikit'

type PluginFnNormal = (visible: boolean, children: any[]) => any
type PluginFnWithStyles = (
  visible: boolean,
  styles: object,
  children: any[]
) => any
type PluginFn = PluginFnNormal & PluginFnWithStyles

const base = {
  'z-index': 99,
  'justify-content': 'center',
  display: 'flex',
  width: '100%',
  height: '100%',
}

const normal = { ...base, 'align-items': 'flex-start' }
const top = { ...base, 'align-items': 'flex-start' }
const bottom = { ...base, 'align-items': 'flex-end' }
const right = {
  ...base,
  'align-items': 'stretch',
  'justify-content': 'flex-end',
}

const dialog = {
  background: 'var(--background-30)',
  'margin-top': '15%',
  'flex-flow': 'column',
}

// export const Plugin = (visible: boolean, ...args: any[]) =>
//   h(
//     'div',
//     {
//       style: normal,
//     },
//     [
//       ,
//       h(
//         'div',
//         {
//           style: {
//             ...dialog,
//             width: '600px',
//             display: visible ? 'flex' : 'none',
//             ...args.find(is.object),
//           },
//         },
//         args.find(is.array)
//       ),
//     ]
//   )

type PluginProps = {
  visible: boolean
  extraStyle: any
  children: any
  id?: string
}

export const Plugin = ({ id, visible, extraStyle, children }: PluginProps) => (
  <div id={id} style={normal as CSSProperties}>
    <div
      style={{
        ...dialog,
        ...extraStyle,
        width: '600px',
        display: visible ? 'flex' : 'none',
      }}
    >
      {children}
    </div>
  </div>
)

export const PluginTop: PluginFn = (visible: boolean, ...args: any[]) =>
  h(
    'div',
    {
      style: top,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            ...dialog,
            width: '400px',
            display: visible ? 'flex' : 'none',
            ...args.find(is.object),
          },
        },
        args.find(is.array)
      ),
    ]
  )

export const PluginBottom: PluginFn = (visible: boolean, ...args: any[]) =>
  h(
    'div',
    {
      style: bottom,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            flexFlow: 'column',
            background: 'var(--background-40)',
            display: visible ? 'flex' : 'none',
            ...args.find(is.object),
          },
        },
        args.find(is.array)
      ),
    ]
  )

export const PluginRight = (visible: boolean, ...args: any[]) =>
  h(
    'div',
    {
      style: right,
    },
    [
      ,
      h(
        'div',
        {
          style: {
            ...dialog,
            width: '500px',
            height: '100%',
            flexFlow: 'column',
            marginTop: 0,
            background: 'var(--background-40)',
            display: visible ? 'flex' : 'none',
            ...args.find(is.object),
          },
        },
        args.find(is.array)
      ),
    ]
  )
