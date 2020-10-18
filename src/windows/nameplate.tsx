import { size } from '../core/workspace'
import { uuid } from '../support/utils'
import { makel } from '../ui/vanilla'
import { cvar } from '../ui/css'
import Icon from '../components/icon'
import { render } from 'inferno'

export interface NameplateState {
  name?: string
  dir?: string
  active?: boolean
  modified?: boolean
  terminal?: boolean
  termAttached?: boolean
  termFormat?: string
}

type S = NameplateState

export default () => {
  const element = makel({
    display: 'flex',
    overflow: 'hidden',
    height: `${size.nameplateHeight}px`,
    minHeight: `${size.nameplateHeight}px`,
  })

  let state: NameplateState = {
    name: '',
    dir: '',
    active: false,
    modified: false,
    terminal: false,
    termAttached: false,
    termFormat: '',
  }

  const feather = require('feather-icons')
  const Nameplate = ($: S) => (
    <div
      id={`nameplate-${uuid()}`}
      style={{
        display: 'flex',
        background: cvar('background'),
        'padding-left': '10px',
        'padding-right': '10px',
        'align-items': 'center',
        'max-width': 'calc(100% - 20px)',
      }}
    >
      {$.terminal && (
        <Icon
          iconHtml={feather.icons['terminal'].toSvg()}
          style={{
            color: cvar('foreground-30'),
            display: 'flex',
            'font-size': '1.2rem',
            'margin-right': '8px',
            'align-items': 'center',
          }}
        />
      )}

      <div
        style={{
          overflow: 'hidden',
          // TODO: need to contrast, not brighten
          filter: `brightness(${$.active ? 130 : 90}%)`,
          'white-space': 'nowrap',
          'text-overflow': 'ellipsis',
        }}
      >
        {$.dir && (
          <span style={{ color: cvar('foreground-30'), 'margin-right': '1px' }}>
            {$.dir}/
          </span>
        )}
        <span style={{ color: cvar('foreground-50') }}>
          {$.name || '[No Name]'}
        </span>
      </div>

      {$.modified && (
        <div
          style={{
            width: '0.5rem',
            height: '0.5rem',
            background: cvar('foreground-50'),
            'margin-top': '2px',
            'margin-left': '8px',
            'border-radius': '50%',
          }}
        />
      )}

      {$.termAttached && (
        <Icon
          iconHtml={feather.icons['eye'].toSvg()}
          style={{
            color: cvar('foreground-40'),
            'margin-left': '15px',
            'margin-right': '4px',
            'align-items': 'center',
          }}
        />
      )}

      {$.termAttached && (
        <div style={{ color: cvar('foreground-50'), 'font-size': '0.8rem' }}>
          {$.termFormat}
        </div>
      )}
    </div>
  )

  const update = (data: S) => (
    Object.assign(state, data), render(<Nameplate {...state} />, element)
  )

  return { element, update }
}
