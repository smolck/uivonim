import { pub, sub } from '../dispatch'
import { Invokables } from '../../common/ipc'

let { info: {
  atlas: {
    width: atlasWidth,
    height: atlasHeight,
    distanceRange,
  },
  glyphs
}, atlas: atlasBuf } = window.api.initialAtlas()

// TODO(smolck)
export const getAtlasBuf = () => atlasBuf

export interface AtlasChar {
  advance: number
  unicode: number
  bounds: {
    left: number
    bottom: number
    right: number
    top: number
  }
}

const boundsOrDefault = (maybeBounds?: { left: number, bottom: number, right: number, top: number }) => 
  maybeBounds ? { 
    left: maybeBounds.left / atlasWidth,
    bottom: maybeBounds.bottom / atlasHeight,
    right: maybeBounds.right / atlasWidth,
    top: maybeBounds.top / atlasHeight,
  } : { left: 0, right: 0, bottom: 0, top: 0 }

export const getAndMaybeAddChar = (charUnicode: number): AtlasChar => {
  const maybeGlyph = glyphs.find((x) => x.unicode === charUnicode)
  if (!maybeGlyph) {
    // handle stuff
    console.log('dont have char: ', String.fromCharCode(charUnicode))
    /*window.api.invoke(Invokables.regenFontAtlas).then((newAtlas: Uint8Array) => {
      atlasBuf = newAtlas
      pub('font-atlas.updated', newAtlas)
    })*/
  }

  const bounds = boundsOrDefault(maybeGlyph?.atlasBounds)
  return {
    advance: maybeGlyph ? maybeGlyph.advance : 0,
    unicode: charUnicode,
    bounds
  }
}

export const getCharFromUnicode = (unicode: number): AtlasChar | undefined => {
  const maybeGlyph = glyphs.find((x) => x.unicode === unicode)
  if (maybeGlyph) {
    return {
      advance: maybeGlyph.advance,
      unicode,
      bounds: boundsOrDefault(maybeGlyph.atlasBounds)
    }
  }
}

sub('workspace.font.changed', async ({ face }: { face: string }) => {
  atlasBuf = await window.api.invoke(Invokables.regenFontAtlas)
  console.log('face bruh ', face)
  // do stuff
})
