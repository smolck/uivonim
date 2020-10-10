type Props = {
    iconHtml: string
    style?: any
}

export default ({ iconHtml, style }: Props) => (
    <div dangerouslySetInnerHTML={{ __html: iconHtml }} style={style} />
)
