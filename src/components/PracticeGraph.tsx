import { useId } from 'react'
import type { GraphSpec } from '@/data/practiceGenerators'

export function PracticeGraph({ spec }: { spec: GraphSpec }) {
  const titleId = useId()
  const width = 460
  const height = 320
  const padding = { left: 52, right: 22, top: 22, bottom: 46 }
  const xMin = Math.min(...spec.points.map(([x]) => x))
  const xMax = Math.max(...spec.points.map(([x]) => x))
  const rawYMin = Math.min(...spec.points.map(([, y]) => y))
  const rawYMax = Math.max(...spec.points.map(([, y]) => y))
  const yPadding = Math.max(1, (rawYMax - rawYMin) * 0.16)
  const yMin = rawYMin - yPadding
  const yMax = rawYMax + yPadding
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const x = (value: number) => padding.left + ((value - xMin) / Math.max(1, xMax - xMin)) * plotWidth
  const y = (value: number) => padding.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight
  const polyline = spec.points.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4).reverse()
  const formatTick = (value: number) => Math.abs(value) >= 100 ? Math.round(value).toString() : value.toFixed(1).replace('.', ',').replace(',0', '')

  return (
    <figure className="function-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>График к условию сгенерированного задания</title>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="graph-grid" x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} />
            <text className="graph-number" x={padding.left - 9} y={y(tick) + 4} textAnchor="end">{formatTick(tick)}</text>
          </g>
        ))}
        {spec.points.map(([px]) => (
          <g key={px}>
            <line className="graph-grid" x1={x(px)} y1={padding.top} x2={x(px)} y2={height - padding.bottom} />
            <text className="graph-number" x={x(px)} y={height - 22} textAnchor="middle">{px}</text>
          </g>
        ))}
        <line className="graph-axis" x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} />
        <line className="graph-axis" x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} />
        <text className="graph-label" x={width - 18} y={height - padding.bottom - 10}>x</text>
        <text className="graph-label" x={padding.left + 12} y={18}>y</text>
        <polyline className="graph-curve" points={polyline} />
        {spec.points.map(([px, py]) => <circle className="practice-graph-point" key={`${px}-${py}`} cx={x(px)} cy={y(py)} r="4" />)}
      </svg>
      <figcaption>График к условию · y = f(x)</figcaption>
    </figure>
  )
}
