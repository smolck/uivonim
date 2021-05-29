pub mod types;
use crate::font_atlas::FontAtlas;
use crate::grid::Grid;
use crate::webgl::types::*;

use luminance::{
    backend::texture::Texture as TextureBackend, texture::Texture, Semantics, UniformInterface,
};

use luminance_front::{
    context::GraphicsContext,
    pipeline::{PipelineState, TextureBinding},
    pixel::{NormRGB8UI, NormRGBA8UI, NormUnsigned},
    render_state::RenderState,
    shader::Program,
    tess::{Interleaved, Mode, Tess},
    texture::Dim2,
};
use luminance_web_sys::WebSysWebGL2Surface;
use luminance_webgl::webgl2::WebGL2;
use wasm_bindgen::prelude::*;

use web_sys::{Document, WebGl2RenderingContext};

const VS: &'static str = include_str!("vs.glsl");
const FS: &'static str = include_str!("fs.glsl");

#[wasm_bindgen]
pub struct Scene {
    surface: WebSysWebGL2Surface,
    program: Program<Semantics, (), ShaderInterface>,
    tex: Texture<WebGL2, Dim2, NormRGB8UI>,

    font_atlas: FontAtlas,
    // TODO(smolck): Multigrid
    grid: Grid,
}

#[wasm_bindgen]
impl Scene {
    pub fn new(canvas_name: &str) -> Scene {
        let mut surface = WebSysWebGL2Surface::new(canvas_name).expect("web-sys surface");

        // TODO(smolck): Font atlas width & height things, and font, stuff.
        let font_atlas = FontAtlas::new("16px monospace", "font-atlas", 500, 500);
        let initial_tex = font_atlas.to_tex(&mut surface);

        let program = surface
            .new_shader_program::<Semantics, (), ShaderInterface>()
            .from_strings(VS, None, None, FS)
            .expect("program creation")
            .ignore_warnings();

        Scene {
            surface,
            program,
            tex: initial_tex,
            font_atlas,
            grid: Grid::new(),
        }
    }

    #[wasm_bindgen]
    pub fn force_regen_font_atlas(&mut self) {
        self.font_atlas.force_regen();
        self.tex = self.font_atlas.to_tex(&mut self.surface);
    }

    #[wasm_bindgen]
    pub fn grid_line(&mut self, data: &JsValue) -> Result<(), JsValue> {
        self.grid.handle_grid_line(&data)
    }

    #[wasm_bindgen]
    pub fn render(&mut self) {
        let Scene {
            ref mut surface,
            ref mut program,
            ref mut tex,
            ..
        } = self;

        let back_buffer = surface.back_buffer().unwrap();

        let tess: Tess<Vertex, (), (), Interleaved> = surface
            .new_tess()
            .set_vertices::<Vertex, _>([]) // TODO(smolck)
            .set_mode(Mode::Triangle)
            .build()
            .unwrap();

        self.surface
            .new_pipeline_gate()
            .pipeline(
                &back_buffer,
                &PipelineState::default().set_clear_color([0.2, 0.2, 0.2, 1.0]),
                |pipeline, mut shd_gate| {
                    let bound_tex = pipeline.bind_texture(tex)?;

                    // Start shading with our program.
                    shd_gate.shade(program, |mut iface, uni, mut rdr_gate| {
                        iface.set(&uni.font_atlas, bound_tex.binding());
                        iface.set(&uni.fg_color, [1., 1., 1., 1.]);
                        // iface.set(&uni.time, t);

                        // Start rendering things with the default render state provided by luminance.
                        rdr_gate.render(&RenderState::default(), |mut tess_gate| {
                            tess_gate.render(&tess)
                        })
                    })
                },
            )
            .assume()
            .into_result()
            .unwrap()
    }
}
