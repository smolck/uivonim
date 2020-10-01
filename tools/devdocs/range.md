i think the range logic will be

- if nvim end - start = 1 && lineData

```
const changes = [
  { start, end, text: '' },
  { start, end: start, text: lineData[0] + '\n' }
]
```

- if lineData

```
const changes = [
  { start, end, text: lineData.map(line => line + '\n').join('') }
]
```

otherwise, passthru, no changes

## delete

### delete line 2

- s 1/0, e 2/0, t: ''

-- s 1/0, e 2/0, t: ''

### delete line 2,3

- s 1/0, e 3/0, t: ''

-- s 1/0, e 3/0, t: ''

### delete first word on line 2

- s 1/0, e 1/6, t: ''

-- s 1/0, e 2/0, t: ' lineWithout firstWord'

## insert

### insert text on line 2

- s 1/0, e 1/0, t: 'c'

-- s 1/0, e 2/0, t: 'c restOfLine'

## paste

### paste 1 line after line 2

- s 1/{lastChar}, e 1/{lastChar}, t: '\n pastedLine'

-- s 2/0, e 2/0, t: 'pastedLine'

### paste 2 lines after line 2

- s 1/{lastChar}, e 1/{lastChar}, t: '\n pastedLine1\n pastedLine2'

-- s 2/0, e 2/0, t: 'pastedLine1', 'pastedLine2'

### paste a word on line 2

- s 1/0, e 1/0, t: 'pastedWord'

-- s 1/0, e 2/0, t: 'pastedWord restOfLine2'

## replace (select text and paste or insert)

### replace line 2 with 1 line

- s 1/0, e 2/0, t: ''
- s 1/0, e 1/0, t: 'pastedLine\n'

-- s 1/0, e 2/0, t: ''
-- s 1/0, e 1/0, t: 'pastedLine'

### replace lines 2,3 with 1 line

- s 1/0, e 3/0, t: ''
- s 1/0, e 1/0, t: 'pastedLine\n'

-- s 1/0, e 3/0, t: ''
-- s 1/0, e 1/0, t: 'pastedLine'

### replace line 2 with 2 lines

- s 1/0, e 2/0, t: ''
- s 1/0, e 1/0, t: 'pastedLine\n pastedLine2\n'

-- s 1/0, e 2/0, t: ''
-- s 1/0, e 1/0, t: 'pastedLine1', 'pastedline2'

### replace lines 2,3 with 2 lines

- s 1/0, e 3/0, t: ''
- s 1/0, e 1/0, t: 'pastedLine\n pastedLine2\n'

-- s 1/0, e 3/0, t: ''
-- s 1/0, e 1/0, t: 'pastedLine1', 'pastedLine2'

### replace first word on line 2

- s 1/0, e 1/5, t: ''
- s 1/0, e 1/0, t: 'pastedWord'

-- s 1/0, e 2/0, t: ' restOfLine withoutReplacedWord'
-- s 1/0, e 2/0, t: 'pastedWord restOfLine'
