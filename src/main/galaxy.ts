import * as nvim from '../core/master-control'
// import * as workspace from '../core/workspace'
import api from '../core/instance-api'
import * as windows from '../windows/window-manager'

// TODO: do we need to sync instance nvim state to main thread? see instance-api todo note
// TODO: webgl line width
// TODO: investigate no texture on unit0. im guessing the texture atlas are not
// ready on load?
// TODO: do we still need roboto-sizes.json? we generate the font atlas before
// we can render anything to webgl, so we can probably grab the size then

// TODO(smolck): Perhaps not the best way to do command-line arg parsing
/*const args = remote.process.argv.slice(2)
const wslIndex = args.findIndex((val) => val == '--wsl')
let useWsl = false
if (wslIndex != -1) useWsl = true

const nvimIndex = args.findIndex((val) => val == '--nvim')
let nvimBinaryPath: string | undefined = undefined
// TODO(smolck)
if (args[nvimIndex + 1] == undefined || args[nvimIndex + 1].includes('--')) {
  console.warn('No argument passed to --nvim, using default `nvim`')
} else if (nvimIndex != -1) {
  nvimBinaryPath = args[nvimIndex + 1]
}*/

// const win = remote.getCurrentWindow()

