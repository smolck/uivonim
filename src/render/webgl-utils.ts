// understanding webgl state
// https://stackoverflow.com/a/28641368
// https://stackoverflow.com/a/39972830
// https://stackoverflow.com/a/27164577

interface VertexArrayPointer {
  size: number
  type: number
  normalize?: boolean
  stride?: number
  offset?: number
  divisor?: number
}

interface AttribPointer extends VertexArrayPointer {
  pointer: number
}

export enum VarKind {
  Attribute,
  Uniform,
}

interface SetupData {
  setData: (
    data: ArrayBufferView,
    drawKind?: typeof WebGLRenderingContext.STATIC_DRAW
  ) => void
}

type VK = { [index: string]: VarKind }
type SD1 = (pointers: AttribPointer) => SetupData
type SD2 = (pointers: AttribPointer[]) => SetupData
type SetupDataFunc = SD1 & SD2

const create = (options?: WebGLContextAttributes) => {
  const canvas = document.createElement('canvas')
  const gl =
    (canvas.getContext('webgl2', options) as WebGL2RenderingContext) ||
    (canvas.getContext('webgl', options) as WebGLRenderingContext) ||
    (canvas.getContext('experimental-webgl', options) as WebGLRenderingContext)
  const webgl2Mode = !(gl instanceof WebGLRenderingContext)

  // webgl1 extensions
  const ext = {
    vao: gl.getExtension('OES_vertex_array_object'),
    instance: gl.getExtension('ANGLE_instanced_arrays'),
  }

  const createVertexArray = () =>
    webgl2Mode
      ? (gl as WebGL2RenderingContext).createVertexArray()
      : ext.vao!.createVertexArrayOES()

  const bindVertexArray = (
    vao: WebGLVertexArrayObjectOES | WebGLVertexArrayObject
  ) =>
    webgl2Mode
      ? (gl as WebGL2RenderingContext).bindVertexArray(vao)
      : ext.vao!.bindVertexArrayOES(vao)

  const vertexAttribDivisor = (pointer: number, divisor: number) =>
    webgl2Mode
      ? (gl as WebGL2RenderingContext).vertexAttribDivisor(pointer, divisor)
      : ext.instance!.vertexAttribDivisorANGLE(pointer, divisor)

  const drawArraysInstanced = (
    mode: number,
    first: number,
    count: number,
    primcount: number
  ) =>
    webgl2Mode
      ? (gl as WebGL2RenderingContext).drawArraysInstanced(
          mode,
          first,
          count,
          primcount
        )
      : ext.instance!.drawArraysInstancedANGLE(mode, first, count, primcount)

  const resize = (width: number, height: number) => {
    const w = Math.round(width * window.devicePixelRatio)
    const h = Math.round(height * window.devicePixelRatio)

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
  }

  const createShader = (type: number, source: string) => {
    const shaderSource = webgl2Mode ? '#version 300 es\n' + source : source
    const shader = gl.createShader(type)
    if (!shader) return console.error('failed to create gl shader. oops.')

    gl.shaderSource(shader, shaderSource)
    gl.compileShader(shader)

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    if (success) return shader

    console.error(gl.getShaderInfoLog(shader), source)
    gl.deleteShader(shader)
  }

  const createProgramWithShaders = (
    vertexShader: string,
    fragmentShader: string
  ) => {
    const program = gl.createProgram()
    if (!program) return console.error('failed to create gl program. oops.')

    const vshader = createShader(gl.VERTEX_SHADER, vertexShader)
    const fshader = createShader(gl.FRAGMENT_SHADER, fragmentShader)
    if (!vshader || !fshader)
      return console.error(
        'failed to create shaders - cant create program. sorry bout that'
      )

    gl.attachShader(program, vshader)
    gl.attachShader(program, fshader)
    gl.linkProgram(program)

    const success = gl.getProgramParameter(program, gl.LINK_STATUS)
    if (success) return program

    console.error(gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
  }

  const loadCanvasTexture = (
    canvas: HTMLCanvasElement,
    textureUnit = gl.TEXTURE0
  ) => {
    gl.activeTexture(textureUnit)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // @ts-ignore TYPINGS ARE WRONG READ THE DOCS https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/pixelStorei#Pixel_storage_parameters
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  }

  const setupVertexArray = ({
    size,
    type,
    pointer,
    normalize = false,
    stride = 0,
    offset = 0,
    divisor = 0,
  }: AttribPointer) => {
    gl.enableVertexAttribArray(pointer)
    if (!type)
      throw new Error(
        `need vertex array type. we try to guess the type based on the bufferData type, but this logic is not very smart.`
      )
    gl.vertexAttribPointer(pointer, size, type, normalize, stride, offset)

    if (divisor > 0) vertexAttribDivisor(pointer, divisor)
  }

  const setupProgram = <T extends VK>(incomingVars: T) => {
    let vertexShader: string
    let fragmentShader: string
    let program: WebGLProgram
    let vao: WebGLVertexArrayObject
    const varLocations = new Map<string, any>()
    type VarGet = { [Key in keyof T]: number }

    const varToString: VarGet = new Proxy(Object.create(null), {
      get: (_: any, key: string) => key,
    })

    const vars: VarGet = new Proxy(Object.create(null), {
      get: (_, key: string) => varLocations.get(key),
    })

    const setVertexShader = (fn: (incomingVars: VarGet) => string) => {
      vertexShader = fn(varToString)
    }

    const setFragmentShader = (fn: (incomingVars: VarGet) => string) => {
      fragmentShader = fn(varToString)
    }

    const create = () => {
      const res = createProgramWithShaders(vertexShader, fragmentShader)
      if (!res)
        throw new Error(
          'catastrophic failure of the third kind to create webgl program'
        )
      program = res

      const createdVao = createVertexArray()
      if (!createdVao)
        throw new Error(`failed to create vertex array object... hmmm`)
      vao = createdVao

      Object.entries(incomingVars).forEach(([key, kind]) => {
        const location =
          kind === VarKind.Uniform
            ? gl.getUniformLocation(program, key)
            : gl.getAttribLocation(program, key)

        if (typeof location === 'number' && location < 0) {
          const kindText = kind === VarKind.Uniform ? 'uniform' : 'attribute'
          console.warn(
            `${kindText} ${key} is not used in any shader. this will cause "index out of range warnings" if you try to use the pointer (like vertexAttribPointer)`
          )
        }

        varLocations.set(key, location)
      })
    }

    const use = () => {
      gl.useProgram(program)
      bindVertexArray(vao)
      gl.enable(gl.SCISSOR_TEST)
    }

    const setupData: SetupDataFunc = (pointers: any) => {
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

      pointers.length
        ? pointers.forEach((pointer: AttribPointer) =>
            setupVertexArray(pointer)
          )
        : setupVertexArray(pointers)

      return {
        setData: (data: any, drawKind = gl.STATIC_DRAW) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
          gl.bufferData(gl.ARRAY_BUFFER, data, drawKind)
        },
      }
    }

    return { create, vars, use, setVertexShader, setFragmentShader, setupData }
  }

  return {
    canvasElement: canvas,
    setupProgram,
    gl,
    loadCanvasTexture,
    resize,
    drawArraysInstanced,
    webgl2Mode,
  }
}

export type WebGL = ReturnType<typeof create>
export default create
