import { LineContents } from '../workers/get-file-lines'
import { Buffer } from '../neovim/types'
import Worker from '../messaging/worker'
import nvim from '../neovim/api'
import { Range } from '../neovim/types'

export interface Location {
  path: string
  range: Range
}

export interface LocationResult extends Location {
  lineContents: string
}

interface LocationMeta extends Location {
  buffer?: Buffer
}

const worker = Worker('get-file-lines')

const getLinesFromBuffers = async (locations: LocationMeta[]) => {
  const requests = locations.map(async (location) => ({
    path: location.path,
    range: location.range,
    lineContents: await location.buffer!.getLine(location.range.start.line),
  }))

  return Promise.all(requests)
}

const getLinesFromFilesystem = async (locations: LocationMeta[]) => {
  const locationsGroupedByPath = locations.reduce((group, location) => {
    const path = location.path
    const lineNumber = location.range.start.line

    group.has(path)
      ? group.get(path)!.push(lineNumber)
      : group.set(path, [lineNumber])

    return group
  }, new Map<string, number[]>())

  const locationsWithContentRequests = [
    ...locationsGroupedByPath.entries(),
  ].map(async ([path, lineNumbers]) => ({
    path,
    lineContents: (await worker.request.getLines(
      path,
      lineNumbers
    )) as LineContents[],
  }))

  const locationsWithContents = await Promise.all(locationsWithContentRequests)

  const locationContentMap = locationsWithContents.reduce(
    (map, { path, lineContents }) => {
      lineContents.forEach(({ ix, line }) => map.set(`${path}:${ix}`, line))
      return map
    },
    new Map<string, string>()
  )

  return locations.map((location) => {
    const lineContents =
      locationContentMap.get(`${location.path}:${location.range.start.line}`) ||
      ''
    return {
      lineContents,
      path: location.path,
      range: location.range,
    }
  })
}

export default async (locations: Location[]): Promise<LocationResult[]> => {
  const bufs = await nvim.buffers.list()
  const buffers = await Promise.all(
    bufs.map(async (buffer) => ({
      buffer,
      name: await buffer.name,
    }))
  )

  const locationsMeta = locations.map((location) => {
    const foundBuffer = buffers.find((b) => b.name === location.path)
    return {
      ...location,
      buffer: foundBuffer ? foundBuffer.buffer : undefined,
    } as LocationMeta
  })

  const locationsFromBuffers = locationsMeta.filter((m) => !!m.buffer)
  const locationsFromFilesystem = locationsMeta.filter((m) => !m.buffer)

  const bufferResults = await getLinesFromBuffers(locationsFromBuffers)
  const filesystemResults = await getLinesFromFilesystem(
    locationsFromFilesystem
  )

  return [...bufferResults, ...filesystemResults]
}
