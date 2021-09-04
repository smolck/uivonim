import Loading from './loading'
import { paddingVH, cvar } from '../ui/css'
import { FormEvent } from 'inferno'
import Icon from './icon'

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
  loadingColor: string
  pathMode: boolean
}

interface TextInputProps extends Partial<Props> {
  loadingSize: number
  id: string
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

// TODO(smolck): But why though? Has to be another way to get access to
// `onComponentDidMount` with normal stuff like <input>
const WhyInput = (props: any) => <input {...props} />

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
    id,
    change,
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
        icon={icon}
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
        id={id}
        style={{ color, 'font-size': small ? '1rem' : '1.4rem' }}
        type='text'
        spellcheck='false'
        placeholder={desc}
        // Would use the `value` prop instead of setting the value of the input
        // in the handlers below, but that breaks dead keys.
        onComponentDidUpdate={(_lastProps: any, _nextProps: any) => {
          const e = document.getElementById(id)! as HTMLInputElement
          // TODO(smolck): This assumes that the `change` function re-renders,
          // which is more convention with all the components that use this
          // rather than a requirement.
          if (!change && e) e.value = value

          setFocus(e, focus)
          setPosition(e, position)
        }}
        onComponentDidMount={(e: HTMLInputElement) => {
          e.value = value

          setFocus(e, focus)
          setPosition(e, position)
        }}
        onInput={(e: FormEvent<HTMLInputElement>) => {
          setFocus(e.currentTarget, focus)
          setPosition(e.currentTarget, position)
        }}
        onKeyDown={(e: KeyboardEvent) => {
          ;(document.getElementById(id)! as HTMLInputElement).value = value

          const { ctrlKey: ctrl, metaKey: meta, key } = e
          const cm = ctrl || meta

          if (key === 'Tab') {
            e.preventDefault()
            return $.tab()
          }
          if (key === 'Dead') return

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
          if (nextVal !== value) {
            $.change(nextVal)
          }
        }}
      />
    </div>

    {loading && <Loading color={loadingColor} size={loadingSize} />}
  </div>
)

export default (props: TextInputProps) => textInput(props, nopMaybe(props))
