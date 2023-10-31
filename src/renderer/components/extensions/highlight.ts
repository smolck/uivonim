import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

// See example in https://www.npmjs.com/package/marked-highlight
const marked = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    })
  );

export const stringToMarkdown = (s: string): string =>
    // @ts-ignore the above `marked` isn't async but the parse has a return
    // type of string | Promise<string> just in case so TS is annoyed
    marked.parse(s)