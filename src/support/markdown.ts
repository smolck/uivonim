export { colorizeMarkdownToHTML as markdownToHTML } from '../services/colorizer'

interface MarkdownOptions {
  listUnicodeChar?: boolean
  stripListLeaders?: boolean
  githubFlavoredMarkdown?: boolean
}

const doStripListLeaders = (text: string, listUnicodeChar: boolean) =>
  listUnicodeChar
    ? text.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, `${listUnicodeChar} $1`)
    : text.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1')

const doGithubMarkdown = (text: string) =>
  text
    .replace(/\n={2,}/g, '\n') // header
    .replace(/~~/g, '') //strikethrough
    .replace(/`{3}.*\n/g, '') // fenced codeblocks

// typescript/es-next version of stiang/remove-markdown
export const remove = (markdown = '', options = {} as MarkdownOptions) => {
  const {
    listUnicodeChar = false,
    stripListLeaders = true,
    githubFlavoredMarkdown = true,
  } = options

  // remove horizontal rules (stripListLeaders conflict with this rule,
  // which is why it has been moved to the top)
  const out1 = markdown.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, '')

  try {
    const out2 = stripListLeaders
      ? doStripListLeaders(out1, listUnicodeChar)
      : out1
    const out3 = githubFlavoredMarkdown ? doGithubMarkdown(out2) : out2
    return out3
      .replace(/<[^>]*>/g, '') // html tags
      .replace(/^[=\-]{2,}\s*$/g, '') // setext-style headers
      .replace(/\[\^.+?\](\: .*?$)?/g, '') // footnotes?
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      .replace(/\!\[.*?\][\[\(].*?[\]\)]/g, '') // images
      .replace(/\[(.*?)\][\[\(].*?[\]\)]/g, '$1') // inline links
      .replace(/^\s{0,3}>\s?/g, '') // blockquotes
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '') // reference-style links
      .replace(
        /^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm,
        '$1$2$3'
      ) // atx-style headers
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2') // emphasis
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/(`{3,})(.*?)\1/gm, '$2') // code blocks
      .replace(/`(.+?)`/g, '$1') // inline code
      .replace(/\n{2,}/g, '\n\n') // 2+ newlines with 2 newlines. why?
  } catch (err) {
    console.error(err)
    return markdown
  }
}
