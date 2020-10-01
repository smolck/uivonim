'use strict'

const stuff = {
  one: 1,
  two: 2,
  three: (input) => input + 3,
}

const res = stuff.three(stuff.one)
const two = stuff.two

console.log('res', res)
console.log('two', two)
