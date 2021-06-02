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
  bool tbdNameCondition = isSecondHalfOfDoubleWidthCell == 1.0 && cursorPosition == prevCellPos && cursorShape == 0;
  bool isCursorCell = (tbdNameCondition || cursorPosition == cellPosition) && shouldShowCursor;

  vec2 absolutePixelPosition = cellPosition * cellSize;
  vec2 vertexPosition = absolutePixelPosition + quadVertex;
  vec2 posFloat = vertexPosition / canvasResolution;
  float posx = posFloat.x * 2.0 - 1.0;
  float posy = posFloat.y * -2.0 + 1.0;
  gl_Position = vec4(posx, posy, 0, 1);

  float texelSize = 2.0;
  float color_x = hlid * texelSize + 1.0;
  float color_y = hlidType * texelSize + 1.0;
  vec2 colorPosition = vec2(color_x, color_y) / colorAtlasResolution;

  bool condition;
  // TODO(smolck): I'm almost certain there's a way to do this
  // condition all in one without extra if statements, but my brain is
  // not finding it right now.
  if (cursorShape == 1) {
    condition = isCursorCell && isCursorTri == 1.0;
  } else {
    condition = isCursorCell;
  }

  if (condition) {
    o_color = cursorColor;
  } else {
    vec4 textureColor = texture(colorAtlasTextureId, colorPosition);
    o_color = textureColor;
  }
}
