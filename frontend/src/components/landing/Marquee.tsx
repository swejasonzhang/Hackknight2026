/** A continuously scrolling strip; duplicated once so the loop is seamless. Static under reduced motion. */
export function Marquee({ items }: { items: string[] }) {
  const list = [...items, ...items]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {list.map((t, i) => (
          <span key={i} className="marquee-item">
            {t}
            <span className="marquee-dot">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
