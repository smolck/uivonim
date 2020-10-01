import { diff_match_patch } from 'diff-match-patch'
const differ = new diff_match_patch()

export const patchText = (original: string, change: string) => {
  const patches = differ.patch_make(original, change)
  const [patchedText] = differ.patch_apply(patches, original)
  return patchedText
}

export const patchAllTexts = (changes: string[], original = '') =>
  changes.reduce((res, change) => {
    return patchText(res, change)
  }, original)
