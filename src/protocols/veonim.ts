export enum MessageKind {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Success = 'success',
  System = 'system',
  Hidden = 'hidden',
  Progress = 'progress',
}

export interface Message {
  kind: MessageKind
  message: string
  stealsFocus?: boolean
  actions?: string[]
  progress?: number
  progressCancellable?: boolean
}

export interface MessageStatusUpdate {
  percentage?: number
  status?: string
}

export interface MessageReturn {
  internalId?: string
  setProgress: (update: MessageStatusUpdate) => void
  remove: () => void
  promise: Promise<string>
}

export interface FlexibleExpire {
  refresh(): void
}
