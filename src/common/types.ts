export interface WindowMetadata {
  id: number
  dir: string
  name: string
  filetype: string
  active: boolean
  modified: boolean
  terminal: boolean
  termAttached: boolean
  termFormat: string
}

// TODO(smolck): This used to be generated from the nvim API, should it still be?
export interface ExtContainer {
  extContainer: boolean
  kind: number
  id: any
}
