import {
  hsvToRGB,
  rgbToHex,
  rgbToHSL,
  rgbToHSV,
  hexToRGB,
  hslToRGB,
} from '../ui/css'
import { minmax, throttle, merge } from '../support/utils'
import { h, app, css } from '../ui/uikit'
import Checkboard from '../ui/checkboard'

enum ColorMode {
  hex,
  rgb,
  hsl,
}

export default () => {
  let onChangeFn = (_: string) => {}

  const state = {
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

  const actions = {
    up: (m: object) => (s: S) => {
      const next = { ...s, ...m }
      const [red, green, blue] = hsvToRGB(next.hue, next.saturation, next.value)
      merge(next, { red, green, blue })
      reportChange(next)
      return { ...m, red, green, blue }
    },
  }

  type S = typeof state
  type A = typeof actions

  const styles = {
    overlay: {
      height: '100%',
      width: '100%',
      position: 'absolute',
    },
    checkboard: {
      position: 'absolute',
      background: `url(${Checkboard('#242424', '#3a3a3a', 5)}) center left`,
    },
    preview: {
      width: '40px',
      height: '40px',
    },
    slider: {
      height: '12px',
      width: '100%',
      borderRadius: '2px',
    },
    sliderHandle: {
      position: 'absolute',
      height: '16px',
      width: '16px',
      background: 'var(--background-b5)',
      borderRadius: '50%',
      boxShadow: '1px 1px 0.3px rgba(0, 0, 0, 0.2)',
    },
    arrow: {
      color: 'rgba(255, 255, 255, 0.3)',
      fontSize: '0.5rem',
    },
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
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
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

  const hueSlider = ($: S, a: A) =>
    h(
      'div',
      {
        style: {
          ...styles.slider,
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        },
        onupdate: (e: HTMLElement) => {
          stats.hueSliderWidthMultiplier = 360 / e.clientWidth
        },
        oncreate: (e: HTMLElement) => {
          updateOnMove(e, (ev) => a.up({ hue: calc.hue(ev, e) }))
        },
      },
      [
        ,
        h('div', {
          style: {
            ...styles.sliderHandle,
            transform: `translate(${
              $.hue / stats.hueSliderWidthMultiplier - 8
            }px, -2px)`,
          },
        }),
      ]
    )

  const alphaSlider = ($: S, a: A) =>
    h(
      'div',
      {
        style: {
          ...styles.slider,
          position: 'relative',
        },
      },
      [
        ,
        h('div', {
          style: {
            ...styles.slider,
            ...styles.checkboard,
          },
        }),

        h(
          'div',
          {
            style: {
              ...styles.slider,
              position: 'absolute',
              background: `linear-gradient(to right, rgba(${$.red}, ${$.green}, ${$.blue}, 0), rgb(${$.red}, ${$.green}, ${$.blue}))`,
            },
            onupdate: (e: HTMLElement) => {
              stats.alphaSliderWidth = e.clientWidth
            },
            oncreate: (e: HTMLElement) => {
              updateOnMove(e, (ev) => a.up({ alpha: calc.alpha(ev, e) }))
            },
          },
          [
            ,
            h('div', {
              style: {
                ...styles.sliderHandle,
                transform: `translate(${
                  $.alpha * stats.alphaSliderWidth - 8
                }px, -2px)`,
              },
            }),
          ]
        ),
      ]
    )

  const view = ($: S, a: A) =>
    h(
      'div',
      {
        style: {
          borderRadius: '2px',
          boxShadow: '0 0 2px rgba(0, 0, 0, .3), 0 4px 8px rgba(0, 0, 0, .3)',
          boxSizing: 'initial',
          width: '250px',
        },
      },
      [
        ,
        h(
          'div',
          {
            style: {
              height: '125px',
              display: 'flex',
              overflow: 'hidden',
            },
          },
          [
            ,
            h(
              'div',
              {
                style: {
                  position: 'relative',
                  flex: 1,
                },
                oncreate: (e: HTMLElement) =>
                  updateOnMove(e, (ev) => {
                    const { saturation, value } = calc.saturation(ev, e)
                    a.up({ saturation, value })
                  }),
              },
              [
                ,
                h('div', {
                  style: {
                    ...styles.overlay,
                    background: `hsl(${$.hue}, 100%, 50%)`,
                  },
                }),

                h('div', {
                  style: {
                    ...styles.overlay,
                    background:
                      'linear-gradient(to right, #fff, rgba(255, 255, 255, 0))',
                  },
                }),

                h('div', {
                  style: {
                    ...styles.overlay,
                    background:
                      'linear-gradient(to top, #000, rgba(0, 0, 0, 0))',
                  },
                }),

                h(
                  'div',
                  {
                    style: {
                      position: 'absolute',
                      top: `${-$.value + 100}%`,
                      left: `${$.saturation}%`,
                      cursor: 'default',
                    },
                  },
                  [
                    ,
                    h('div', {
                      style: {
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        transform: 'translate(-6px, -6px)',
                        boxShadow: 'rgb(255, 255, 255) 0px 0px 0px 1px inset',
                      },
                    }),
                  ]
                ),
              ]
            ),
          ]
        ),

        h(
          'div',
          {
            style: {
              background: 'var(--background-10)',
              display: 'flex',
              padding: '15px',
            },
          },
          [
            ,
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  flex: 1,
                },
              },
              [
                ,
                h(
                  'div',
                  {
                    style: {
                      ...styles.preview,
                      position: 'relative',
                    },
                  },
                  [
                    ,
                    h('div', {
                      style: {
                        ...styles.preview,
                        borderRadius: '50%',
                        ...styles.checkboard,
                      },
                    }),

                    h('div', {
                      style: {
                        ...styles.preview,
                        borderRadius: '50%',
                        position: 'absolute',
                        background: `rgba(${$.red}, ${$.green}, ${$.blue}, ${$.alpha})`,
                      },
                    }),
                  ]
                ),

                h(
                  'div',
                  {
                    style: {
                      flex: 1,
                      display: 'flex',
                      marginLeft: '10px',
                      flexFlow: 'column',
                      justifyContent: 'space-between',
                    },
                  },
                  [, hueSlider($, a), alphaSlider($, a)]
                ),
              ]
            ),
          ]
        ),

        h(
          'div',
          {
            style: {
              background: 'var(--background-10)',
              display: 'flex',
              padding: '15px',
              paddingTop: '10px',
              justifyContent: 'space-around',
            },
          },
          [
            ,
            h(
              `button.${styles.modeButton}`,
              {
                style: $.mode === ColorMode.hex && styles.modeActive,
                onclick: () => a.up({ mode: ColorMode.hex }),
              },
              'HEX'
            ),

            h(
              `button.${styles.modeButton}`,
              {
                style: $.mode === ColorMode.rgb && styles.modeActive,
                onclick: () => a.up({ mode: ColorMode.rgb }),
              },
              'RGB'
            ),

            h(
              `button.${styles.modeButton}`,
              {
                style: $.mode === ColorMode.hsl && styles.modeActive,
                onclick: () => a.up({ mode: ColorMode.hsl }),
              },
              'HSL'
            ),
          ]
        ),
      ]
    )

  const element = document.createElement('div')
  const ui = app({ name: 'dank-memes', state, actions, view, element })

  const onChange = (fn: (color: string) => void) => (onChangeFn = fn)

  const setRGB = (red: number, green: number, blue: number, alpha?: number) => {
    const [hue, saturation, value] = rgbToHSV(red, green, blue)
    ui.up({
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
    ui.up({ mode: ColorMode.hex, hue, saturation, value, red, green, blue })
  }

  const setHSL = (
    hue: number,
    saturation: number,
    lightness: number,
    alpha?: number
  ) => {
    const [red, green, blue] = hslToRGB(hue, saturation, lightness)
    const [h, s, value] = rgbToHSV(red, green, blue)
    ui.up({
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
