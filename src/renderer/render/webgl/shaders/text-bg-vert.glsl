#version 300 es
in vec2 quadVertex;
in vec2 cellPosition;
in float isCursorTri;
in float hlid;
in float isSecondHalfOfDoubleWidthCell;
uniform vec2 cursorPosition;
uniform vec2 canvasResolution;
uniform vec2 colorAtlasResolution;
uniform vec2 cellSize;
uniform vec4 cursorColor;
uniform bool shouldShowCursor;
uniform int cursorShape;
uniform float hlidType;
uniform sampler2D colorAtlasTextureId;
out vec4 o_color;
out vec2 o_colorPosition;

void main() {
  vec2 prevCellPos = vec2(cellPosition.x - 1.0, cellPosition.y);
  bool colorInSecondHalfOfDoubleWidthCell = isSecondHalfOfDoubleWidthCell == 1.0 && cursorPosition == prevCellPos && cursorShape == 0;
  bool isCursorCell = (colorInSecondHalfOfDoubleWidthCell || cursorPosition == cellPosition) && shouldShowCursor;

  vec2 vertexPosition = (cellPosition * cellSize) + quadVertex;
  vec2 posFloat = vertexPosition / canvasResolution;
  gl_Position = vec4(posFloat.x * 2.0 - 1.0, posFloat.y * -2.0 + 1.0, 0, 1);

  float texelSize = 2.0;
  float color_x = hlid * texelSize + 1.0;
  float color_y = hlidType * texelSize + 1.0;
  vec2 colorPosition = vec2(color_x, color_y) / colorAtlasResolution;

  // If cursor is a line (1; see `CursorShape` in src/common/types.ts), then
  // check if we're in the cursor cell and if we should color in this triangle;
  // otherwise, just check if we're in the cursor cell.
  if (cursorShape == 1 ? isCursorCell && isCursorTri == 1.0 : isCursorCell) {
    o_color = cursorColor;
  } else {
    vec4 textureColor = texture(colorAtlasTextureId, colorPosition);
    o_color = textureColor;
  }
}
