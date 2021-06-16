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
  Attribute = 0,
  Uniform1f,
  Uniform1i,
  Uniform2f,
  Uniform4f,
}

const isUniform = (kind: VarKind) => kind > VarKind.Attribute

interface SetupData {
  setData: (
    data: ArrayBufferView,
    drawKind?: typeof WebGLRenderingContext.STATIC_DRAW
  ) => void
}

type VK = { [index: string]: VarKind }

const create = (options?: WebGLContextAttributes) => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', options) as WebGL2RenderingContext

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
    const shader = gl.createShader(type)
    if (!shader) return console.error('failed to create gl shader. oops.')

    gl.shaderSource(shader, source)
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
    // @ts-ignore typings are wrong, see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/pixelStorei#Pixel_storage_parameters
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  }

  const loadPixelData = (
    pixelData: ImageData,
    textureUnit = gl.TEXTURE0
  ) => {
    gl.activeTexture(textureUnit)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // @ts-ignore typings are wrong, see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/pixelStorei#Pixel_storage_parameters
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

    // gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixelData)
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixelData, can)
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

    if (divisor > 0) gl.vertexAttribDivisor(pointer, divisor)
  }

  const setupProgram = <T extends VK>(incomingVars: T) => {
    let vertexShader: string
    let fragmentShader: string
    let program: WebGLProgram
    let vao: WebGLVertexArrayObject

    type Var = {
      location: WebGLUniformLocation
      kind: VarKind
    }
    const varLocations = new Map<string, Var>()

    type VarGet = { [Key in keyof T]: any }

    let programCreated = false

    const vars: VarGet = new Proxy(Object.create(null), {
      // TODO(smolck): Use `!` or `?` instead? Not sure if we want to assert
      // non-null, or if it even matters because of type-checking . . .
      get: (_, key: string) => varLocations.get(key)!.location,
      set: (_: any, key: string, value: any) => {
        if (!programCreated) {
          return false
        }

        const { kind, location } = varLocations.get(key)!
        switch (kind) {
          case VarKind.Attribute:
            return false // Can't set attributes this way (yet?)
          case VarKind.Uniform1f:
            gl.uniform1f(location, value)
            break
          case VarKind.Uniform1i:
            gl.uniform1i(location, value)
            break
          case VarKind.Uniform2f:
            gl.uniform2fv(location, value)
            break
          case VarKind.Uniform4f:
            gl.uniform4fv(location, value)
            break
        }

        return true
      },
    })

    return {
      vars,
      setVertexShader: (shader: string) => (vertexShader = shader),
      setFragmentShader: (shader: string) => (fragmentShader = shader),
      create: () => {
        const res = createProgramWithShaders(vertexShader, fragmentShader)
        if (!res)
          throw new Error(
            'catastrophic failure of the third kind to create webgl program'
          )
        program = res

        const createdVao = gl.createVertexArray()
        if (!createdVao)
          throw new Error(`failed to create vertex array object... hmmm`)
        vao = createdVao

        Object.entries(incomingVars).forEach(([key, kind]) => {
          const location = isUniform(kind)
            ? gl.getUniformLocation(program, key)
            : gl.getAttribLocation(program, key)

          if (typeof location === 'number' && location < 0) {
            const kindText = isUniform(kind) ? 'uniform' : 'attribute'
            console.warn(
              `${kindText} ${key} is not used in any shader. this will cause "index out of range warnings" if you try to use the pointer (like vertexAttribPointer)`
            )
          }

          varLocations.set(key, { kind, location: location! })
        })
        programCreated = true
      },
      use: () => {
        gl.useProgram(program)
        gl.bindVertexArray(vao)
        gl.enable(gl.SCISSOR_TEST)
      },
      setupData: (pointers: AttribPointer | AttribPointer[]): SetupData => {
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

        Array.isArray(pointers)
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
      },
    }
  }

  return {
    canvasElement: canvas,
    setupProgram,
    gl,
    loadCanvasTexture,
    loadPixelData,
    resize,
  }
}

export type WebGL = ReturnType<typeof create>
export default create
