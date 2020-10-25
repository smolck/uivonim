const feather = require('feather-icons')

type Props = {
  icon: string
  style?: any
}

export default ({ icon, style }: Props) => (
  <div
    dangerouslySetInnerHTML={{
      __html: feather.icons[icon].toSvg({ width: '1em', height: '1em' }),
    }}
    style={{
      ...style
    }}
  />
)
