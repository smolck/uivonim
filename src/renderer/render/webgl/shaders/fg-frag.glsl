precision mediump float;

varying /* in */ vec2 o_glyphPosition;
varying /* in */ vec4 o_color;

uniform sampler2D fontAtlasTextureId;

void main() {
  vec4 glyphColor = texture2D(fontAtlasTextureId, o_glyphPosition);
  gl_FragColor = glyphColor * o_color;
}
