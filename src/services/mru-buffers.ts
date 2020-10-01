import nvim from '../neovim/api'

interface BufferStack {
  /** offset from right (last item in stack). tracks position in the stack as
   * we are jumping thru buffers */
  jumpOffset: number
  stack: string[]
}

const bufferStacks = new Map<number, BufferStack>()
let activeWindow = 0
let jumpingBufferStack = false

// TODO: how do we cleanup windows that no longer exist?
// ultimately i think we should tie this into render events
// with the new ext-windows. actually the new window classes
// can track bufferName history directly. when the window gets
// removed, so does the history for it. yeah i like that. lets do that

nvim.onAction('buffer-prev', async () => {
  if (!bufferStacks.has(activeWindow))
    return console.error(
      'no buffer stacks - window does not exist. this should never happen'
    )

  const bs = bufferStacks.get(activeWindow)!

  if (!bs.stack.length) return
  if (bs.jumpOffset >= bs.stack.length - 1) return

  bs.jumpOffset += 1
  jumpingBufferStack = true

  const endIndex = bs.stack.length - bs.jumpOffset - 1
  const jumpBuffer = bs.stack[endIndex]

  const bufferList = await nvim.buffers.list()
  const buffers = await Promise.all(
    bufferList.map(async (b) => ({
      id: b.id,
      name: await b.name,
    }))
  )

  const targetBuffer = buffers.find((b) => b.name === jumpBuffer)
  if (targetBuffer) nvim.cmd(`b ${targetBuffer.id}`)
})

nvim.onAction('buffer-next', async () => {
  if (!bufferStacks.has(activeWindow))
    return console.error(
      'no buffer stacks - window does not exist. this should never happen'
    )

  const bs = bufferStacks.get(activeWindow)!

  if (!bs.stack.length) return
  if (bs.jumpOffset < 1) return

  bs.jumpOffset -= 1
  jumpingBufferStack = true

  const endIndex = bs.stack.length - bs.jumpOffset - 1
  const jumpBuffer = bs.stack[endIndex]

  const bufferList = await nvim.buffers.list()
  const buffers = await Promise.all(
    bufferList.map(async (b) => ({
      id: b.id,
      name: await b.name,
    }))
  )

  const targetBuffer = buffers.find((b) => b.name === jumpBuffer)
  if (targetBuffer) nvim.cmd(`b ${targetBuffer.id}`)
})

nvim.on.winEnter(async (id) => {
  activeWindow = id
  const bufferName = await nvim.current.buffer.name

  if (!bufferStacks.has(id))
    return bufferStacks.set(id, {
      jumpOffset: 0,
      stack: [bufferName],
    })

  const { stack, jumpOffset } = bufferStacks.get(id)!
  const lastItem = stack[stack.length - 1]
  if (lastItem !== bufferName) stack.push(bufferName)

  if (stack.length > 100) {
    const reducedStack = stack.slice(stack.length - 100)
    bufferStacks.set(id, { jumpOffset, stack: reducedStack })
  }
})

nvim.on.bufLoad(async () => {
  if (!bufferStacks.has(activeWindow))
    return console.error(
      'can not add buffer to stack - no window present. this is not supposed to happen'
    )

  const bufferName = await nvim.current.buffer.name
  const { stack, jumpOffset } = bufferStacks.get(activeWindow)!
  const lastItem = stack[stack.length - 1]

  if (jumpingBufferStack) {
    jumpingBufferStack = false
    return
  }

  if (jumpOffset) {
    const endIndex = stack.length - jumpOffset
    const remainBufferStack = stack.slice(0, endIndex)
    remainBufferStack.push(bufferName)
    bufferStacks.set(activeWindow, { jumpOffset: 0, stack: remainBufferStack })
    return
  }

  if (lastItem !== bufferName) stack.push(bufferName)

  if (stack.length > 100) {
    const reducedStack = stack.slice(stack.length - 100)
    bufferStacks.set(activeWindow, { jumpOffset, stack: reducedStack })
  }
})

setTimeout(async () => {
  activeWindow = await nvim.current.window.id
  const currentBufferName = await nvim.current.buffer.name

  bufferStacks.set(activeWindow, {
    jumpOffset: 0,
    stack: currentBufferName ? [currentBufferName] : [],
  })
}, 1e3)
