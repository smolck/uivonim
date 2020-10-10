import { cvar, paddingVH, paddingH } from '../ui/css'
import { colors } from '../ui/styles'
import { h } from '../ui/uikit'

const row = {
  'align-items': 'center',
  'padding-top': '4px',
  'padding-bottom': '4px',
  'padding-left': '12px',
  'padding-right': '12px',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  display: 'flex',
  color: cvar('foreground-30'),
  'min-height': '1.4rem',
  'font-size': '1.1rem',
}

const activeRow = {
  ...row,
  'font-weight': 'bold',
  color: cvar('foreground-b20'),
  background: cvar('background-10'),
}

interface Options {
  key?: any
  active: boolean
  [key: string]: any
  children: any
}

const removePropsIntendedForThisComponent = (stuff: Options) => {
  const { active, ...rest } = stuff
  return rest
}

export const RowNormal = (props: Options) => (
  <div
    {...removePropsIntendedForThisComponent(props)}
    style={{
      ...row,
      ...(props.active ? activeRow : undefined),
      ...props.style,
    }}
  >
    {props.children}
  </div>
)

export const RowDesc = (o: Options, children: any[]) =>
  h(
    'div',
    {
      ...removePropsIntendedForThisComponent(o),
      style: {
        ...(o.active ? activeRow : row),
        whiteSpace: 'normal',
        overflow: 'normal',
        ...o.style,
      },
    },
    children
  )

export const RowComplete = (o: Options, children: any[]) =>
  h(
    'div',
    {
      ...removePropsIntendedForThisComponent(o),
      style: {
        ...(o.active ? activeRow : row),
        ...paddingVH(0, 0),
        paddingRight: '8px',
        lineHeight: cvar('line-height'),
        fontFamily: 'var(--font)',
        fontSize: 'var(--font-size)px',
        ...o.style,
      },
    },
    children
  )

export const RowHeader = (o: Options, children: any[]) =>
  h(
    'div',
    {
      ...removePropsIntendedForThisComponent(o),
      style: {
        ...(o.active ? activeRow : row),
        ...paddingH(6),
        alignItems: 'center',
        color: colors.hint,
        background: cvar('background-20'),
        ...(o.active
          ? {
              color: '#fff',
              fontWeight: 'normal',
              background: cvar('background-b10'),
            }
          : 0),
        ...o.style,
      },
    },
    children
  )

export const RowImportant = (opts = {} as any, children: any[]) =>
  h(
    'div',
    {
      ...removePropsIntendedForThisComponent(opts),
      style: {
        ...opts.style,
        ...row,
        ...paddingH(8),
        color: cvar('important'),
        background: cvar('background-50'),
      },
    },
    children
  )
