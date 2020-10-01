import * as storage from '../support/local-storage'
import messages, { MessageKind } from '../components/messages'
import { is } from '../support/utils'
import { makel } from '../ui/vanilla'
const finder = require('@medv/finder').default

interface RecordingEvent {
  kind: string
  when: number
  offsetStart: number
  offsetPrevious: number
  selector: string
  event: Event
}

const container = document.getElementById('workspace') as HTMLElement

const stopButton = makel('button', {
  position: 'absolute',
  fontWeight: 'bold',
  fontSize: '1.4rem',
  zIndex: 999,
  right: '4px',
  padding: '12px',
  outline: 'none',
  border: 'none',
  background: 'pink',
})

stopButton.innerText = 'STOP RECORDING'

const heyBigGuySunsGettingRealLow = () => stopButton.remove()

const monitorEvents = [
  'keydown',
  'keyup',
  'keypress',
  'input',
  'beforeinput',
  'change',
  'focus',
  'blur',
]

let recordedEvents = [] as RecordingEvent[]
let captureEvents = false
let lastRecordedAt = Date.now()
let recordingStartTime = Date.now()

export const record = () => {
  container.appendChild(stopButton)

  recordedEvents = []
  lastRecordedAt = Date.now()
  captureEvents = true
}

export const replay = () => {
  const events = storage.getItem<RecordingEvent[]>('veonim-dev-recording')
  if (!events || !events.length)
    return messages.vscode.show({
      message: 'recording does not exist',
      kind: MessageKind.Error,
    })
  recordPlayer(events)
}

export const recordingExists = () =>
  is.array(storage.getItem('veonim-dev-recording'))

const createEvent = (kind: string, event: Event) => {
  // InputEvent is still experimental - not widely supported but used in Chrome. No typings in TS lib
  if (kind.includes('input')) return new (window as any).InputEvent(kind, event)
  if (kind.includes('key')) return new KeyboardEvent(kind, event)
  else return new Event(kind, event)
}

const recordPlayer = async (events: RecordingEvent[]) => {
  const replays = events
    .map((m) => ({
      target: document.querySelector(m.selector),
      event: createEvent(m.kind, m.event),
      timeout: m.offsetStart,
    }))
    .filter((m) => m.target)

  const replayFinished = Promise.all(
    replays.map(
      (m) =>
        new Promise((done) =>
          setTimeout(() => {
            m.target!.dispatchEvent(m.event)
            done()
          }, m.timeout)
        )
    )
  )

  await replayFinished
  heyBigGuySunsGettingRealLow()
}

monitorEvents.forEach((ev) =>
  window.addEventListener(ev, (e) => {
    if (!captureEvents) return
    if (!recordedEvents.length) recordingStartTime = Date.now()

    recordedEvents.push({
      kind: e.type,
      when: Date.now(),
      offsetPrevious: Date.now() - lastRecordedAt,
      offsetStart: Date.now() - recordingStartTime,
      selector: finder(e.target as Element),
      event: evvy(e),
    })

    lastRecordedAt = Date.now()
  })
)

const props = [
  'altKey',
  'bubbles',
  'cancelBubble',
  'cancelable',
  'charCode',
  'code',
  'composed',
  'ctrlKey',
  'data',
  'dataTransfer',
  'defaultPrevented',
  'detail',
  'eventPhase',
  'inputType',
  'isComposing',
  'isTrusted',
  'key',
  'keyCode',
  'location',
  'metaKey',
  'repeat',
  'returnValue',
  'shiftKey',
  'type',
  'which',
]

const evvy = (eo: any) =>
  props.reduce(
    (res, prop) => Object.assign(res, { [prop]: eo[prop] }),
    {}
  ) as Event

stopButton.addEventListener('click', () => {
  heyBigGuySunsGettingRealLow()
  captureEvents = false
  storage.setItem('veonim-dev-recording', recordedEvents)
})
