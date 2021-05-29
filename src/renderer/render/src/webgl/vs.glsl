in vec2 pos;
in vec2 texCoords;

out vec2 o_texCoords;

void main() {
  gl_Position = vec4(pos, 0., 1.);
  o_texCoords = texCoords;
}
