export type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: any[]) => infer U
  ? U
  : T extends Promise<infer U>
  ? U
  : T
export type UnPromisify<T> = T extends Promise<infer U> ? U : T
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : T

// to make interface properties optional use built-in Partial<>

// type AlterReturnType<T extends (...args: any[]) => any, R> =
export type AlterReturnType<T, R> = T extends () => any
  ? () => R
  : T extends (a: infer A) => any
  ? (a: A) => R
  : T extends (a: infer A, b: infer B) => any
  ? (a: A, b: B) => R
  : T extends (a: infer A, b: infer B, c: infer C) => any
  ? (a: A, b: B, c: C) => R
  : T extends (a: infer A, b: infer B, c: infer C, d: infer D) => any
  ? (a: A, b: B, c: C, d: D) => R
  : T extends (
      a: infer A,
      b: infer B,
      c: infer C,
      d: infer D,
      e: infer E
    ) => any
  ? (a: A, b: B, c: C, d: D, e: E) => R
  : never

export const maybe = <T>(val: T): T | undefined => val
