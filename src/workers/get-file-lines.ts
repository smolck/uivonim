import { on } from '../messaging/worker-client'
import { exists } from '../support/utils'
import { createReadStream } from 'fs'

export interface LineContents {
  ix: number
  line: string
}

const fileReader = (path: string, targetLines: number[]) =>
  new Promise((done) => {
    const collectedLines: LineContents[] = []
    const linesOfInterest = new Set(targetLines)
    const maxLineIndex = Math.max(...targetLines)
    let currentLineIndex = 0
    let buffer = ''

    // not using NewlineSplitter here because it filters out empty lines
    // we need the empty lines, since we track the line index
    const readStream = createReadStream(path).on('data', (raw) => {
      const lines = (buffer + raw).split(/\r?\n/)
      buffer = lines.pop() || ''

      lines.forEach((line) => {
        const needThisLine = linesOfInterest.has(currentLineIndex)
        if (needThisLine) collectedLines.push({ ix: currentLineIndex, line })

        const reachedMaximumLine = currentLineIndex === maxLineIndex
        if (reachedMaximumLine) readStream.close()

        currentLineIndex++
      })
    })

    readStream.on('close', () => done(collectedLines))
  })

on.getLines(async (path: string, lines: number[]) => {
  const fileExists = await exists(path)

  // at the time of this writing, the only consumer of this piece of code is
  // find-references from the lang servers. the find references will return a
  // list of path locations. we want to get the text corresponding to those
  // path locations. i think it is extremely unlikely that we would get paths
  // from find-references and then the file goes missing from the FS (file
  // system).  also, i assume that lang server would only return valid paths
  // that exist on the FS...
  //
  // although, i suppose there could be active buffers in the workspace that
  // have not been committed to the FS. and in the future lang servers might
  // support buffers that never exist on the FS (see new VSCode extensions for
  // in-memory files, etc.)
  if (!fileExists) {
    console.warn(`tried to read lines from ${path} that does not exist`)
    return []
  }

  return fileReader(path, lines)
})
