import { fromJSON, readFile, exists } from '../support/utils'

const localize = (lang: any) => (value: string) => {
  // assumes that the entire value is a label. aka % at beginning
  // and end. this is from observations of package.nls.json
  const [, /*match*/ key = ''] = value.match(/^%(.*?)%$/) || []
  return Reflect.get(lang, key)
}

export default async (languageFilePath: string) => {
  const languageFileExists = await exists(languageFilePath)
  if (!languageFileExists) return (value: string) => value

  const languageRaw = await readFile(languageFilePath)
  const languageData = fromJSON(languageRaw).or({})
  return localize(languageData)
}
