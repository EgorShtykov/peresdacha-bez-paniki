import katex from 'katex'

export function MathBlock({ children, className = '' }: { children: string; className?: string }) {
  const html = katex.renderToString(children, {
    displayMode: true,
    throwOnError: false,
    strict: false,
  })

  return (
    <div
      className={`math-block overflow-x-auto py-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function InlineMath({ children }: { children: string }) {
  const html = katex.renderToString(children, {
    displayMode: false,
    throwOnError: false,
    strict: false,
  })

  return <span className="inline-math" dangerouslySetInnerHTML={{ __html: html }} />
}
