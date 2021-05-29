precision mediump float;

in vec2 o_texCoords;

uniform vec4 fgColor;
uniform sampler2D fontAtlas;

out vec4 color;

void main() {
  color = fgColor * texture(fontAtlas, o_texCoords);
}
