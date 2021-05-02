import { createVNode } from 'inferno'
// TODO(smolck): Should this be used? Is it pointless now?
// type PluginFnNormal = (visible: boolean, children: any[]) => any
// type PluginFnWithStyles = (
//   visible: boolean,
//   styles: object,
//   children: any[]
// ) => any
// type PluginFn = PluginFnNormal & PluginFnWithStyles

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

type PluginProps = {
  visible: boolean
  extraStyle?: any
  children?: any
  id?: string
}

// TODO(smolck): Consolidate all of these.

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

export const PluginTop = ({
  visible,
  id,
  extraStyle,
  children,
}: PluginProps) => (
  <div id={id} style={top as CSSProperties}>
    <div
      style={{
        ...dialog,
        width: '400px',
        display: visible ? 'flex' : 'none',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  </div>
)

export const PluginBottom = ({
  visible,
  id,
  extraStyle,
  children,
}: PluginProps) => (
  <div id={id} style={bottom as CSSProperties}>
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--background-40)',
        display: visible ? 'flex' : 'none',
        'flex-flow': 'column',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  </div>
)

export const PluginRight = ({
  visible,
  id,
  extraStyle,
  children,
}: PluginProps) => (
  <div id={id} style={right as CSSProperties}>
    <div
      style={{
        ...dialog,
        width: '500px',
        height: '100%',
        background: 'var(--background-40)',
        display: visible ? 'flex' : 'none',
        'flex-flow': 'column',
        'margin-top': 0,
        ...extraStyle,
      }}
    >
      {children}
    </div>
  </div>
)
