import CreateWebGL from './utils'
import { VarKind } from './utils'

import { colors } from '../../render/highlight-attributes'
import { hexToRGB } from '../../ui/css'

const webgl = CreateWebGL({
  alpha: true,
  depth: false,
  stencil: false,
  antialias: false,
  preserveDrawingBuffer: false,
})

let config = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: () => {
    const [r, g, b] = hexToRGB(colors.background)
    return { r, g, b }
  },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
}

const baseVars = {
  texelSize: VarKind.Uniform,
  aPosition: VarKind.Attribute,
  uTexture: VarKind.Uniform,
}
const baseVertexShader = (v: any) => `
    precision highp float;

    attribute vec2 ${v.aPosition};
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 ${v.texelSize};

    void main () {
        vUv = ${v.aPosition} * 0.5 + 0.5;
        vL = vUv - vec2(${v.texelSize}.x, 0.0);
        vR = vUv + vec2(${v.texelSize}.x, 0.0);
        vT = vUv + vec2(0.0, ${v.texelSize}.y);
        vB = vUv - vec2(0.0, ${v.texelSize}.y);
        gl_Position = vec4(${v.aPosition}, 0.0, 1.0);
    }
`

const blurProgram = webgl.setupProgram(baseVars)

blurProgram.setVertexShader(
  (v) => `
    precision highp float;

    attribute vec2 ${v.aPosition};
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 ${v.texelSize};

    void main () {
        vUv = ${v.aPosition} * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - ${v.texelSize} * offset;
        vR = vUv + ${v.texelSize} * offset;
        gl_Position = vec4(${v.aPosition}, 0.0, 1.0);
    }
`
)
blurProgram.setFragmentShader(
  (v) => `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D ${v.uTexture};

    void main () {
        vec4 sum = texture2D(${v.uTexture}, vUv) * 0.29411764;
        sum += texture2D(${v.uTexture}, vL) * 0.35294117;
        sum += texture2D(${v.uTexture}, vR) * 0.35294117;
        gl_FragColor = sum;
    }
`
)
blurProgram.create()

const blit = (target: any, clear = false) => {
  if (target == null) {
    webgl.gl.viewport(
      0,
      0,
      webgl.gl.drawingBufferWidth,
      webgl.gl.drawingBufferHeight
    )
    webgl.gl.bindFramebuffer(webgl.gl.FRAMEBUFFER, null)
  } else {
    webgl.gl.viewport(0, 0, target.width, target.height)
    webgl.gl.bindFramebuffer(webgl.gl.FRAMEBUFFER, target.fbo)
  }

  if (clear) {
    webgl.gl.clearColor(0.0, 0.0, 0.0, 1.0)
    webgl.gl.clear(webgl.gl.COLOR_BUFFER_BIT)
  }

  webgl.gl.drawElements(webgl.gl.TRIANGLES, 6, webgl.gl.UNSIGNED_SHORT, 0)
}

const blur = (target: any, temp: any, iterations: number) => {
  blurProgram.use()
  for (let i = 0; i < iterations; i++) {
    webgl.gl.uniform2f(blurProgram.vars.texelSize, target.texelSizeX, 0.0)
    webgl.gl.uniform1i(blurProgram.vars.uTexture, target.attach(0))
    blit(temp)

    webgl.gl.uniform2f(blurProgram.vars.texelSize, 0.0, target.texelSizeY)
    webgl.gl.uniform1i(blurProgram.vars.uTexture, temp.attach(0))
    blit(target)
  }
}

const sunraysMaskProgram = webgl.setupProgram(baseVars)
sunraysMaskProgram.setVertexShader(baseVertexShader)
sunraysMaskProgram.setFragmentShader(
  (v) => `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D ${v.uTexture};

    void main () {
        vec4 c = texture2D(${v.uTexture}, vUv);
        float br = max(c.r, max(c.g, c.b));
        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
        gl_FragColor = c;
    }
`
)
sunraysMaskProgram.create()

const sunraysProgram = webgl.setupProgram({
  ...baseVars,
  weight: VarKind.Uniform,
})
sunraysProgram.setVertexShader(baseVertexShader)
sunraysProgram.setFragmentShader(
  (v) => `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D ${v.uTexture};
    uniform float ${v.weight};

    #define ITERATIONS 16

    void main () {
        float Density = 0.3;
        float Decay = 0.95;
        float Exposure = 0.7;

        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;

        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;

        float color = texture2D(${v.uTexture}, vUv).a;

        for (int i = 0; i < ITERATIONS; i++)
        {
            coord -= dir;
            float col = texture2D(${v.uTexture}, coord).a;
            color += col * illuminationDecay * ${v.weight};
            illuminationDecay *= Decay;
        }

        gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
    }
`
)

const applySunrays = (source: any, mask: any, destination: any) => {
  webgl.gl.disable(webgl.gl.BLEND)
  sunraysMaskProgram.use()
  webgl.gl.uniform1i(sunraysMaskProgram.vars.uTexture, source.attach(0))
  blit(mask)

  sunraysProgram.use()
  webgl.gl.uniform1f(sunraysProgram.vars.weight, config.SUNRAYS_WEIGHT)
  webgl.gl.uniform1i(sunraysProgram.vars.uTexture, mask.attach(0))
  blit(destination)
}

let bloomFramebuffers: any[] = []
const bloomPrefilterProgram = webgl.setupProgram({
  ...baseVars,
  curve: VarKind.Uniform,
  threshold: VarKind.Uniform,
})
bloomPrefilterProgram.setVertexShader(baseVertexShader)
bloomPrefilterProgram.setFragmentShader(
  (v) => `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    uniform sampler2D ${v.uTexture};
    uniform vec3 ${v.curve};
    uniform float ${v.threshold};

    void main () {
        vec3 c = texture2D(${v.uTexture}, vUv).rgb;
        float br = max(c.r, max(c.g, c.b));
        float rq = clamp(br - ${v.curve}.x, 0.0, ${v.curve}.y);
        rq = ${v.curve}.z * rq * rq;
        c *= max(rq, br - ${v.threshold}) / max(br, 0.0001);
        gl_FragColor = vec4(c, 0.0);
    }
`
)
bloomPrefilterProgram.create()

const bloomBlurProgram = webgl.setupProgram(baseVars)
bloomBlurProgram.setVertexShader(baseVertexShader)
bloomBlurProgram.setFragmentShader(
  (v) => `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D ${v.uTexture};

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(${v.uTexture}, vL);
        sum += texture2D(${v.uTexture}, vR);
        sum += texture2D(${v.uTexture}, vT);
        sum += texture2D(${v.uTexture}, vB);
        sum *= 0.25;
        gl_FragColor = sum;
    }

`
)
bloomBlurProgram.create()

const bloomFinalProgram = webgl.setupProgram({
  ...baseVars,
  intensity: VarKind.Uniform,
})
bloomFinalProgram.setVertexShader(baseVertexShader)
bloomFinalProgram.setFragmentShader(
  (v) => `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D ${v.uTexture};
    uniform float ${v.intensity};

    void main () {
        vec4 sum = vec4(0.0);
        sum += texture2D(${v.uTexture}, vL);
        sum += texture2D(${v.uTexture}, vR);
        sum += texture2D(${v.uTexture}, vT);
        sum += texture2D(${v.uTexture}, vB);
        sum *= 0.25;
        gl_FragColor = sum * ${v.intensity};
    }
`
)
bloomFinalProgram.create()

const applyBloom = (source: any, destination: any) => {
  if (bloomFramebuffers.length < 2) return

  let last = destination

  webgl.gl.disable(webgl.gl.BLEND)
  bloomPrefilterProgram.use()
  let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001
  let curve0 = config.BLOOM_THRESHOLD - knee
  let curve1 = knee * 2
  let curve2 = 0.25 / knee
  webgl.gl.uniform3f(bloomPrefilterProgram.vars.curve, curve0, curve1, curve2)
  webgl.gl.uniform1f(
    bloomPrefilterProgram.vars.threshold,
    config.BLOOM_THRESHOLD
  )
  webgl.gl.uniform1i(bloomPrefilterProgram.vars.uTexture, source.attach(0))
  blit(last)

  bloomBlurProgram.use()
  for (let i = 0; i < bloomFramebuffers.length; i++) {
    let dest = bloomFramebuffers[i]
    webgl.gl.uniform2f(
      bloomBlurProgram.vars.texelSize,
      last.texelSizeX,
      last.texelSizeY
    )
    webgl.gl.uniform1i(bloomBlurProgram.vars.uTexture, last.attach(0))
    blit(dest)
    last = dest
  }

  webgl.gl.blendFunc(webgl.gl.ONE, webgl.gl.ONE)
  webgl.gl.enable(webgl.gl.BLEND)

  for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
    let baseTex = bloomFramebuffers[i]
    webgl.gl.uniform2f(
      bloomBlurProgram.vars.texelSize,
      last.texelSizeX,
      last.texelSizeY
    )
    webgl.gl.uniform1i(bloomBlurProgram.vars.uTexture, last.attach(0))
    webgl.gl.viewport(0, 0, baseTex.width, baseTex.height)
    blit(baseTex)
    last = baseTex
  }

  webgl.gl.disable(webgl.gl.BLEND)
  bloomFinalProgram.use()
  webgl.gl.uniform2f(
    bloomFinalProgram.vars.texelSize,
    last.texelSizeX,
    last.texelSizeY
  )
  webgl.gl.uniform1i(bloomFinalProgram.vars.uTexture, last.attach(0))
  webgl.gl.uniform1f(bloomFinalProgram.vars.intensity, config.BLOOM_INTENSITY)
  blit(destination)
}
