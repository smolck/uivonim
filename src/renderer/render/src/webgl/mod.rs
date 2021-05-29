pub mod types;
use crate::font_atlas::FontAtlas;
use crate::grid::Grid;
use crate::webgl::types::*;
use std::collections::HashMap;
use js_sys::Reflect;

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
    grids: HashMap<u64, Grid>,
    active_grid: u64,
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
            active_grid: 0, // TODO(smolck)
            surface,
            program,
            tex: initial_tex,
            font_atlas,
            grids: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn force_regen_font_atlas(&mut self) {
        self.font_atlas.force_regen();
        self.tex = self.font_atlas.to_tex(&mut self.surface);
    }

    #[wasm_bindgen]
    pub fn maybe_regen_font_atlas(&mut self) {
        self.font_atlas.maybe_regen();
    }

    #[wasm_bindgen]
    pub fn handle_grid_line(&mut self, data: &JsValue) -> Result<(), JsValue> {
        for evt in js_sys::try_iter(data)?.expect("hey this should be iterable please") {
            let evt = evt?;
            let grid_id = Reflect::get(&evt, &JsValue::from(0))
                .unwrap()
                .as_f64()
                .unwrap() as u64;
            let row = Reflect::get(&evt, &JsValue::from(1))
                .unwrap()
                .as_f64()
                .unwrap() as u32;
            let col_start = Reflect::get(&evt, &JsValue::from(2))
                .unwrap()
                .as_f64()
                .unwrap() as u32;

            self.grids
                .get_mut(&grid_id)
                .expect("Umm yeah there should be this grid")
                .handle_single_grid_line(row, col_start, &evt)?;
        }

        Ok(())
    }

    #[wasm_bindgen]
    pub fn handle_grid_resize(&mut self, grid_id: u64, width: u32, height: u32) {
        if let Some(grid) = self.grids.get_mut(&grid_id) {
            grid.resize(width as usize, height as usize);
        } else {
            self.grids.insert(grid_id, Grid::new_with_dimensions(width, height));
        }
    }

    #[wasm_bindgen]
    pub fn render(&mut self) {
        let (width, height) = {
            (
                self.surface.canvas.width() as f32,
                self.surface.canvas.height() as f32,
            )
        };
        let Scene {
            ref mut surface,
            ref mut program,
            ref mut tex,
            ref mut font_atlas,
            ref active_grid,
            ..
        } = self;

        let back_buffer = surface.back_buffer().unwrap();

        let tess: Tess<Vertex, (), (), Interleaved> = surface
            .new_tess()
            .set_vertices::<Vertex, _>(
                self.grids
                    .get_mut(active_grid)
                    .unwrap()
                    .to_vertices(font_atlas, width, height)
                    .as_slice(),
            ) // TODO(smolck)
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
