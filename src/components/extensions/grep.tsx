import { RowNormal, RowHeader } from '../row-container'
import { PluginRight } from '../plugin-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { showCursorline } from '../../core/cursor'
import Input from '../text-input'
import { badgeStyle } from '../../ui/styles'
import { render } from 'inferno'
import Worker from '../../messaging/worker'
import api from '../../core/instance-api'

type Result = [string, SearchResult[]]

enum FocusedElement {
  Search,
  Filter,
}

interface SearchResult {
  line: number
  column: number
  text: string
}

let elref: HTMLElement
const SCROLL_AMOUNT = 0.25
const worker = Worker('search-files')
const els = new Map<number, HTMLElement>()

let state = {
  value: '',
  filterVal: '',
  cwd: '',
  results: [] as Result[],
  visible: false,
  ix: 0,
  subix: -1,
  loading: false,
  focused: FocusedElement.Search,
  mainSearchInputCallbacks: {},
  filterInputCallbacks: {},
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

const selectResult = (results: Result[], ix: number, subix: number) => {
  if (subix < 0) return
  const [path, items] = results[ix]
  const { line, column } = items[subix]
  api.nvim.jumpTo({ path, line, column })
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

const resetState = { visible: false, loading: false }

const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

const Grep = ({
  visible,
  filterVal,
  value,
  focused,
  loading,
  mainSearchInputCallbacks,
  filterInputCallbacks,
  subix,
  ix: index,
  results,
}: S) => (
  <PluginRight visible={visible}>
    <Input
      {...mainSearchInputCallbacks}
      id={'grep-main-search-input'}
      value={value}
      focus={focused === FocusedElement.Search}
      icon={'search'}
      desc={'find in project'}
      loading={loading}
    />
    <Input
      {...filterInputCallbacks}
      id={'grep-filter-input'}
      value={filterVal}
      focus={focused === FocusedElement.Filter}
      icon={'filter'}
      small={true}
      desc={'filter files'}
    />
    <WhyDiv
      onComponentDidMount={(e: HTMLElement) => (elref = e)}
      style={{
        'max-height': '100%',
        'overflow-y': 'hidden',
      }}
    >
      {results.map(([path, items], pos) => (
        <WhyDiv onComponentDidMount={(e: HTMLElement) => els.set(pos, e)}>
          <RowHeader active={pos === index}>
            <span>{path}</span>
            <div style={{ ...badgeStyle, 'margin-left': '12px' }}>
              <span>{items.length}</span>
            </div>
          </RowHeader>

          {pos === index && (
            <div>
              {items.map((f, itemPos: number) => (
                <RowNormal
                  active={pos === index && itemPos === subix}
                  style={{
                    'font-family': 'var(--font)',
                    'font-size': 'var(--font-size)px',
                  }}
                >
                  {highlightPattern(f.text, value, {
                    normal: (text, last) => (
                      <span
                        style={{
                          'white-space': 'pre',
                          'text-overflow': last ? 'ellipsis' : undefined,
                          overflow: last ? 'inherit' : undefined,
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

const container = document.createElement('div')
container.id = 'grep-container'
document.getElementById('plugins')!.appendChild(container)

const assignStateAndRender = (newState: any) => (
  Object.assign(state, newState), render(<Grep {...state} />, container)
)

const show = ({ cwd, value, reset = true }: any) =>
  reset
    ? (vimBlur(),
      assignStateAndRender({
        visible: true,
        cwd,
        value,
        ix: 0,
        subix: -1,
        results: [],
        loading: !!value,
      }))
    : (vimBlur(), assignStateAndRender({ visible: true }))

const results = (results: Result[]) => assignStateAndRender({ results })

const moreResults = (results: Result[]) => {
  const merged = [...state.results, ...results]
  const deduped = merged.filter(
    (m, ix, arr) => arr.findIndex((e) => e[0] === m[0]) === ix
  )
  assignStateAndRender({ results: deduped })
}

const loadingDone = ({ empty }: any) =>
  assignStateAndRender({
    loading: false,
    results: empty ? [] : state.results,
  })

const sharedCallbacks = {
  hide: () => (vimFocus(), assignStateAndRender(resetState)),
  select: () => {
    vimFocus()
    if (!state.results.length) {
      assignStateAndRender(resetState)
      return
    }
    selectResult(state.results, state.ix, state.subix)
    assignStateAndRender(resetState)
  },

  nextGroup: () => {
    const next = state.ix + 1 > state.results.length - 1 ? 0 : state.ix + 1
    scrollIntoView(next)
    assignStateAndRender({ subix: -1, ix: next })
  },

  prevGroup: () => {
    const next = state.ix - 1 < 0 ? state.results.length - 1 : state.ix - 1
    scrollIntoView(next)
    assignStateAndRender({ subix: -1, ix: next })
  },

  next: () => {
    const next =
      state.subix + 1 < state.results[state.ix][1].length ? state.subix + 1 : 0
    selectResult(state.results, state.ix, next)
    assignStateAndRender({ subix: next })
  },

  prev: () => {
    const prev =
      state.subix - 1 < 0
        ? state.results[state.ix][1].length - 1
        : state.subix - 1
    selectResult(state.results, state.ix, prev)
    assignStateAndRender({ subix: prev })
  },

  down: () => {
    const { height } = elref.getBoundingClientRect()
    const maxScroll = elref.scrollHeight - height
    // TODO: should wait until get results back before calling loadNext again...
    if (elref.scrollTop === maxScroll) return worker.call.loadNext()
    elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
  },

  up: () => {
    const { height } = elref.getBoundingClientRect()
    elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
  },
}

state.mainSearchInputCallbacks = {
  ...sharedCallbacks,
  focusFilter: () => assignStateAndRender({ focused: FocusedElement.Filter }),

  change: (value: string) => {
    value && worker.call.query({ query: value, cwd: state.cwd })
    assignStateAndRender(
      value
        ? {
            value,
            loading: true,
          }
        : {
            value,
            results: [],
            ix: 0,
            subix: 0,
            loading: false,
          }
    )
  },
}

state.filterInputCallbacks = {
  ...sharedCallbacks,
  focusSearch: () => assignStateAndRender({ focused: FocusedElement.Search }),
  changeFilter: (filterVal: string) => {
    worker.call.filter(filterVal)
    assignStateAndRender({ filterVal })
  },
}

worker.on.results((resList: Result[]) => results(resList))
worker.on.moreResults((results: Result[]) => moreResults(results))
worker.on.done(loadingDone)

api.onAction('grep-resume', () => show({ reset: false }))

api.onAction('grep', async (query: string) => {
  const { cwd } = api.nvim.state
  show({ cwd })
  query && worker.call.query({ query, cwd })
})

api.onAction('grep-word', async () => {
  const { cwd } = api.nvim.state
  const query = await api.nvim.call.expand('<cword>')
  show({ cwd, value: query })
  worker.call.query({ query, cwd })
})

// TODO: rename to grep-visual to be consistent with other actions
// operating from visual mode
api.onAction('grep-selection', async () => {
  // TODO(smolck): This was `await`ed
  api.nvim.feedkeys('gv"zy')

  const selection = await api.nvim.expr('@z')
  const [query] = selection.split('\n')
  const { cwd } = api.nvim.state
  show({ cwd, value: query })
  worker.call.query({ query, cwd })
})
