import { cvar, /* paddingVH, */ paddingH } from '../ui/css'
import { colors } from '../ui/styles'

// TODO(smolck): Consolidate all of these Row* components into one?

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

interface RowProps {
  key?: any
  active: boolean
  [key: string]: any
  children?: any
}

const removePropsIntendedForThisComponent = (stuff: RowProps) => {
  const { active, ...rest } = stuff
  return rest
}

export const RowNormal = (props: RowProps) => (
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

export const RowDesc = (props: RowProps) => (
  <div
    {...removePropsIntendedForThisComponent(props)}
    style={{
      ...(props.active ? activeRow : row),
      'white-space': 'normal',
      overflow: 'normal',
      ...props.style,
    }}
  >
    {props.children}
  </div>
)

/*
export const RowComplete = (props: RowProps) => (
  <div
    {...removePropsIntendedForThisComponent(props)}
    style={{
      ...(props.active ? activeRow : row),
      ...paddingVH(0, 0),
      'padding-right': '8px',
      'line-height': cvar('line-height'),
      'font-family': 'var(--font)',
      'font-size': 'var(--font-size)px',
      ...props.style,
    }}
  >
    {props.children}
  </div>
)
*/

export const RowHeader = (props: RowProps) => (
  <div
    {...removePropsIntendedForThisComponent(props)}
    style={{
      ...(props.active ? activeRow : row),
      ...paddingH(6),
      color: colors.hint,
      background: cvar('background-20'),
      ...(props.active
        ? {
            color: '#fff',
            fontWeight: 'normal',
            background: cvar('background-b10'),
          }
        : 0),
      'align-items': 'center',
      ...props.style,
    }}
  >
    {props.children}
  </div>
)

export const RowImportant = (props: RowProps = {} as any) => (
  <div
    {...removePropsIntendedForThisComponent(props)}
    style={{
      ...props.style,
      ...row,
      ...paddingH(8),
      color: cvar('important'),
      background: cvar('background-50'),
    }}
  >
    {props.children}
  </div>
)
