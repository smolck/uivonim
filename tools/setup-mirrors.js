#! /usr/bin/env node
const { $, go, run, fromRoot } = require('./runner')
const fs = require('fs-extra')
const pkgPath = fromRoot('package.json')
const pkg = require(pkgPath)

const mirrors = Reflect.get(pkg, 'repository-mirrors')

go(async () => {
  if (!mirrors || !mirrors.length) return
  $`setting up git mirrors`

  for (const mirror of mirrors) {
    await run(`git remote set-url origin --push --add ${mirror}`)
  }

  $`enchanted mirror who is the fairest of them all?`
})
