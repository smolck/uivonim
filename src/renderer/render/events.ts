import * as dispatch from '../dispatch'

export const set_title = ([, [title]]: [any, [string]]) =>
  dispatch.pub('vim:title', title)

export const wildmenu_show = ([, [items]]: any) =>
  dispatch.pub('wildmenu.show', items)
export const wildmenu_hide = () => dispatch.pub('wildmenu.hide')
export const wildmenu_select = ([, [selected]]: [any, [number]]) => {
  dispatch.pub('wildmenu.select', selected)
}
