import Loading from '../components/loading'
import { paddingVH, cvar } from '../ui/css'
import { xfrmUp } from '../core/input'
import { FormEvent } from 'inferno'
import Icon from '../components/icon'

interface Props {
  value: string
  icon: string
  background: string
  color: string
  small: boolean
  desc: string
  focus: boolean
  position: number
  change: (val: string) => void
  select: (val: string) => void
  hide: () => void
  next: () => void
  prev: () => void
  nextGroup: () => void
  prevGroup: () => void
  down: () => void
  up: () => void
  top: () => void
  bottom: () => void
  jumpPrev: () => void
  jumpNext: () => void
  tab: () => void
  ctrlH: () => void
  ctrlG: () => void
  ctrlL: () => void
  ctrlC: () => void
  yank: () => void
  loading: boolean
  loadingSize: number
  loadingColor: string
  pathMode: boolean
}

interface TextInputProps extends Partial<Props> {
  value: string
  icon: string
}

const setPosition = (e?: HTMLInputElement, position?: number) => {
  if (!e || !position) return
  position > -1 && e.setSelectionRange(position, position)
}

const setFocus = (e: HTMLInputElement, shouldFocus: boolean) => {
  if (e && e !== document.activeElement && shouldFocus) e.focus()
  if (!shouldFocus) e && e.blur()
}

const nopMaybe = (obj: object) =>
  new Proxy(obj, {
    get: (_, key) => Reflect.get(obj, key) || (() => {}),
  }) as Props

const keToStr = (e: KeyboardEvent) =>
  [
    e.key,
    (e.ctrlKey as any) | 0,
    (e.metaKey as any) | 0,
    (e.altKey as any) | 0,
    (e.shiftKey as any) | 0,
  ].join('')

// TODO: could be better? it's global so will be shared between different
// inputs. however only one input will have focus at a time, so perhaps
// it's not a big deal
//
// the reason this has to live outside the function is because the view
// function will be triggered on re-render. pressing keys will potentially
// trigger re-renders, thus reseting the value of lastDown when inside
// the function.
let lastDown = ''

// TODO(smolck): But why though? Has to be another way to get access to
// `onComponentDidMount` with normal stuff like <input>
const WhyInput = (props: any) => (
  <input {...props} />
)

const textInput = (
  {
    desc,
    icon,
    color,
    background,
    loadingSize,
    loadingColor,
    value = '',
    position = -1,
    small = false,
    focus = false,
    loading = false,
    pathMode = false,
  }: TextInputProps,
  $: Props
) => (
  <div
    style={{
      background,
      ...paddingVH(12, small ? 5 : 10),
      display: 'flex',
      flex: 1,
      'align-items': 'center',
      'max-height': small ? '1.8rem' : '2.1rem',
      'min-height': small ? '1.8rem' : '2.1rem',
    }}
  >
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        'padding-right': '8px',
      }}
    >
      <Icon
        iconHtml={icon}
        style={{
          style: !small ? { fontSize: '1.7rem' } : undefined,
          color: cvar('foreground-70'),
        }}
      />
    </div>
    <div
      style={{
        flex: 1,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
      }}
    >
      <WhyInput
        value={value}
        style={{ color, 'font-size': small ? '1rem' : '1.4rem' }}
        type="text"
        spellcheck="false"
        placeholder={desc}
        // TODO(smolck): Use linkEvent() for things?
        //
        // TODO: hack to get hack to get dead keys working working
        onBlur={() => document.getElementById('hacky-textarea')?.focus()}
        onComponentDidMount={(e: HTMLInputElement) => {
          setFocus(e, focus)
          setPosition(e, position)
        }}
        // onComponentDidUpdate={(lastProps, newProps) => {
        //   setFocus(e, focus)
        //   setPosition(e, position)
        // }}
        onInput={(e: FormEvent<HTMLInputElement>) => {
          setFocus(e.currentTarget, focus)
          setPosition(e.currentTarget, position)
        }}
        onKeyUp={(e: KeyboardEvent) => {
          const prevKeyAndThisOne = lastDown + keToStr(e)

          if (xfrmUp.has(prevKeyAndThisOne)) {
            const { key } = xfrmUp.get(prevKeyAndThisOne)!(e)
            if (key.toLowerCase() === '<esc>') {
              lastDown = ''
              ;(e.target as HTMLInputElement).blur()
              return $.hide()
            }
          }
        }}
        onKeyDown={(e: KeyboardEvent) => {
          const { ctrlKey: ctrl, metaKey: meta, key } = e
          const cm = ctrl || meta

          lastDown = keToStr(e)

          if (key === 'Tab') {
            e.preventDefault()
            return $.tab()
          }

          if (key === 'Escape') return $.hide()
          if (key === 'Enter') return $.select(value)
          if (key === 'Backspace') return $.change(value.slice(0, -1))

          if (cm && key === 'w')
            return pathMode
              ? $.change(value.split('/').slice(0, -1).join('/'))
              : $.change(value.split(' ').slice(0, -1).join(' '))

          if (cm && key === 'g') return $.ctrlG()
          if (cm && key === 'h') return $.ctrlH()
          if (cm && key === 'l') return $.ctrlL()
          if (cm && key === 'c') return $.ctrlC()
          if (cm && key === 'j') return $.next()
          if (cm && key === 'k') return $.prev()
          if (cm && key === 'n') return $.nextGroup()
          if (cm && key === 'p') return $.prevGroup()
          if (cm && key === 'd') return $.down()
          if (cm && key === 'u') return $.up()
          if (cm && key === 'i') return $.jumpNext()
          if (cm && key === 'o') return $.jumpPrev()
          if (cm && key === 'y') return $.yank()
          if (cm && e.shiftKey && key === 'D') return $.bottom()
          if (cm && e.shiftKey && key === 'U') return $.top()

          const nextVal = value + (key.length > 1 ? '' : key)
          if (nextVal !== value) $.change(nextVal)
        }}
      />
    </div>
  </div>
)
// TODO: loading && Loading({color: loadingColor, size: loadingSize})

export default (props: TextInputProps) => textInput(props, nopMaybe(props))
