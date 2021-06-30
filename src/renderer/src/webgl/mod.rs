use luminance::{
    Semantics, UniformInterface, Vertex,
    backend::texture::Texture as TextureBackend,
    texture::Texture,
};
use std::convert::TryInto;

use luminance_front::{
    context::GraphicsContext,
    pipeline::{PipelineState, TextureBinding},
    pixel::{NormRGBA8UI, NormRGB8UI, NormUnsigned},
    render_state::RenderState,
    shader::Program,
    shader::Uniform,
    tess::{Interleaved, Mode, Tess},
    texture::{Dim2, GenMipmaps, Sampler, /*Texture,*/ MagFilter, MinFilter},
};
use luminance_webgl::webgl2::WebGL2;
use luminance_web_sys::WebSysWebGL2Surface;
use wasm_bindgen::prelude::*;

use web_sys::{Document, WebGl2RenderingContext};

const VS: &'static str = include_str!("vs.glsl");
const FS: &'static str = include_str!("fs.glsl");

const IMAGE: &[u8; 3664] = include_bytes!("atlas.png");

#[derive(Clone, Copy, Debug, Eq, PartialEq, Semantics)]
pub enum Semantics {
    #[sem(name = "v_position", repr = "[f32; 2]", wrapper = "VertexPosition")]
    Position,
    #[sem(name = "v_texCoords", repr = "[f32; 2]", wrapper = "VertexTexCoords")]
    TexCoords,
}

#[derive(Debug, UniformInterface)]
struct ShaderInterface {
    // #[uniform(unbound)]
    //time: Uniform<f32>,
    // #[uniform(unbound, name = "viewProjectionMatrix")]
    // view_projection_matrix: Uniform<[[f32; 4]; 4]>,
    // #[uniform(unbound, name = "modelMatrix")]
    // model_matrix: Uniform<[[f32; 4]; 4]>,
    #[uniform(unbound, name = "fontAtlas")]
    font_atlas: Uniform<TextureBinding<Dim2, NormUnsigned>>,
    #[uniform(unbound, name = "bgColor")]
    bg_color: Uniform<[f32; 4]>,
    #[uniform(unbound, name = "fgColor")]
    fg_color: Uniform<[f32; 4]>,
    #[uniform(unbound, name = "screenPxRange")]
    screen_px_range: Uniform<f32>,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Vertex)]
#[vertex(sem = "Semantics")]
struct Vertex {
    #[vertex(normalized = "true")]
    v_pos: VertexPosition,
    v_tex_coords: VertexTexCoords,
}

/// A convenient type to return as opaque to JS.
#[wasm_bindgen]
pub struct Scene {
    surface: WebSysWebGL2Surface,
    program: Program<Semantics, (), ShaderInterface>,
    tess: Tess<Vertex, (), (), Interleaved>,
    width: i32,
    height: i32,
    tex: Texture<WebGL2, Dim2, NormRGB8UI>
}

fn load_tex<B>(context: &mut B, texels: &Vec<u8>, width: u32, height: u32) -> Texture<B::Backend, Dim2, NormRGB8UI>
where
    B: GraphicsContext,
    B::Backend: TextureBackend<Dim2, NormRGB8UI>,
{
    let mut sampler = Sampler::default();
    sampler.mag_filter = MagFilter::Nearest;
    sampler.min_filter = MinFilter::Nearest;

    // create the luminance texture; the third argument is the number of mipmaps we want (leave it
    // to 0 for now) and the latest is the sampler to use when sampling the texels in the
    // shader (we’ll just use the default one)
    let mut tex = Texture::new(context, [width, height], 0, Sampler::default())
        .expect("luminance texture creation");

    // the first argument disables mipmap generation (we don’t care so far)
    tex.upload_raw(GenMipmaps::No, &texels).unwrap();

    tex
}

#[wasm_bindgen]
pub fn get_scene(
    font_atlas_ctx: web_sys::CanvasRenderingContext2d,
    canvas_name: &str,
    canvas_width: i32,
    canvas_height: i32,
    font_atlas_name: &str,
) -> Scene {
    let mut surface = WebSysWebGL2Surface::new(canvas_name).expect("web-sys surface");

    // let image_data: Vec<u8> = font_atlas_ctx.get_image_data(0., 0., 100., 100.).unwrap().data().to_vec();
    let tex = load_tex(&mut surface, &IMAGE.to_vec(), 100, 100);

    let program = surface
        .new_shader_program::<Semantics, (), ShaderInterface>()
        .from_strings(VS, None, None, FS)
        .expect("program creation")
        .ignore_warnings();

    let x_start = 0.0;
    let x_end = 0.5;

    let t = 0.0;
    let b = 0.25;
    let l = 0.25;
    let r = 0.35;

    let tess = surface
        .new_tess()
        .set_vertices([
            // Left (top) quad
            Vertex::new(
                // Top right
                VertexPosition::new([x_end, 0.0]),
                VertexTexCoords::new([r, t]),
            ),
            Vertex::new(
                // Left
                VertexPosition::new([x_start, 0.0]),
                VertexTexCoords::new([l, t]),
            ),
            Vertex::new(
                // Bottom
                VertexPosition::new([x_start, -0.5]),
                VertexTexCoords::new([l, b]),
            ),
            // Right (bottom) quad
            Vertex::new(
                // Bottom (left)
                VertexPosition::new([x_start, -0.5]),
                VertexTexCoords::new([l, b]),
            ),
            Vertex::new(
                // Right
                VertexPosition::new([x_end, -0.5]),
                VertexTexCoords::new([r, b]),
            ),
            Vertex::new(
                // Top
                VertexPosition::new([x_end, 0.0]),
                VertexTexCoords::new([r, t]),
            ),
        ])
        .set_mode(Mode::Triangle)
        .build()
        .unwrap();

    Scene {
        surface,
        program,
        tex,
        tess,
        width: canvas_width,
        height: canvas_height,
    }
}

#[wasm_bindgen]
pub fn render_scene(scene: &mut Scene) {
    let Scene {
        ref mut surface,
        ref tess,
        ref mut program,
        ref mut tex,
        width,
        height,
    } = scene;

    let back_buffer = surface.back_buffer().unwrap();

    scene
        .surface
        .new_pipeline_gate()
        .pipeline(
            &back_buffer,
            &PipelineState::default().set_clear_color([0.2, 0.2, 0.2, 1.0]),
            |pipeline, mut shd_gate| {
                let bound_tex = pipeline.bind_texture(tex)?;

                // Start shading with our program.
                shd_gate.shade(program, |mut iface, uni, mut rdr_gate| {
                    iface.set(&uni.font_atlas, bound_tex.binding());
                    iface.set(&uni.bg_color, [0., 0., 0., 1.]);
                    iface.set(&uni.fg_color, [1., 1., 1., 1.]);
                    iface.set(&uni.screen_px_range, 20.);
                    // iface.set(&uni.time, t);

                    // Start rendering things with the default render state provided by luminance.
                    rdr_gate.render(&RenderState::default(), |mut tess_gate| {
                        tess_gate.render(tess.to_owned())
                    })
                })
            },
        )
        .assume()
        .into_result()
        .unwrap()
}
