#version 300 es
in vec2 quadVertex;
in vec2 cellPosition;
in float hlid;
in float isSecondHalfOfDoubleWidthCell;

in vec2 texCoords;

uniform vec2 canvasResolution;
uniform vec2 colorAtlasResolution;
uniform vec2 cellSize;
uniform vec2 cellPadding;
uniform sampler2D colorAtlasTextureId;

uniform vec4 cursorColor;
uniform vec2 cursorPosition;
uniform bool shouldShowCursor;
uniform int cursorShape;

out vec2 o_texCoords;
out vec4 o_color;

void main() {
  vec2 prevCellPos = vec2(cellPosition.x - 1.0, cellPosition.y);
  bool colorSecondHalfOfDoubleWidthCell = isSecondHalfOfDoubleWidthCell == 1.0 && cursorPosition == prevCellPos && cursorShape == 0;
  bool isCursorCell = (colorSecondHalfOfDoubleWidthCell || cursorPosition == cellPosition) && shouldShowCursor;

  vec2 vertexPosition = (cellPosition * cellSize) + quadVertex + cellPadding;
  vec2 posFloat = vertexPosition / canvasResolution;
  gl_Position = vec4(posFloat.x * 2.0 - 1.0, posFloat.y * -2.0 + 1.0, 0, 1);

  vec2 normalizedQuadVertex = quadVertex;
  o_texCoords = texCoords;

  float texelSize = 2.0;
  float color_x = hlid * texelSize + 1.0;
  float color_y = 1.0 * texelSize + 1.0;
  vec2 colorPosition = vec2(color_x, color_y) / colorAtlasResolution;

  vec4 textureColor = texture(colorAtlasTextureId, colorPosition);

  if (isCursorCell && cursorShape == 0) {
    o_color = cursorColor;
  } else {
    o_color = textureColor;
  }
}
