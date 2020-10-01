const ts = require('typescript')

module.exports = () => (ctx) => (src) => {
  const visit = (node) => {
    if (
      ts.isIfStatement(node) &&
      node.expression.getText() === 'process.env.VEONIM_DEV'
    )
      return
    return ts.visitEachChild(node, visit, ctx)
  }
  return ts.visitEachChild(src, visit, ctx)
}
