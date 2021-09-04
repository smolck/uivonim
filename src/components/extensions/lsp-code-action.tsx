import { RowNormal } from '../row-container'
import { vimFocus } from '../../ui/uikit'
import Input from '../text-input'
import Overlay from '../overlay'
import { filter } from 'fuzzaldrin-plus'
import { Component } from 'inferno'
import { luaeval } from '../../helpers'
import Cursor from '../../cursor'

type CodeAction = {
  title: string
  kind?: string
  isPreferred?: boolean
  edit?: any
  command?: any
  arguments: any
}

type Props = {
  x: number
  y: number
  visible: boolean
  loadingFontSize: number
  actions: CodeAction[]
  cursor: Cursor
}

export default class LspCodeAction extends Component<
  Props,
  {
    visible: boolean
    inputValue: string
    index: number
    actions: CodeAction[]
  }
> {
  constructor(props: Props) {
    super(props)

    this.state = {
      index: 0,
      visible: this.props.visible,
      inputValue: '',
      actions: this.props.actions,
    }
  }

  private change(value: string) {
    this.setState({
      inputValue: value,
      index: 0,
      actions: this.state!.inputValue
        ? filter(this.props.actions, value, { key: 'title' })
        : this.state!.actions,
    })
  }

  private selectCurrent() {
    vimFocus(this.props.cursor)
    if (!this.state!.actions.length) {
      this.setState({
        inputValue: '',
        visible: false,
      })
      return
    }
    const action = this.state!.actions[this.state!.index]
    if (action) {
      // @ts-ignore <- without this get an error about luaeval not being a
      // property

      // roundtrip through vimscript since TS dict looks like a vimscript dict
      // TODO: see if action can be converted to a Lua table to allow direct call to lua
      luaeval("require'uivonim/lsp'.handle_chosen_code_action(_A)", action)
    }

    this.setState({
      inputValue: '',
      visible: false,
    })
  }

  private next() {
    this.setState({
      index:
        this.state!.index + 1 > this.state!.actions.length - 1
          ? 0
          : this.state!.index + 1,
    })
  }

  private prev() {
    this.setState({
      index:
        this.state!.index - 1 < 0
          ? this.state!.actions.length - 1
          : this.state!.index - 1,
    })
  }

  private hide() {
    vimFocus(this.props.cursor)
    this.setState({
      inputValue: '',
      visible: false,
    })
  }

  render() {
    return (
      <Overlay
        x={this.props.x}
        y={this.props.y}
        zIndex={100}
        maxWidth={600}
        visible={this.state!.visible}
        anchorAbove={false}
      >
        <div style={{ background: 'var(--background-40)' }}>
          <Input
            loadingSize={this.props.loadingFontSize}
            id={'code-action-input'}
            hide={() => this.hide()}
            next={() => this.next()}
            prev={() => this.prev()}
            change={(val) => this.change(val)}
            select={() => this.selectCurrent()}
            value={this.state!.inputValue}
            focus={true}
            small={true}
            icon={'code'}
            desc={'run code action'}
          />
          {this.state!.actions.map((s, ix) => (
            <RowNormal key={s.title} active={ix === this.state!.index}>
              <span>{s.title}</span>
            </RowNormal>
          ))}
        </div>
      </Overlay>
    )
  }
}
