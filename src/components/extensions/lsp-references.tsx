import { RowNormal, RowHeader } from '../row-container'
import { PluginRight } from '../plugin-container'
import { vimBlur, vimFocus } from '../../ui/uikit'
import { simplifyPath } from '../../utils'
// TODO(smolck): import { showCursorline } from '../../core/cursor'
import { badgeStyle } from '../../ui/styles'
import { Component } from 'inferno'
import Input from '../text-input'
import { invoke, listen, currentNvimState } from '../../helpers'
import Cursor from '../../cursor'

export type Reference = {
  lineNum: number
  column: number
  text: string
}

export type Refs = [string, Reference[]]

const SCROLL_AMOUNT = 0.25

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

// TODO(smolck): Is this really necessary just to get 'onComponentDidMount'?
const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

type Props = {
  cursor: Cursor
  visible: boolean
  references: Refs[]
}

export default class LspReferences extends Component<
  Props,
  {
    val: string
    cache: Refs[]
    ix: number
    subix: number
    loading: boolean
    elref?: HTMLElement
    references: Refs[]
    referencedSymbol: string
    visible: boolean
    els: Map<number, HTMLElement>
  }
> {
  constructor(props: Props) {
    super(props)

    this.state = {
      els: new Map(),
      visible: props.visible,
      references: props.references,
      referencedSymbol: '',
      elref: undefined,
      val: '',
      cache: [],
      ix: 0,
      subix: -1,
      loading: false,
    }
  }

  // scroll after next section has been rendered as expanded (a little hacky)
  private scrollIntoView(next: number) {
    const elref = this.state!.elref!
    setTimeout(() => {
      const { top: containerTop, bottom: containerBottom } =
        elref.getBoundingClientRect()
      const e = this.state!.els.get(next)
      if (!e) return

      const { top, height } = e.getBoundingClientRect()

      if (top + height > containerBottom) {
        const offset = top - containerBottom

        if (offset < containerTop) elref.scrollTop += top - containerTop
        else elref.scrollTop += offset + height + containerTop + 50
      } else if (top < containerTop) elref.scrollTop += top - containerTop
    }, 1)
  }

  private jumpToResult(subix: number) {
    if (subix < 0) return
    const [path, items] = this.state!.references[this.state!.ix]
    const { lineNum, column } = items[subix]

    invoke.nvimJumpTo({
      path,
      line: lineNum - 1,
      column: column - 1,
    })
    // TODO(smolck): showCursorline()
  }

  private scrollSubitemsIntoView(next: number) {
    setTimeout(() => {
      const { top: containerTop, bottom: containerBottom } =
        this.state!.elref!.getBoundingClientRect()
      const e = this.state!.els.get(this.state!.ix)?.children[1].children[next]
      if (!e) return

      const { top, height } = e.getBoundingClientRect()

      if (top + height > containerBottom) {
        const offset = top - containerBottom

        if (offset < containerTop) {
          this.state!.elref!.scrollTop += top - containerTop
        } else {
          this.state!.elref!.scrollTop += offset + height + containerTop + 50
        }
      } else if (top < containerTop) {
        this.state!.elref!.scrollTop += top - containerTop
      }
    })
  }

  private prev() {
    const state = this.state!
    const previous =
      state.subix - 1 < 0
        ? this.state!.references[state.ix][1].length - 1
        : state.subix - 1
    this.jumpToResult(previous)
    this.scrollSubitemsIntoView(previous)
    this.setState({ subix: previous })
  }

  private up() {
    const { height } = this.state!.elref!.getBoundingClientRect()
    this.state!.elref!.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
  }

  private down() {
    const { height } = this.state!.elref!.getBoundingClientRect()
    this.state!.elref!.scrollTop += Math.floor(height * SCROLL_AMOUNT)
  }

  private hide() {
    vimFocus(this.props.cursor)
    this.setState({ visible: false, references: [] })
  }

  private select() {
    vimFocus(this.props.cursor)
    if (!this.state!.references.length) {
      this.setState({ visible: false, references: [] })
    } else {
      this.jumpToResult(this.state!.subix)
      this.setState({ visible: false, references: [] })
    }
  }

  private change(val: string) {
    this.setState({
      val,
      references: val
        ? this.state!.cache.map((m) => [
            m[0],
            m[1].filter((x) => x.text.toLowerCase().includes(val)),
          ])
        : this.state!.cache,
    })
  }

  private nextGroup() {
    const state = this.state!
    const next = state.ix + 1 > state.references.length - 1 ? 0 : state.ix + 1
    this.scrollIntoView(next)

    this.setState({ subix: -1, ix: next })
  }

  private prevGroup() {
    const state = this.state!
    const next = state.ix - 1 < 0 ? state.references.length - 1 : state.ix - 1
    this.scrollIntoView(next)
    this.setState({ subix: -1, ix: next })
  }

  private next() {
    const state = this.state!
    const next =
      state.subix + 1 < state.references[state.ix][1].length
        ? state.subix + 1
        : 0
    this.jumpToResult(next)
    this.scrollSubitemsIntoView(next)

    this.setState({ subix: next })
  }

  render() {
    return (
      <PluginRight id={'references'} visible={this.state!.visible}>
        <Input
          id={'lsp-references-input'}
          up={() => this.up()}
          hide={() => this.hide()}
          next={() => this.next()}
          prev={() => this.prev()}
          prevGroup={() => this.prevGroup()}
          down={() => this.down()}
          select={() => this.select()}
          change={(val) => this.change(val)}
          nextGroup={() => this.nextGroup()}
          value={this.state!.val}
          focus={true}
          icon={'filter'}
          desc={'filter references'}
        />
        <WhyDiv
          onComponentDidMount={(e: HTMLElement) => this.setState({ elref: e })}
          style={{ 'max-height': '100%', overflow: 'hidden' }}
        >
          {this.state!.references.map(([path, items], pos) => (
            <WhyDiv
              key={path}
              onComponentDidMount={(e: HTMLElement) => {
                this.state!.els.set(pos, e)
                this.setState({}) // TODO(smolck)
              }}
            >
              <RowHeader active={pos === this.state!.ix}>
                <span>{simplifyPath(path, currentNvimState().cwd)}</span>
                <div style={{ ...badgeStyle, 'margin-left': '12px' }}>
                  <span>{items.length}</span>
                </div>
              </RowHeader>
              {pos === this.state!.ix && (
                <div>
                  {items.map((f, itemPos) => (
                    <RowNormal
                      active={
                        pos === this.state!.ix && itemPos === this.state!.subix
                      }
                    >
                      {highlightPattern(f.text, this.state!.referencedSymbol, {
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
  }
}
