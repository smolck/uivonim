import '../support/vscode-shim'
import '../extension-host/language-events'
import '../extension-host/extension-discovery'

// TODO: THIS LEAKS OUTSIDE OF WORKER!
// need this flag to spawn node child processes. this will use the same node
// runtime included with electron. usually we would set this as an option in
// the spawn call, but we do not have access to the spawn calls in the
// extensions that are spawning node executables (language servers, etc.)
process.env.ELECTRON_RUN_AS_NODE = '1'
if (process.env.VEONIM_DEV) require('../dev/ext-host-development')

// TODO: ALL THESE THINGS BELOW relate to debuggers. we need to clean it up once we get vscode extensions
// setup properly. we should move all these things to their own modules. extension-host should only be
// a loader for all extension-host modules

// import { DebugConfiguration, collectDebuggersFromExtensions,
//   getAvailableDebuggers, getLaunchConfigs, resolveConfigurationByProviders,
//   getDebuggerConfig } from '../extensions/debuggers'
// import DebugProtocolConnection, { DebugAdapterConnection } from '../messaging/debug-protocol'
// import { readFile, fromJSON, uuid, getDirs, getFiles, merge, configPath } from '../support/utils'
// import { registerExtension } from '../vscode/extensions'
// import { on, call } from '../messaging/worker-client'
// import { ChildProcess, spawn } from 'child_process'
// import LocalizeFile from '../support/localize'
// import pleaseGet from '../support/please-get'
// import { dirname, join } from 'path'

// interface Debugger {
//   type: string
//   label: string
//   program: string
//   runtime?: 'node' | 'mono'
// }

// TODO: on filetype change activate extensions
// nvim.on.filetype(filetype => filetypeDetectedStartServerMaybe(nvim.state.cwd, filetype))

// TODO: move to separate module

/*
const runningDebugAdapters = new Map<string, DebugAdapterConnection>()

on.listLaunchConfigs(() => getLaunchConfigs())
on.listDebuggers(async () => {
  const debuggers = await getAvailableDebuggers()
  return debuggers.map(d => {
    const localizedLabel = d.extension.localize(d.label)
    return { type: d.type, label: localizedLabel }
  })
})

on.startDebugWithConfig((folderUri: string, config: DebugConfiguration) => startDebugWithConfig(folderUri, config))
on.startDebugWithType((folderUri: string, type: string) => startDebugWithType(folderUri, type))

// TODO: deprecate?
on.startDebug((type: string) => start.debug(type))

const getDebugAdapter = (id: string) => {
  const server = runningDebugAdapters.get(id)
  if (!server) throw new Error(`fail to get debug adapter ${id}. this should not happen... ever.`)
  return server
}

on.debug_sendRequest(({ serverId, command, args }: any) => {
  return getDebugAdapter(serverId).sendRequest(command, args)
})

on.debug_sendNotification(({ serverId, response }: any) => {
  getDebugAdapter(serverId).sendNotification(response)
})

on.debug_onNotification(({ serverId, method }: any) => {
  getDebugAdapter(serverId).onNotification(method, a => call[`${serverId}:${method}`](a))
})

on.debug_onRequest(({ serverId }: any) => {
  getDebugAdapter(serverId).onRequest(a => call[`${serverId}:onRequest`](a))
})

on.debug_onError(({ serverId }: any) => {
  getDebugAdapter(serverId).onError(a => call[`${serverId}:onError`](a))
})

on.debug_onClose(({ serverId }: any) => {
  getDebugAdapter(serverId).onClose(() => call[`${serverId}:onClose`]())
})





// TODO: get debug adapters
//   collectDebuggersFromExtensions(extensionsWithConfig)
// }

/** Start a debugger with a given launch.json configuration chosen by user */
// const startDebugWithConfig = async (cwd: string, config: DebugConfiguration) => {
//   const launchConfig = await resolveConfigurationByProviders(cwd, config.type, config)

//   // TODO: start debugger
//   console.log('start debugger with config:', launchConfig)

//   return { launchConfig, serverId: -1 }
// }

/*
 * Start a debugger with a given debug 'type'. This is a debugger chosen
 * by the user after calling 'getAvailableDebuggers'. The configuration
 * will be resolved automagically by via configs provided in extension
 * package.json and/or via DebugConfigurationProvider
 */

/*
const startDebugWithType = async (cwd: string, type: string) => {
  const launchConfig = await getDebuggerConfig(cwd, type)
  if (!launchConfig) return console.error(`can not start debugger ${type}`)

  // TODO: start debugger
  console.log('start debugger with config:', launchConfig)

  return { launchConfig, serverId: -1 }
}

const start = {
  debug: async (type: string) => {
    // TODO: only activate extensions for 'onDebug'
    // other events are called by getting config fns...

    const { extension, debug } = getDebug(type)
    if (!extension) return console.error(`extension for ${type} not found`)

    // TODO: handle recursive extension dependencies
    const activations = extension.extensionDependencies
      .map(parseExtensionDependency)
      .map(e => ({ ...e, ...findExtensionDependency(e) }))
      .map(async e => {
        const extInstalled = (e as Extension).requirePath
        if (!extInstalled) {
          console.error(`extension ${e.name} was not installed before activation`)
          return { dispose: () => {} } as Disposable
        }
        // TODO: only activate if has relevant activation events???? or always activate?
        return activateExtension(e as Extension)
      })

    // TODO: do something with the subscriptions? for later cleanup purposes?
    await Promise.all(activations)

    // TODO: do something with the subscriptions? for later cleanup purposes?
    // TODO: only activate if has relevant activation events???? or always activate?
    await activateExtension(extension)

    // debug activationEvents:
    // - onDebug
    // - onDebugResolve:${type} - wut?
    // - onDebugInitialConfigurations - wut?

    return startDebugger(extension, debug)
  },
}

const getDebug = (type: string) => [...extensions].reduce((res, extension) => {
  const debuggers = pleaseGet(extension.config).contributes.debuggers([])
  const debug = debuggers.find((d: any) => d.type === type)
  return debug ? merge(res, { extension, debug }) : res
}, {} as { extension: Extension, debug: Debugger })

const connectDebugAdapter = (proc: ChildProcess): string => {
  const serverId = uuid()
  const conn = DebugProtocolConnection(proc.stdout, proc.stdin)
  runningDebugAdapters.set(serverId, conn)
  return serverId
}

const startDebugger = (extension: Extension, debug: Debugger) => {
  const adapterPath = join(extension.packagePath, debug.program)
  const proc = startDebugAdapter(adapterPath, debug.runtime)

  // TODO: testing
  proc.stderr.on('data', err => console.error(debug.type, 'errrrrrrr:' + err + ''))
  // TODO: testing

  return connectDebugAdapter(proc)
}

const startDebugAdapter = (debugAdapterPath: string, runtime: Debugger['runtime']): ChildProcess => {
  // TODO: do we need to accept any arguments from launch.json config? (whether user provided or generated)
  const spawnOptions = {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  }

  let proc

  // if a runtime is not provided, then the debug adapter is a binary executable
  // TODO: support cross-platform executables (see docs for examples)
  // by the way, different platforms may require different executables. see the docs
  // for example combinations of program/runtime
  if (!runtime) proc = spawn(debugAdapterPath, [], spawnOptions)
  else if (runtime === 'node') proc = spawn(process.execPath, [debugAdapterPath], spawnOptions)
  // TODO: figure out how to start a debug adapter with "mono" runtime
  // i do not believe mono runtime comes with vscode (would be surprised if it did)
  // the vscode-mono-debug extension readme asks that the user install mono
  // separately. that means we just need to figure out how to start/run mono
  // if installed and start the debug adapter with it (i.e. is mono in $PATH, etc.)
  else if (runtime === 'mono') throw new Error('debug adapter runtime "mono" not supported yet, but it should!')
  else throw new Error(`invalid debug adapter runtime provided: ${runtime}. are we supposed to support this?`)

  return proc
}
*/
