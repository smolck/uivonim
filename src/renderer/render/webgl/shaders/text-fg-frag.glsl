#version 300 es
precision mediump float;

in vec2 o_glyphPosition;
in vec4 o_color;
uniform sampler2D fontAtlasTextureId;

out vec4 outColor;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  // vec4 glyphColor = texture(fontAtlasTextureId, o_glyphPosition);
  // outColor = vec4((glyphColor * o_color).rgb, 1.); ;
  vec3 msd = texture(fontAtlasTextureId, o_glyphPosition).rgb;
  float sd = median(msd.r, msd.g, msd.b);
  float screenPxDistance = 10.0*(sd - 0.5);
  float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);

  vec4 bgColor = vec4(0., 0., 0., 1.);
  // outColor = vec4(texture(fontAtlasTextureId, o_glyphPosition).rgb, 1.);
  outColor = mix(bgColor, o_color, opacity);
  // outColor = vec4(0., 1., 1., 1.);
  // outColor = vec4(c.r, c.g * sin(time / 4), c.b, 1.);
}
