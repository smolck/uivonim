import { cvar, paddingVH, paddingH } from '../ui/css'
import { colors } from '../ui/styles'
import { h } from '../ui/uikit'

const row = {
  alignItems: 'center',
  paddingTop: '4px',
  paddingBottom: '4px',
  paddingLeft: '12px',
  paddingRight: '12px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'flex',
  color: cvar('foreground-30'),
  minHeight: '1.4rem',
  fontSize: '1.1rem',
}

const activeRow = {
  ...row,
  fontWeight: 'bold',
  color: cvar('foreground-b20'),
  background: cvar('background-10'),
}

interface Options {
  key?: any
  active: boolean
  [key: string]: any
}

const removePropsIntendedForThisComponent = (stuff: Options) => {
  const { active, ...rest } = stuff
  return rest
}

export const RowNormal = (o: Options, children: any[]) =>
  h(
    'div',
    {
      ...removePropsIntendedForThisComponent(o),
      style: {
        ...row,
        ...(o.active ? activeRow : undefined),
        ...o.style,
      },
    },
    children
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
