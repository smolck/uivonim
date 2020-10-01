const CLASS_SPLIT = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/
const ANY = /^\.|#/
const type = (m: any): string =>
  Object.prototype.toString.call(m).slice(8, 11).toLowerCase()
const argt = (args: any[]) => (t: string) => args.find((a) => type(a) === t)
const ex = (symbol: string, parts: string[]) =>
  parts
    .map((p) => p.charAt(0) === symbol && p.substring(1, p.length))
    .filter((p) => p)
    .join(' ')

const parse = {
  selector: (selector: string): { id?: string; css?: string; tag?: string } => {
    if (!selector) return {}
    const p = selector.split(CLASS_SPLIT)
    return {
      id: ex('#', p),
      css: ex('.', p),
      tag: ANY.test(p[1]) ? 'div' : p[1] || 'div',
    }
  },

  css: (obj: any) =>
    type(obj) === 'obj'
      ? Object.keys(obj)
          .filter((k) => obj[k])
          .join(' ')
      : '',
}

export default (hyper: any) => (...a: any[]) => {
  const $ = argt(a)
  const props = $('obj') || {}
  if (props.render === false) return

  const { tag = $('fun'), id, css } = parse.selector($('str'))
  const classes = [css, props.class, parse.css(props.css)]
    .filter((c) => c)
    .join(' ')
    .trim()

  if (id) props.id = id
  if (classes) props.class = classes
  if (props.hide != null) props.style = props.style || {}
  if (props.hide != null) props.style.display = props.hide ? 'none' : undefined

  Object.assign(props, { css: undefined, render: undefined, hide: undefined })

  const notTag = argt(a.slice(1))
  return hyper(tag, props, $('arr') || notTag('str') || notTag('num'))
}
