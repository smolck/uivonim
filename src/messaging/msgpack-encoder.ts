// SPEC: https://github.com/msgpack/msgpack/blob/master/spec.md

import { is, type } from '../support/utils'
import { Transform } from 'stream'

const i8_max = 2 ** 8 - 1
const i16_max = 2 ** 16 - 1
const i32_max = 2 ** 32 - 1
const u8_min = -1 * 2 ** (8 - 1)
const u16_min = -1 * 2 ** (16 - 1)
const u32_min = -1 * 2 ** (32 - 1)
const negativeFixInt_min = -(2 ** 5)
const u8_max = 2 ** (8 - 1) - 1

const length2 = (code: number, length: number): Buffer =>
  Buffer.from([code, length >>> 8, length])

const length4 = (code: number, length: number): Buffer =>
  Buffer.from([code, length >>> 24, length >>> 16, length >>> 8, length])

const sizeof = {
  str: ({ length }: { length: number }) => {
    if (length < 32) return [0xa0 + length]
    if (length <= i8_max) return [0xd9, length]
    if (length <= i16_max) return length2(0xda, length)
    if (length <= i32_max) return length4(0xdb, length)
    return [0xa0 + length]
  },
  arr: ({ length }: { length: number }) => {
    if (length < 16) return [0x90 + length]
    if (length <= i16_max) return length2(0xdc, length)
    if (length <= i32_max) return length4(0xdd, length)
    return [0x90 + length]
  },
  obj: ({ length }: { length: number }) => {
    if (length < 16) return [0x80 + length]
    if (length <= i16_max) return length2(0xde, length)
    if (length <= i32_max) return length4(0xdf, length)
    return [0x80 + length]
  },
}

const fromNum = (m: number): Buffer => {
  // fixint
  if (m >= 0 && m <= u8_max) return Buffer.from([m])

  // uint8
  if (m >= 0 && m <= i8_max) {
    const raw = Buffer.alloc(2)
    raw[0] = 0xcc
    raw.writeUInt8(m, 1)
    return raw
  }

  // uint16
  if (m >= 0 && m <= i16_max) {
    const raw = Buffer.alloc(3)
    raw[0] = 0xcd
    raw.writeUInt16BE(m, 1)
    return raw
  }

  // uint32
  if (m >= 0 && m <= i32_max) {
    const raw = Buffer.alloc(5)
    raw[0] = 0xce
    raw.writeUInt32BE(m, 1)
    return raw
  }

  // -fixint
  if (m < 0 && m >= negativeFixInt_min) return Buffer.from([m])

  // -int8
  if (m >= u8_min && m < 0) {
    const raw = Buffer.alloc(2)
    raw[0] = 0xd0
    raw.writeInt8(m, 1)
    return raw
  }

  // -int16
  if (m >= u16_min && m < 0) {
    const raw = Buffer.alloc(3)
    raw[0] = 0xd1
    raw.writeInt16BE(m, 1)
    return raw
  }

  // -int32
  if (m >= u32_min && m < 0) {
    const raw = Buffer.alloc(5)
    raw[0] = 0xd2
    raw.writeInt32BE(m, 1)
    return raw
  }

  console.warn('msgpack: can not encode number:', m)
  return Buffer.from([m])
}

const fromStr = (str: string): Buffer => {
  const raw = Buffer.from(str)
  return Buffer.from([...sizeof.str(raw), ...raw])
}

const fromArr = (arr: any[]): Buffer => {
  const raw = arr.reduce((m, item) => {
    if (typeof item === 'string') return [...m, ...fromStr(item)]
    if (Array.isArray(item)) return [...m, ...fromArr(item)]
    if (typeof item === 'number') return [...m, ...fromNum(item)]
    if (is.object(item)) return [...m, ...fromObj(item)]
    if (item == null) return [...m, 0xc0]
    if (item === false) return [...m, 0xc2]
    if (item === true) return [...m, 0xc3]
    console.warn('msgpack: dunno how to encode this', item, type(item))
    return m
  }, [])

  return Buffer.from([...sizeof.arr(arr), ...raw])
}

const fromObj = (obj: any): Buffer => {
  const kv = Object.entries(obj)

  const raw = kv.reduce((res, [key, val]) => {
    return [...res, ...fromStr(key), ...encode(val)]
  }, [] as any[])

  return Buffer.from([...sizeof.obj(kv), ...raw])
}

const encode = (m: any): Buffer => {
  if (m == null) return Buffer.from([0xc0])
  if (m === false) return Buffer.from([0xc2])
  if (m === true) return Buffer.from([0xc3])
  if (typeof m === 'string') return fromStr(m)
  if (Array.isArray(m)) return fromArr(m)
  if (typeof m === 'number') return fromNum(m)
  if (is.object(m)) return fromObj(m)
  console.warn('msgpack: dunno how to encode this', m, type(m))
  return Buffer.from(m)
}

export default class extends Transform {
  constructor() {
    super({ objectMode: true })
  }

  _transform(data: any, _: any, done: Function) {
    this.push(encode(data))
    done()
  }
}
