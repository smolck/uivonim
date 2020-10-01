// SPEC: https://github.com/msgpack/msgpack/blob/master/spec.md

import { Transform } from 'stream'

const NOT_SUPPORTED = 'NOT_SUPPORTED'
const EMPTY_OBJECT = Object.create(null)
const EMPTY_ARR: any[] = []
const EMPTY_STR = ''
// msgpack encoded form of ---> [2, 'redraw'
const redrawEventKey = Buffer.from([
  0x93,
  0x02,
  0xa6,
  0x72,
  0x65,
  0x64,
  0x72,
  0x61,
  0x77,
])

export default class extends Transform {
  private skipStringAllocationBecauseMsgpackIsFuckingSlow: boolean
  private partialBuffer: Buffer
  private incomplete: boolean
  private ix: number

  constructor() {
    super({ objectMode: true })
    this.skipStringAllocationBecauseMsgpackIsFuckingSlow = false
    this.partialBuffer = Buffer.from([])
    this.incomplete = false
    this.ix = 0
  }

  parseExt(raw: Buffer, size: number) {
    const previx = this.ix
    const kind = raw[this.ix + 1] - 0x00
    const start = this.ix + 2
    const end = start + size
    this.ix = 0
    const id: any = this.superparse(raw.slice(start, end))
    this.ix = previx + 2 + size
    return { id, kind }
  }

  toArr(raw: Buffer, length: number): any[] {
    if (length === 0) return EMPTY_ARR
    const res = new Array(length)
    for (let it = 0; it < length; it++) res[it] = this.superparse(raw)
    return res
  }

  toStr(raw: Buffer, length: number) {
    this.ix += length
    if (length === 0) return EMPTY_STR
    // this is probably the most clever line in this module. deserializing
    // msgpack is really slow in v8. outside of JSON, allocating strings is
    // super slow and the bulk of our string allocs come from "grid_line" events
    // which contain 1 char strings.
    //
    // i've already setup the webgl renderer to take in ascii char codes and
    // translate them to texture coordinates, so creating strings for rendering
    // purposes is a waste of time
    //
    // the only downside to this approach is for any events that are not
    // "grid_line" - those events will need to deal with either strings or an
    // ascii char code (and maybe convert the char code to string).  we can do
    // this based on the nvim api protocol types, so anywhere where we expect
    // strings we can check for a number and convert it to str.
    if (length === 1 && this.skipStringAllocationBecauseMsgpackIsFuckingSlow)
      return raw[this.ix - 1]

    if (this.ix > raw.length) {
      this.incomplete = true
      this.partialBuffer = raw
      return ''
    }

    return raw.toString('utf8', this.ix - length, this.ix)
  }

  toMap(raw: Buffer, length: number): any {
    if (length === 0) return EMPTY_OBJECT

    const res = Object.create(null)

    for (let it = 0; it < length; it++) {
      const key = this.superparse(raw)
      const val = this.superparse(raw)
      res[key] = val
    }

    return res
  }

  toBigInt(raw: Buffer, index: number): BigInt {
    const part = raw.slice(index, index + 8)
    const hex = part.toString('hex')
    return hex.length ? BigInt(`0x${hex}`) : BigInt(0)
  }

  superparse(raw: Buffer) {
    const m = raw[this.ix]

    // fixint
    if (m >= 0x00 && m <= 0x7f) return this.ix++, m - 0x00
    // fixarr
    else if (m >= 0x90 && m <= 0x9f) return this.ix++, this.toArr(raw, m - 0x90)
    // uint8
    else if (m === 0xcc) return (this.ix += 2), raw[this.ix - 1]
    // fixstr
    else if (m >= 0xa0 && m <= 0xbf) return this.ix++, this.toStr(raw, m - 0xa0)
    // str8
    else if (m === 0xd9)
      return (this.ix += 2), this.toStr(raw, raw[this.ix - 1])
    // fixmap
    else if (m >= 0x80 && m <= 0x8f) return this.ix++, this.toMap(raw, m - 0x80)
    // arr16
    else if (m === 0xdc)
      return (
        (this.ix += 3),
        this.toArr(raw, (raw[this.ix - 2] << 8) | raw[this.ix - 1])
      )
    // negative fixint
    else if (m >= 0xe0 && m <= 0xff) return this.ix++, m - 0x100
    else if (m === 0xc3) return this.ix++, true
    else if (m === 0xc2) return this.ix++, false
    else if (m === 0xc0) return this.ix++, null
    // uint16
    else if (m === 0xcd)
      return (this.ix += 3), (raw[this.ix - 2] << 8) | raw[this.ix - 1]
    // str16
    else if (m === 0xda)
      return (
        (this.ix += 3),
        this.toStr(raw, (raw[this.ix - 2] << 8) | raw[this.ix - 1])
      )
    // map16
    else if (m === 0xde)
      return (
        (this.ix += 3),
        this.toMap(raw, (raw[this.ix - 2] << 8) | raw[this.ix - 1])
      )
    // int8
    else if (m === 0xd0) {
      const val = raw[this.ix + 1]
      this.ix += 2
      return val & 0x80 ? val - 0x100 : val
    }

    // int16
    else if (m === 0xd1) {
      const val = (raw[this.ix + 1] << 8) + raw[this.ix + 2]
      this.ix += 3
      return val & 0x8000 ? val - 0x10000 : val
    }

    // uint32
    else if (m === 0xce) {
      const val =
        raw[this.ix + 1] * 16777216 +
        (raw[this.ix + 2] << 16) +
        (raw[this.ix + 3] << 8) +
        raw[this.ix + 4]
      this.ix += 5
      return val
    }

    // int32
    else if (m === 0xd2) {
      const val =
        (raw[this.ix + 1] << 24) |
        (raw[this.ix + 2] << 16) |
        (raw[this.ix + 3] << 8) |
        raw[this.ix + 4]
      this.ix += 5
      return val
    }

    // float32
    else if (m === 0xca) {
      const val = raw.readFloatBE(this.ix + 1)
      this.ix += 5
      return val
    }

    // str32
    else if (m === 0xdb) {
      const length =
        raw[this.ix + 1] * 16777216 +
        (raw[this.ix + 2] << 16) +
        (raw[this.ix + 3] << 8) +
        raw[this.ix + 4]
      const val = this.toStr(raw, length)
      this.ix += 5
      return val
    }

    // arr32
    else if (m === 0xdd) {
      const length =
        raw[this.ix + 1] * 16777216 +
        (raw[this.ix + 2] << 16) +
        (raw[this.ix + 3] << 8) +
        raw[this.ix + 4]
      const val = this.toArr(raw, length)
      this.ix += 5
      return val
    }

    // map32
    else if (m === 0xdf) {
      const length =
        raw[this.ix + 1] * 16777216 +
        (raw[this.ix + 2] << 16) +
        (raw[this.ix + 3] << 8) +
        raw[this.ix + 4]
      const val = this.toMap(raw, length)
      this.ix += 5
      return val
    }

    // fixext1
    else if (m === 0xd4) return this.parseExt(raw, 1)
    // fixext2
    else if (m === 0xd5) return this.parseExt(raw, 2)
    // fixext4
    else if (m === 0xd6) return this.parseExt(raw, 4)
    // fixext8
    else if (m === 0xd7) return this.parseExt(raw, 8)
    // fixext16
    else if (m === 0xd8) return this.parseExt(raw, 16)
    // ext8
    else if (m === 0xc7) return this.ix++, this.parseExt(raw, raw[this.ix])
    // ext16
    else if (m === 0xc8)
      return (
        (this.ix += 2),
        this.parseExt(raw, (raw[this.ix] << 8) | raw[this.ix - 1])
      )
    // ext32
    else if (m === 0xc9) {
      const length =
        raw[this.ix] * 16777216 +
        (raw[this.ix + 1] << 16) +
        (raw[this.ix + 2] << 8) +
        raw[this.ix + 3]
      return (this.ix += 4), this.parseExt(raw, length)
    }

    // TODO: i'm not sure i'm converting these BigInts correctly
    // i think there is a way to set unsigned or not...

    // uint64
    else if (m === 0xcf) {
      const val = this.toBigInt(raw, this.ix + 1)
      this.ix += 9
      return val
    }

    // int64
    else if (m === 0xd3) {
      const val = this.toBigInt(raw, this.ix + 1)
      this.ix += 9
      return val
    }

    // float64
    else if (m === 0xcb) {
      const val = raw.readDoubleBE(this.ix + 1)
      this.ix += 9
      return val
    } else if (m === undefined) {
      this.incomplete = true
      this.partialBuffer = raw
      return
    }

    console.warn(
      'msgpack: dunno how to decode:',
      raw[this.ix].toString(16).padStart(2, '0')
    )
    return (this.ix += 1), NOT_SUPPORTED
  }

  _transform(chunk: Buffer, _: any, done: Function) {
    const workingBuffer = this.incomplete
      ? Buffer.concat([this.partialBuffer, chunk])
      : chunk

    // if we have a "redraw" event we will skip allocation of strings that are
    // only 1 byte long.  strings that are 1 byte long happen to be ascii chars.
    // we can handle these ascii code points as raw numbers in the rendering
    // redraw logic. this greaty improves performance as allocating strings
    // is too damn slow in v8. would have been much better if neovim used JSON
    // or if i wasn't a noob and picked a statically compiled language like rust
    const part = workingBuffer.slice(0, redrawEventKey.length)
    this.skipStringAllocationBecauseMsgpackIsFuckingSlow = redrawEventKey.equals(
      part
    )

    const bufsize = workingBuffer.length
    if (this.incomplete) this.incomplete = false
    this.ix = 0

    while (this.ix < bufsize) {
      const res = this.superparse(workingBuffer)
      if (this.incomplete) return done()
      this.push(res)
    }

    done()
  }
}
