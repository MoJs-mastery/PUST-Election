export default function Pager({ page, totalPages, onPage, total, pageSize }) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  const pages = []
  const show = (p) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p)
  }
  show(1)
  show(totalPages)
  for (let p = page - 2; p <= page + 2; p++) show(p)
  pages.sort((a, b) => a - b)

  return (
    <div className="pager">
      <span className="pager-info">
        Showing {start}–{end} of {total}
      </span>
      <div className="pager-btns">
        <button className="pager-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <i className="fa-solid fa-chevron-left" />
        </button>
        {pages.map((p, i) => (
          <span key={p} style={{ display: 'contents' }}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="pager-info" style={{ padding: '0 2px' }}>…</span>}
            <button
              className={`pager-btn ${p === page ? 'active' : ''}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          </span>
        ))}
        <button className="pager-btn" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
    </div>
  )
}
