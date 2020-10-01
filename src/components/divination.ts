import { cursor, hideCursor, showCursor } from '../core/cursor'
import * as windows from '../windows/window-manager'
import { genList } from '../support/utils'
import { stealInput } from '../core/input'
import api from '../core/instance-api'
import { makel } from '../ui/vanilla'
import { paddingV } from '../ui/css'

// hand crafted for maximum ergonomic comfort
const labels = {
  single: [
    'A',
    'S',
    'D',
    'F',
    'J',
    'K',
    'L',
    'G',
    'H',
    'W',
    'E',
    'R',
    'I',
    'O',
    'Q',
    'T',
    'U',
    'P',
    'N',
    'M',
    'V',
    'B',
    'C',
  ],
  double: [
    'AJ',
    'AK',
    'AL',
    'AH',
    'AN',
    'AI',
    'AO',
    'AU',
    'AP',
    'AM',
    'AS',
    'AD',
    'AF',
    'AG',
    'AE',
    'AR',
    'AW',
    'AT',
    'AV',
    'SJ',
    'SK',
    'SL',
    'SH',
    'SN',
    'SI',
    'SO',
    'SU',
    'SP',
    'SM',
    'SA',
    'SD',
    'SF',
    'SG',
    'SE',
    'SR',
    'DJ',
    'DK',
    'DL',
    'DH',
    'DN',
    'DI',
    'DO',
    'DU',
    'DP',
    'DM',
    'DA',
    'DS',
    'DF',
    'DG',
    'DW',
    'DQ',
    'DE',
    'DV',
    'FJ',
    'FK',
    'FL',
    'FH',
    'FN',
    'FI',
    'FO',
    'FU',
    'FP',
    'FM',
    'FA',
    'FS',
    'FD',
    'FE',
    'FW',
    'FQ',
    'EJ',
    'EK',
    'EL',
    'EH',
    'EN',
    'EI',
    'EO',
    'EU',
    'EP',
    'EM',
    'EF',
    'EG',
    'ER',
    'ET',
    'EW',
    'EQ',
    'EA',
    'ES',
    'EV',
    'RJ',
    'RK',
    'RL',
    'RH',
    'RN',
    'RI',
    'RO',
    'RU',
    'RP',
    'RM',
    'RA',
    'RS',
    'RE',
    'RW',
    'RQ',
    'RG',
    'WJ',
    'WK',
    'WL',
    'WH',
    'WN',
    'WI',
    'WO',
    'WU',
    'WP',
    'WM',
    'WA',
    'WD',
    'WF',
    'WE',
    'WR',
    'WT',
    'WG',
    'WV',
    'QJ',
    'QK',
    'QL',
    'QH',
    'QN',
    'QI',
    'QO',
    'QU',
    'QP',
    'QM',
    'QD',
    'QF',
    'QW',
    'QE',
    'QR',
    'QT',
    'QG',
    'GJ',
    'GK',
    'GL',
    'GH',
    'GN',
    'GI',
    'GO',
    'GU',
    'GP',
    'GM',
    'GD',
    'GS',
    'GA',
    'GE',
    'GW',
    'GQ',
    'JA',
    'JS',
    'JD',
    'JF',
    'JG',
    'JE',
    'JR',
    'JW',
    'JQ',
    'JK',
    'JL',
    'JI',
    'JO',
    'JP',
    'JV',
    'KA',
    'KS',
    'KD',
    'KF',
    'KG',
    'KE',
    'KR',
    'KW',
    'KQ',
    'KJ',
    'KL',
    'KN',
    'KO',
    'KP',
    'KV',
    'LA',
    'LS',
    'LD',
    'LF',
    'LG',
    'LE',
    'LR',
    'LW',
    'LQ',
    'LJ',
    'LK',
    'LN',
    'LI',
    'LU',
    'LV',
    'HA',
    'HS',
    'HD',
    'HF',
    'HG',
    'HE',
    'HR',
    'HW',
    'HQ',
    'HJ',
    'HL',
    'HI',
    'HO',
    'HP',
    'HV',
    'NA',
    'NS',
    'ND',
    'NF',
    'NG',
    'NE',
    'NR',
    'NW',
    'NQ',
    'NK',
    'NL',
    'NI',
    'NO',
    'NP',
    'NV',
    'IA',
    'IS',
    'ID',
    'IF',
    'IG',
    'IE',
    'IR',
    'IW',
    'IQ',
    'IJ',
    'IL',
    'IN',
    'IH',
    'IO',
    'IP',
    'IV',
    'OA',
    'OS',
    'OD',
    'OF',
    'OG',
    'OE',
    'OR',
    'OW',
    'OQ',
    'OJ',
    'OK',
    'OH',
    'OI',
    'ON',
    'OP',
    'OV',
    'PA',
    'PS',
    'PD',
    'PF',
    'PG',
    'PE',
    'PR',
    'PW',
    'PQ',
    'PJ',
    'PK',
    'PH',
    'PI',
    'PN',
    'PO',
    'PV',
    'MA',
    'MS',
    'MD',
    'MF',
    'MG',
    'ME',
    'MR',
    'MW',
    'MQ',
    'MK',
    'ML',
    'MI',
    'MO',
    'MP',
    'MV',
    'VJ',
    'VK',
    'VL',
    'VH',
    'VN',
    'VI',
    'VO',
    'VP',
    'VU',
    'VM',
    'VA',
    'VS',
    'VD',
    'VE',
    'VR',
    'VW',
    'VQ',
    'UA',
    'US',
    'UD',
    'UF',
    'UG',
    'UE',
    'UR',
    'UW',
    'UQ',
    'UH',
    'UL',
    'UI',
    'UP',
    'UN',
    'UV',
    'TJ',
    'TK',
    'TL',
    'TH',
    'TN',
    'TI',
    'TO',
    'TP',
    'TU',
    'TM',
    'TA',
    'TE',
    'TW',
    'TQ',
    'TR',
  ],
}

const singleLabelLimit = labels.single.length

const getLabels = (itemCount: number) => {
  const doubleSize = itemCount > singleLabelLimit
  return {
    labelSize: doubleSize ? 2 : 1,
    getLabel: (index: number) =>
      doubleSize ? labels.double[index] : labels.single[index],
    // TODO: would it be faster to use a map? only lookup instead of find
    indexOfLabel: (label: string) =>
      doubleSize ? labels.double.indexOf(label) : labels.single.indexOf(label),
  }
}

const labelHTML = (label: string) =>
  label
    .split('')
    // using margin-right instead of letter-spacing because letter-spacing adds space
    // to the right of the last letter - so it ends up with more padding on the right :/
    .map(
      (char, ix) =>
        `<span${!ix ? ' style="margin-right: 2px"' : ''}>${char}</span>`
    )
    .join('')

const divinationLine = async ({ visual }: { visual: boolean }) => {
  if (visual) api.nvim.feedkeys('gv', 'n')
  else api.nvim.feedkeys('m`', 'n')

  const win = windows.getActive()
  const positions = genList(win.rows, (row) =>
    win.editor.positionToEditorPixels(row, 0)
  )
  const labelContainer = makel({ position: 'absolute' })
  const { labelSize, getLabel, indexOfLabel } = getLabels(positions.length)

  const labels = positions.map(({ y }, ix) => {
    const el = makel({
      ...paddingV(4),
      position: 'absolute',
      fontSize: '1.1rem',
      top: `${y}px`,
      background: '#000',
      marginTop: '-1px',
      color: '#eee',
    })

    el.innerHTML = labelHTML(getLabel(ix))
    return el
  })

  labels
    .filter((_, ix) => ix !== cursor.row)
    .forEach((label) => labelContainer.appendChild(label))

  const overlay = win.addOverlayElement(labelContainer)

  const updateLabels = (matchChar: string) =>
    labels
      .filter(
        (m) =>
          (m.children[0] as HTMLElement).innerText.toLowerCase() === matchChar
      )
      .forEach((m) =>
        Object.assign((m.children[0] as HTMLElement).style, {
          // TODO: inherit from colorscheme
          color: '#ff007c',
        })
      )

  const grabbedKeys: string[] = []

  const reset = () => {
    restoreInput()
    overlay.remove()
  }

  const jump = () => {
    const jumpLabel = grabbedKeys.join('').toUpperCase()
    const targetRow = indexOfLabel(jumpLabel)
    if (targetRow === -1) return reset()

    const jumpDistance = targetRow - cursor.row
    const jumpMotion = jumpDistance > 0 ? 'j' : 'k'
    const cursorAdjustment = visual ? (jumpDistance > 0 ? 'g$' : '') : 'g^'

    const command = `${Math.abs(jumpDistance)}g${jumpMotion}${cursorAdjustment}`
    api.nvim.feedkeys(command, 'n')
    reset()
  }

  const restoreInput = stealInput((key) => {
    if (key === '<Esc>') return reset()

    grabbedKeys.push(key)
    if (labelSize === 1 && grabbedKeys.length === 1) return jump()
    if (labelSize === 2 && grabbedKeys.length === 1) return updateLabels(key)
    if (labelSize === 2 && grabbedKeys.length === 2) return jump()
    else reset()
  })
}

const findPositions = (
  win: ReturnType<typeof windows.getActive>,
  highlight: string
) => {
  const cells = win.editor.findHighlightCells(highlight)
  return cells.reduce((res, cell, ix) => {
    const last = cells[ix - 1]
    if (!last) return res.push(cell), res

    const colDiff = Math.abs(cell.col - last.col)
    if (colDiff !== 1) res.push(cell)

    return res
  }, [] as typeof cells)
}

export const divinationSearch = async () => {
  const win = windows.getActive()
  const positions = findPositions(win, 'Search')
  if (!positions.length) return

  const pixelPositions = positions.map((p) => ({
    ...p,
    ...win.editor.positionToEditorPixels(p.row, p.col),
  }))

  const { labelSize, getLabel } = getLabels(pixelPositions.length)
  const labelContainer = makel({ position: 'absolute' })
  const jumpTargets = new Map()

  const labels = pixelPositions.map((pos, ix) => {
    const el = makel({
      ...paddingV(4),
      position: 'absolute',
      fontSize: '1.3rem',
      top: `${pos.y}px`,
      left: `${pos.x}px`,
      background: '#000',
      marginTop: '-4px',
      color: '#eee',
    })

    const label = getLabel(ix)
    jumpTargets.set(label, pos)
    el.innerHTML = labelHTML(label)
    return el
  })

  labels.forEach((label) => labelContainer.appendChild(label))

  const overlay = win.addOverlayElement(labelContainer)

  const updateLabels = (matchChar: string) =>
    labels
      .filter(
        (m) =>
          (m.children[0] as HTMLElement).innerText.toLowerCase() === matchChar
      )
      .forEach((m) =>
        Object.assign((m.children[0] as HTMLElement).style, {
          // TODO: inherit from colorscheme
          color: '#ff007c',
        })
      )

  hideCursor()
  const grabbedKeys: string[] = []

  const reset = () => {
    restoreInput()
    overlay.remove()
    showCursor()
  }

  const jump = async () => {
    const jumpLabel = grabbedKeys.join('').toUpperCase()
    if (!jumpTargets.has(jumpLabel)) return reset()

    const { row, col } = jumpTargets.get(jumpLabel)
    const jumpDistance = row - cursor.row
    const jumpMotion = jumpDistance > 0 ? 'j' : 'k'
    const command = `m\`${Math.abs(jumpDistance)}g${jumpMotion}${col + 1}|`

    api.nvim.feedkeys(command, 'n')
    reset()
  }

  const restoreInput = stealInput((keys) => {
    if (keys === '<Esc>') return reset()

    grabbedKeys.push(keys)
    if (labelSize === 1 && grabbedKeys.length === 1) return jump()
    if (labelSize === 2 && grabbedKeys.length === 1) return updateLabels(keys)
    if (labelSize === 2 && grabbedKeys.length === 2) return jump()
    else reset()
  })
}

api.onAction('jump-search', divinationSearch)
api.onAction('jump-line', () => divinationLine({ visual: false }))
api.onAction('jump-line-visual', () => divinationLine({ visual: true }))
