const { src, same } = require('../../util')
const m = src('common/utils')

describe('src/common/utils', () => {
  describe('parseGuifont', () => {
    const guifont = 'Iosevka Extrabold Italic:h20'

    it('should parse the height correctly', () => {
      const { size } = m.parseGuifont(guifont)
      same(size, 20)
    })

    it('should parse the font name correctly', () => {
      const { face } = m.parseGuifont(guifont)
      same(face, 'Iosevka Extrabold Italic')
    })
  })
})
