/// <reference types="@webgpu/types" />

export default async (canvas: HTMLCanvasElement) => {
  // @ts-ignore
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return

  const device = await adapter.requestDevice()
  if (!device) return
  
  const ctx = canvas.getContext('gpupresent') 
  if (!ctx) return

  const swapChainFormat = await ctx.getSwapChainPreferredFormat(device);
  const swapChain = ctx.configureSwapChain({
    device,
    format: swapChainFormat
  })

  const renderBufferStride = 4 * Float32Array.BYTES_PER_ELEMENT

  const foregroundPipeline = device.createRenderPipeline({
    vertexStage: {
      module: device.createShaderModule({
        code: `
        [[location(0)]] var<in> quadVertex : vec2<f32>;

        [[location(1)]] var<in> cellPosition : vec2<f32>;
        [[location(2)]] var<in> hlId : f32;
        [[location(3)]] var<in> charIndex : f32;

        [[block]] struct Uniforms {
          canvasResolution : vec2<f32>;
          fontAtlasResolution : vec2<f32>;
          colorAtlasResolution : vec2<f32>;

          colorAtlasSampler : sampler;
          colorAtlasTexture : texture2D;
        }
        `
      }),
      entryPoint: 'main'
    },
    fragmentStage: {
      module: device.createShaderModule({
        code: `
        `,
      }),
      entryPoint: 'main'
    },
    // TODO(smolck)
    primitiveTopology: 'triangle-list',
    colorStates: [
      {
        format: swapChainFormat
      }
    ],
    vertexState: {
      vertexBuffers: [
        // Render buffer (cells)
        {
          arrayStride: renderBufferStride,
          stepMode: 'vertex',
          attributes: [
            // cellPosition
            { shaderLocation: 1, offset: 0, format: 'float32x2' },
            // hlId
            { shaderLocation: 2, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: 'float32' },
            // charIndex
            { shaderLocation: 3, offset: 3 * Float32Array.BYTES_PER_ELEMENT, format: 'float32' },
          ]
        },
        // Quad Buffer
        {
          arrayStride: 0,
          // TODO(smolck): ?
          stepMode: 'vertex',
          attributes: [
            {
              // quadVertex
              shaderLocation: 0, offset: 0, format: 'float32x2'
            }
          ]
        },
      ]
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              // TODO(smolck)
              visibility: GPUShaderStage.VERTEX,
              type: 'uniform-buffer',
              // TODO(smolck): minBufferBindingSize = ?
            }
          ]
        })
      ]
    })
  })

  const render = (buffer: Float32Array) => {
    // const commandEncoder
  }

  console.log(adapter, device, ctx)
}
