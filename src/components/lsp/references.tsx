import { RowNormal, RowHeader } from '../core/row-container'
import { PluginRight } from '../core/plugin-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { simplifyPath } from '../../support/utils'
import { showCursorline } from '../../core/cursor'
import { badgeStyle } from '../../ui/styles'
import { render } from 'inferno'
import Input from '../core/text-input'
import api from '../../core/instance-api'

const container = document.getElementById('plugins')

type Reference = {
  lineNum: number
  column: number
  text: string
}

type Refs = [string, Reference[]]

let elref: HTMLElement
const SCROLL_AMOUNT = 0.25
const els = new Map<number, HTMLElement>()

let state = {
  val: '',
  referencedSymbol: '',
  references: [] as Refs[],
  cache: [] as Refs[],
  vis: false,
  ix: 0,
  subix: -1,
  loading: false,
}

type S = typeof state

// scroll after next section has been rendered as expanded (a little hacky)
const scrollIntoView = (next: number) =>
  setTimeout(() => {
    const {
      top: containerTop,
      bottom: containerBottom,
    } = elref.getBoundingClientRect()
    const e = els.get(next)
    if (!e) return

    const { top, height } = e.getBoundingClientRect()

    if (top + height > containerBottom) {
      const offset = top - containerBottom

      if (offset < containerTop) elref.scrollTop += top - containerTop
      else elref.scrollTop += offset + height + containerTop + 50
    } else if (top < containerTop) elref.scrollTop += top - containerTop
  }, 1)

const scrollSubitemsIntoView = (parentIx: number, next: number) =>
  setTimeout(() => {
    const {
      top: containerTop,
      bottom: containerBottom,
    } = elref.getBoundingClientRect()
    const e = els.get(parentIx)?.children[1].children[next]
    if (!e) return

    const { top, height } = e.getBoundingClientRect()

    if (top + height > containerBottom) {
      const offset = top - containerBottom

      if (offset < containerTop) elref.scrollTop += top - containerTop
      else elref.scrollTop += offset + height + containerTop + 50
    } else if (top < containerTop) elref.scrollTop += top - containerTop
  })

const selectResult = (references: Refs[], ix: number, subix: number) => {
  if (subix < 0) return
  const [path, items] = references[ix]
  const { lineNum, column } = items[subix]

  api.nvim.jumpTo({
    path,
    line: lineNum - 1,
    column: column - 1,
  })
  showCursorline()
}

const highlightPattern = (
  text: string,
  pattern: string,
  {
    normal,
    special,
  }: {
    normal: (text: any, last?: boolean) => any
    special: (text: any, last?: boolean) => any
  }
) => {
  const stext = special(pattern)
  return text
    .trimLeft()
    .split(pattern)
    .reduce((grp, part, ix, arr) => {
      if (!part && ix) return grp.push(stext), grp
      if (!part) return grp
      const last = ix === arr.length - 1
      ix ? grp.push(stext, normal(part, last)) : grp.push(normal(part, last))
      return grp
    }, [] as any[])
}

const resetState = { vis: false, references: [] }

const hide = () => {
  vimFocus()
  Object.assign(state, resetState)
  render(<References {...state} />, container)
}

const show = ({ references, referencedSymbol }: any) => {
  vimBlur()

  Object.assign(state, {
    references,
    referencedSymbol,
    cache: references,
    vis: true,
    val: '',
    ix: 0,
    subix: -1,
    loading: false,
  })

  render(<References {...state} />, container)
}

const select = () => {
  vimFocus()
  if (!state.references.length) Object.assign(state, resetState)
  selectResult(state.references, state.ix, state.subix)
  Object.assign(state, resetState)

  render(<References {...state} />, container)
}

const change = (val: string) => (
  Object.assign(state, {
    val,
    references: val
      ? state.cache.map((m) => [
          m[0],
          m[1].filter((x) => x.text.toLowerCase().includes(val)),
        ])
      : state.cache,
  }),
  render(<References {...state} />, container)
)

const nextGroup = () => {
  const next = state.ix + 1 > state.references.length - 1 ? 0 : state.ix + 1
  scrollIntoView(next)
  Object.assign(state, { subix: -1, ix: next })

  render(<References {...state} />, container)
}

const prevGroup = () => {
  const next = state.ix - 1 < 0 ? state.references.length - 1 : state.ix - 1
  scrollIntoView(next)
  Object.assign(state, { subix: -1, ix: next })

  render(<References {...state} />, container)
}

const next = () => {
  const next =
    state.subix + 1 < state.references[state.ix][1].length ? state.subix + 1 : 0
  selectResult(state.references, state.ix, next)
  scrollSubitemsIntoView(state.ix, next)
  Object.assign(state, { subix: next })

  render(<References {...state} />, container)
}

const prev = () => {
  const previous =
    state.subix - 1 < 0
      ? state.references[state.ix][1].length - 1
      : state.subix - 1
  selectResult(state.references, state.ix, previous)
  scrollSubitemsIntoView(state.ix, previous)
  Object.assign(state, { subix: previous })

  render(<References {...state} />, container)
}

const down = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
}

const up = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
}

// TODO(smolck): Is this really necessary just to get 'onComponentDidMount'?
const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const feather = require('feather-icons')
const References = ($: S) => (
  <PluginRight id={'references'} visible={$.vis}>
    <Input
      up={up}
      hide={hide}
      next={next}
      prev={prev}
      down={down}
      select={select}
      change={change}
      nextGroup={nextGroup}
      value={$.val}
      focus={true}
      icon={feather.icons.filter.toSvg()}
      desc={'filter references'}
    />
    <WhyDiv
      onComponentDidMount={(e: HTMLElement) => (elref = e)}
      style={{ 'max-height': '100%', overflow: 'hidden' }}
    >
      {$.references.map(([path, items], pos) => (
        <WhyDiv
          key={path}
          onComponentDidMount={(e: HTMLElement) => els.set(pos, e)}
        >
          <RowHeader active={pos === $.ix}>
            <span>{simplifyPath(path, api.nvim.state.cwd)}</span>
            <div style={{ ...badgeStyle, 'margin-left': '12px' }}>
              <span>{items.length}</span>
            </div>
          </RowHeader>
          {pos === $.ix && (
            <div>
              {items.map((f, itemPos) => (
                <RowNormal active={pos === $.ix && itemPos === $.subix}>
                  {highlightPattern(f.text, $.referencedSymbol, {
                    normal: (text, last) => (
                      <span
                        style={{
                          overflow: last ? 'inherit' : undefined,
                          'white-space': 'pre',
                          'text-overflow': last ? 'ellipsis' : undefined,
                        }}
                      >
                        {text}
                      </span>
                    ),

                    special: (text) => (
                      <span
                        style={{
                          color: '#aaa',
                          background: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        {text}
                      </span>
                    ),
                  })}
                </RowNormal>
              ))}
            </div>
          )}
        </WhyDiv>
      ))}
    </WhyDiv>
  </PluginRight>
)

api.onAction('references', (_, items) => {
  // TODO(smolck): Efficiency? This works but probably isn't the most
  // performant. Ideally could remove the intermediate map.
  //
  // This code essentially takes a series of code reference objects from Lua,
  // sorts them by filename (leveraging the map), and then turns that into
  // an array for use above.
  const itemsMap = items.reduce((map: Map<string, Reference[]>, x: any) => {
    const ref = {
      lineNum: x.lnum,
      column: x.col,
      text: x.text,
    } as Reference

    let maybeArr = map.get(x.filename)
    if (maybeArr) maybeArr.push(ref)
    else map.set(x.filename, [ref])

    return map
  }, new Map())

  let stuffToShow = [] as Refs[]
  itemsMap.forEach((value, key) => stuffToShow.push([key, value]))

  show({ references: stuffToShow })
})
