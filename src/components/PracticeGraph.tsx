import { useId } from 'react'
import type { GraphSpec } from '@/data/practiceGenerators'

export function PracticeGraph({ spec }: { spec: GraphSpec }) {
  const titleId = useId()
  const width = 400
  const height = 330
  const left = 30
  const right = 372
  const top = 18
  const bottom = 296
  const xMin = -4.5
  const xMax = 4.5
  const values = spec.points.map((point) => point[1])
  const yMin = Math.min(-1, Math.floor(Math.min(...values) - 0.7))
  const yMax = Math.max(1, Math.ceil(Math.max(...values) + 0.7))
  const sx = (x: number) => left + ((x - xMin) / (xMax - xMin)) * (right - left)
  const sy = (y: number) => bottom - ((y - yMin) / (yMax - yMin)) * (bottom - top)
  const point = (x: number, y: number) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`
  const path = spec.points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${point(x, y)}`).join(' ')
  const yTicks = Array.from({ length: yMax - yMin + 1 }, (_, index) => yMin + index)

  return (
    <figure className="function-graph" aria-label="График сгенерированной функции">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>График функции y = f(x) с новыми параметрами</title>
        <rect x="0" y="0" width={width} height={height} fill="var(--graph-bg)" />
        {Array.from({ length: 9 }, (_, index) => index - 4).map((x) => (
          <line key={`gx-${x}`} x1={sx(x)} y1={top} x2={sx(x)} y2={bottom} className="graph-grid" />
        ))}
        {yTicks.map((y) => (
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
        <path d={path} className="graph-curve" />
        {spec.points.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={sx(x)} cy={sy(y)} r="3.2" className="practice-graph-point" />
        ))}
      </svg>
      <figcaption>y = f(x)</figcaption>
    </figure>
  )
}
