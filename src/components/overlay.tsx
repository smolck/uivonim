interface Props {
  visible: boolean
  x: number
  y: number
  maxWidth?: number
  anchorAbove: boolean
  zIndex?: number
  children?: any
  id?: string
}

export default ($: Props) => (
  <div
    id={$.id}
    style={{
      'z-index': $.zIndex,
      display: $.visible ? 'flex' : 'none',
      height: '100%',
      width: '100%',
      'flex-flow': $.anchorAbove ? 'column-reverse' : 'column',
      position: 'absolute',
    }}
  >
    <div
      className="spacer"
      style={{ height: $.anchorAbove ? `calc(100% - ${$.y}px)` : `${$.y}px` }}
    />
    <div style={{ display: 'flex', 'flex-flow': 'row nowrap' }}>
      <div className="col" style={{ width: `${$.x}px` }} />
      <div
        style={{
          'flex-shrink': 0,
          'max-width': $.maxWidth && `${$.maxWidth}px`,
        }}
      >
        {$.children}
      </div>
    </div>
  </div>
)
