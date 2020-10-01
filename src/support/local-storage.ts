import { fromJSON } from '../support/utils'

export const removeItem = (key: string) => localStorage.removeItem(key)
export const setItem = (key: string, value: any) =>
  localStorage.setItem(key, JSON.stringify(value))
export const getItem = <T>(key: string, defaultValue = {} as T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) return defaultValue
  return fromJSON(raw).or(defaultValue)
}

export const setTemp = (key: string, value: any) =>
  sessionStorage.setItem(key, JSON.stringify(value))
export const getTemp = <T>(key: string, defaultValue = {} as T): T => {
  const raw = sessionStorage.getItem(key)
  if (!raw) return defaultValue
  return fromJSON(raw).or(defaultValue)
}
