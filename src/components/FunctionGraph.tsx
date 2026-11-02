export function FunctionGraph({ variant }: { variant: 1 | 2 | 3 | 4 }) {
  const width = 400
  const height = 330
  const left = 28
  const right = 372
  const top = 18
  const bottom = 296
  const xMin = -4.5
  const xMax = 4.5
  const yMin = -3.5
  const yMax = 4.7
  const sx = (x: number) => left + ((x - xMin) / (xMax - xMin)) * (right - left)
  const sy = (y: number) => bottom - ((y - yMin) / (yMax - yMin)) * (bottom - top)
  const p = (x: number, y: number) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`

  return (
    <figure className="function-graph" aria-label={`График функции для варианта ${variant}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`graph-title-${variant}`}>
        <title id={`graph-title-${variant}`}>График функции y = f(x), вариант {variant}</title>
        <rect x="0" y="0" width={width} height={height} fill="var(--graph-bg)" />
        {Array.from({ length: 10 }, (_, i) => i - 4).map((x) => (
          <line key={`gx-${x}`} x1={sx(x)} y1={top} x2={sx(x)} y2={bottom} className="graph-grid" />
        ))}
        {Array.from({ length: 9 }, (_, i) => i - 3).map((y) => (
          <line key={`gy-${y}`} x1={left} y1={sy(y)} x2={right} y2={sy(y)} className="graph-grid" />
        ))}
        <line x1={left} y1={sy(0)} x2={right + 7} y2={sy(0)} className="graph-axis" />
        <line x1={sx(0)} y1={bottom + 8} x2={sx(0)} y2={top - 4} className="graph-axis" />
        <path d={`M ${right + 7},${sy(0)} l -7,-4 l 0,8 z`} className="graph-axis-fill" />
        <path d={`M ${sx(0)},${top - 4} l -4,7 l 8,0 z`} className="graph-axis-fill" />
        <text x={right - 1} y={sy(0) + 25} className="graph-label">x</text>
        <text x={sx(0) - 20} y={top + 6} className="graph-label">y</text>
        <text x={sx(0) - 17} y={sy(0) + 20} className="graph-number">0</text>
        <text x={sx(1) - 4} y={sy(0) + 21} className="graph-number">1</text>
        <text x={sx(0) - 20} y={sy(1) + 5} className="graph-number">1</text>
        {variant === 1 && (
          <path
            d={`M ${p(-4, 4)} L ${p(-2, 4)} L ${p(0, -3)} L ${p(2, 4)} L ${p(4, 4)}`}
            className="graph-curve"
          />
        )}
        {variant === 3 && (
          <path
            d={`M ${p(-4, 3)} L ${p(-3, 3)} L ${p(0, -2)} L ${p(3, 3)} L ${p(4, 3)}`}
            className="graph-curve"
          />
        )}
        {variant === 2 && (
          <path
            d={`M ${p(-4, 4)} C ${p(-2.7, 3.5)} ${p(-1.15, 0.9)} ${p(0, 0)} C ${p(0.8, 0.1)} ${p(1.25, 3.85)} ${p(2, 4)} C ${p(2.8, 4.15)} ${p(3.45, 1.1)} ${p(4, 0)}`}
            className="graph-curve"
          />
        )}
        {variant === 4 && (
          <path
            d={`M ${p(-4, 3)} C ${p(-3.1, 2.7)} ${p(-2.05, 0.8)} ${p(-1, 0)} C ${p(-0.25, 0.1)} ${p(0.25, 2.9)} ${p(1, 3)} C ${p(1.8, 3.1)} ${p(2.45, 0.85)} ${p(3, 0)}`}
            className="graph-curve"
          />
        )}
      </svg>
      <figcaption>y = f(x)</figcaption>
    </figure>
  )
}
