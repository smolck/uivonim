import nvim from '../neovim/api'

type Callback = () => void

export interface ShadowBuffer {
  name: string
  element: HTMLElement
  onFocus?: Callback
  onBlur?: Callback
  onShow?: Callback
  onHide?: Callback
}

const shadowBuffers = new Map<string, ShadowBuffer>()

// by using an initFn we allow the possibility in the future of generating more
// than one instance of a shadow buffer. for example if a user wants to have two
// explorer buffers, each one pointing to a separate directory? honestly, this is
// probably a dumb use case, as plugins like NERDTree only allow one instance at
// a time (that i'm aware of). honestly i'm still undecided if we should have one
// instance only or allow multiple...
export const registerShadowComponent = (initFn: () => ShadowBuffer) => {
  const shadowComponent = initFn()
  shadowBuffers.set(shadowComponent.name, shadowComponent)
  nvim.buffers.addShadow(shadowComponent.name)
}

export const getShadowBuffer = (name: string) => shadowBuffers.get(name)
