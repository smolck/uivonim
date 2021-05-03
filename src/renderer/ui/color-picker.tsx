
import {
  hsvToRGB,
  rgbToHex,
  rgbToHSL,
  rgbToHSV,
  hexToRGB,
  hslToRGB,
} from '../ui/css'
import { minmax, throttle, merge } from '../../common/utils'
import { css } from '../ui/uikit'
import Checkboard from '../ui/checkboard'
import { render } from 'inferno'

enum ColorMode {
  hex,
  rgb,
  hsl,
}

export default () => {
  let onChangeFn = (_: string) => {}

  let state = {
    mode: ColorMode.hex,
    hue: 0,
    saturation: 0,
    value: 0,
    alpha: 1,
    red: 0,
    green: 0,
    blue: 0,
  }

  const reportChange = throttle((m: S) => {
    const useAlpha = m.alpha > 0 && m.alpha < 1

    if (m.mode === ColorMode.hex)
      return onChangeFn(rgbToHex(m.red, m.green, m.blue))

    if (m.mode === ColorMode.rgb)
      return useAlpha
        ? onChangeFn(`rgba(${m.red}, ${m.green}, ${m.blue}, ${m.alpha})`)
        : onChangeFn(`rgb(${m.red}, ${m.green}, ${m.blue})`)

    if (m.mode === ColorMode.hsl) {
      const [h, s, l] = rgbToHSL(m.red, m.green, m.blue)

      return useAlpha
        ? onChangeFn(`hsla(${h}, ${s}%, ${l}%, ${m.alpha})`)
        : onChangeFn(`hsl(${h}, ${s}%, ${l}%)`)
    }
  }, 50)

  type S = typeof state

  const styles = {
    overlay: {
      height: '100%',
      width: '100%',
      position: 'absolute',
    } as CSSProperties,
    checkboard: {
      position: 'absolute',
      background: `url(${Checkboard('#242424', '#3a3a3a', 5)}) center left`,
    } as CSSProperties,
    preview: {
      width: '40px',
      height: '40px',
    } as CSSProperties,
    slider: {
      height: '12px',
      width: '100%',
      'border-radius': '2px',
    } as CSSProperties,
    sliderHandle: {
      position: 'absolute',
      height: '16px',
      width: '16px',
      background: 'var(--background-b5)',
      'border-radius': '50%',
      'box-shadow': '1px 1px 0.3px rgba(0, 0, 0, 0.2)',
    } as CSSProperties,
    arrow: {
      color: 'rgba(255, 255, 255, 0.3)',
      'font-size': '0.5rem',
    } as CSSProperties,
    modeButton: css((id) => [
      `.${id} {
        outline: none;
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        padding: 5px;
        padding-left: 12px;
        padding-right: 12px;
        color: rgba(255, 255, 255, 0.2);
      }`,

      `.${id}:hover {
        border-color: rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 0.4);
      }`,
    ]),
    modeActive: {
      color: 'rgba(255, 255, 255, 0.8)',
      'border-color': 'rgba(255, 255, 255, 0.5)',
    } as CSSProperties,
  }

  const stats = {
    hueSliderWidthMultiplier: 2.11,
    alphaSliderWidth: 170,
  }

  const updateOnMove = (e: HTMLElement, updateFn: (e: MouseEvent) => void) => {
    const onMove = (m: MouseEvent) => updateFn(m)
    e.addEventListener(
      'mousedown',
      (ev) => (updateFn(ev), e.addEventListener('mousemove', onMove))
    )
    e.addEventListener('mouseup', () =>
      e.removeEventListener('mousemove', onMove)
    )
  }

  const getDimensions = (e: MouseEvent, container: HTMLElement) => ({
    left:
      e.pageX - (container.getBoundingClientRect().left + window.pageXOffset),
    width: container.clientWidth,
  })

  const calc = {
    hue: (e: MouseEvent, container: HTMLElement) => {
      const { left, width } = getDimensions(e, container)

      if (left < 0) return 0
      else if (left > width) return 359
      else return (360 * ((left * 100) / width)) / 100
    },
    alpha: (e: MouseEvent, container: HTMLElement) => {
      const { left, width } = getDimensions(e, container)

      if (left < 0) return 0
      else if (left > width) return 1
      else return Math.round((left * 100) / width) / 100
    },
    saturation: (e: MouseEvent, container: HTMLElement) => {
      const {
        width: containerWidth,
        height: containerHeight,
      } = container.getBoundingClientRect()
      let left =
        e.pageX - (container.getBoundingClientRect().left + window.pageXOffset)
      let top =
        e.pageY - (container.getBoundingClientRect().top + window.pageYOffset)

      if (left < 0) left = 0
      else if (left > containerWidth) left = containerWidth
      else if (top < 0) top = 0
      else if (top > containerHeight) top = containerHeight

      const saturation = (left * 100) / containerWidth
      const bright = -((top * 100) / containerHeight) + 100

      return {
        saturation: minmax(0, 100)(saturation),
        value: minmax(0, 100)(bright),
      }
    },
  }

  const WhyDiv = (props: any) => <div {...props}>{props.children}</div>

  let hueSliderEl: HTMLElement | undefined = undefined
  const HueSlider = ($: S) => (
    <WhyDiv
      style={{
        ...styles.slider,
        background:
          'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
      }}
      onComponentDidMount={(e: HTMLElement) => {
        hueSliderEl = e
        updateOnMove(e, (ev) => up({ hue: calc.hue(ev, e) }))
      }}
      onComponentDidUpdate={(_lastProps: any, _nextProps: any) => {
        stats.hueSliderWidthMultiplier = 360 / hueSliderEl!.clientWidth
      }}
    >
      <div
        style={
          {
            ...styles.sliderHandle,
            transform: `translate(${
              $.hue / stats.hueSliderWidthMultiplier - 8
            }px, -2px)`,
          } as CSSProperties
        }
      />
    </WhyDiv>
  )

  let alphaSliderEl: HTMLElement | undefined = undefined
  const AlphaSlider = ($: S) => (
    <div
      style={{
        ...styles.slider,
        position: 'relative',
      }}
    >
      <div style={{ ...styles.slider, ...styles.checkboard }} />
      <WhyDiv
        style={{
          ...styles.slider,
          position: 'absolute',
          background: `linear-gradient(to right, rgba(${$.red}, ${$.green}, ${$.blue}, 0), rgb(${$.red}, ${$.green}, ${$.blue}))`,
        }}
        onComponentDidUpdate={(_lastProps: any, _nextProps: any) => {
          stats.alphaSliderWidth = alphaSliderEl!.clientWidth
        }}
        onComponentDidMount={(e: HTMLElement) => {
          alphaSliderEl = e
          updateOnMove(e, (ev) => up({ alpha: calc.alpha(ev, e) }))
        }}
      >
        <div
          style={{
            ...styles.sliderHandle,
            transform: `translate(${
              $.alpha * stats.alphaSliderWidth - 8
            }px, -2px)`,
          }}
        />
      </WhyDiv>
    </div>
  )

  const ColorPicker = ($: S) => (
    <div
      style={{
        width: '250px',
        'border-radius': '2px',
        'box-shadow': '0 0 2px rgba(0, 0, 0, .3), 0 4px 8px rgba(0, 0, 0, .3)',
        'box-sizing': 'initial',
      }}
    >
      <div
        style={{
          height: '125px',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <WhyDiv
          style={{
            position: 'relative',
            flex: 1,
          }}
          onComponentDidMount={(e: HTMLElement) => {
            updateOnMove(e, (ev) => {
              const { saturation, value } = calc.saturation(ev, e)
              up({ saturation, value })
            })
          }}
        >
          <div
            style={{
              ...styles.overlay,
              background: `hsl(${$.hue}, 100%, 50%)`,
            }}
          />
          <div
            style={{
              ...styles.overlay,
              background:
                'linear-gradient(to right, #fff, rgba(255, 255, 255, 0))',
            }}
          />
          <div
            style={{
              ...styles.overlay,
              background: 'linear-gradient(to top, #000, rgba(0, 0, 0, 0))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: `${-$.value + 100}%`,
              left: `${$.saturation}%`,
              cursor: 'default',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                transform: 'translate(-6px, -6px)',
                'border-radius': '50%',
                'box-shadow': 'rgb(255, 255, 255) 0px 0px 0px 1px inset',
              }}
            />
          </div>
        </WhyDiv>
      </div>

      <div
        style={{
          background: 'var(--background-10)',
          display: 'flex',
          padding: '15px',
        }}
      >
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ ...styles.preview, position: 'relative' }}>
            <div
              style={{
                ...styles.preview,
                'border-radius': '50%',
                ...styles.checkboard,
              }}
            />
            <div
              style={{
                ...styles.preview,
                position: 'absolute',
                background: `rgba(${$.red}, ${$.green}, ${$.blue}, ${$.alpha})`,
                'border-radius': '50%',
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              'margin-left': '10px',
              'flex-flow': 'column',
              'justify-content': 'space-between',
            }}
          >
            <HueSlider {...$} />
            <AlphaSlider {...$} />
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--background-10)',
          display: 'flex',
          padding: '15px',
          'padding-top': '10px',
          'justify-content': 'space-around',
        }}
      >
        <button
          onClick={() => up({ mode: ColorMode.hex })}
          class={styles.modeButton}
          style={($.mode === ColorMode.hex && styles.modeActive) || undefined}
        >
          HEX
        </button>

        <button
          onClick={() => up({ mode: ColorMode.rgb })}
          class={styles.modeButton}
          style={($.mode === ColorMode.rgb && styles.modeActive) || undefined}
        >
          RGB
        </button>

        <button
          onClick={() => up({ mode: ColorMode.hsl })}
          class={styles.modeButton}
          style={($.mode === ColorMode.hsl && styles.modeActive) || undefined}
        >
          HSL
        </button>
      </div>
    </div>
  )

  const element = document.createElement('div')
  const assignStateAndRender = (newState: any) => (
    Object.assign(state, newState), render(<ColorPicker {...state} />, element)
  )

  const up = (m: object) => {
    const next = { ...state, ...m }
    const [red, green, blue] = hsvToRGB(next.hue, next.saturation, next.value)
    merge(next, { red, green, blue })
    reportChange(next)
    assignStateAndRender({ ...m, red, green, blue })
  }

  const onChange = (fn: (color: string) => void) => (onChangeFn = fn)

  const setRGB = (red: number, green: number, blue: number, alpha?: number) => {
    const [hue, saturation, value] = rgbToHSV(red, green, blue)
    up({
      mode: ColorMode.rgb,
      hue,
      saturation,
      value,
      red,
      green,
      blue,
      alpha,
    })
  }

  const setHex = (hex: string) => {
    const [red, green, blue] = hexToRGB(hex)
    const [hue, saturation, value] = rgbToHSV(red, green, blue)
    up({ mode: ColorMode.hex, hue, saturation, value, red, green, blue })
  }

  const setHSL = (
    hue: number,
    saturation: number,
    lightness: number,
    alpha?: number
  ) => {
    const [red, green, blue] = hslToRGB(hue, saturation, lightness)
    const [h, s, value] = rgbToHSV(red, green, blue)
    up({
      mode: ColorMode.hsl,
      hue: h,
      saturation: s,
      value,
      red,
      green,
      blue,
      alpha,
    })
  }

  return { setRGB, setHex, setHSL, element, onChange }
}
