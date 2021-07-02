#version 300 es
precision mediump float;

in vec2 o_glyphPosition;
in vec4 o_color;
uniform sampler2D fontAtlasTextureId;

out vec4 outColor;

void main() {
  vec4 glyphColor = texture(fontAtlasTextureId, o_glyphPosition);
  outColor = glyphColor * o_color;
}
