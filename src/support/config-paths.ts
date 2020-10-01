import { configPath } from '../support/utils'
import { join } from 'path'

const veonimPath = (path: string) => join(configPath, 'veonim', path)

export const EXT_PATH = veonimPath('extensions')
export const EXT_DATA_PATH = veonimPath('extensions_data')
export const LOG_PATH = veonimPath('logs')
