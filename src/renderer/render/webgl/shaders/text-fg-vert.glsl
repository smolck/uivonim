#version 300 es
in vec2 quadVertex;
in vec2 cellPosition;
in float hlid;
in vec2 atlasBounds;
in float isSecondHalfOfDoubleWidthCell;

uniform vec2 canvasResolution;
uniform vec2 fontAtlasResolution;
uniform vec2 colorAtlasResolution;
uniform vec2 cellSize;
uniform vec2 cellPadding;
uniform sampler2D colorAtlasTextureId;

uniform vec4 cursorColor;
uniform vec2 cursorPosition;
uniform bool shouldShowCursor;
uniform int cursorShape;

out vec2 o_glyphPosition;
out vec4 o_color;

void main() {
  vec2 prevCellPos = vec2(cellPosition.x - 1.0, cellPosition.y);
  bool tbdNameCondition = isSecondHalfOfDoubleWidthCell == 1.0 && cursorPosition == prevCellPos && cursorShape == 0;
  bool isCursorCell = (tbdNameCondition || cursorPosition == cellPosition) && shouldShowCursor;

  vec2 absolutePixelPosition = cellPosition * cellSize;
  vec2 vertexPosition = absolutePixelPosition + quadVertex + cellPadding;
  vec2 posFloat = vertexPosition / canvasResolution;
  float posx = posFloat.x * 2.0 - 1.0;
  float posy = posFloat.y * -2.0 + 1.0;
  gl_Position = vec4(posx, posy, 0, 1);

  o_glyphPosition = (atlasBounds + quadVertex) / fontAtlasResolution;

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
