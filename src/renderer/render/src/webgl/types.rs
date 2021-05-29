use luminance::{
    pipeline::TextureBinding, pixel::NormUnsigned, shader::Uniform, texture::Dim2, Semantics,
    UniformInterface, Vertex,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Semantics)]
pub enum Semantics {
    #[sem(name = "pos", repr = "[f32; 2]", wrapper = "VertexPosition")]
    Position,
    #[sem(name = "texCoords", repr = "[f32; 2]", wrapper = "VertexTexCoords")]
    TexCoords,
}

#[derive(Debug, UniformInterface)]
pub struct ShaderInterface {
    // #[uniform(unbound)]
    //time: Uniform<f32>,
    #[uniform(unbound, name = "fontAtlas")]
    pub font_atlas: Uniform<TextureBinding<Dim2, NormUnsigned>>,
    // #[uniform(unbound, name = "bgColor")]
    // bg_color: Uniform<[f32; 4]>,
    #[uniform(unbound, name = "fgColor")]
    pub fg_color: Uniform<[f32; 4]>,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Vertex)]
#[vertex(sem = "Semantics")]
pub struct Vertex {
    #[vertex(normalized = "true")]
    pub v_pos: VertexPosition,
    pub v_tex_coords: VertexTexCoords,
}
