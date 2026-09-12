import { useEffect, useRef, useState } from 'react'

export default function CustomSelect({ placeholder, options, value, onSelect, error }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const norm = (opt) => (opt && typeof opt === 'object' ? opt : { value: opt, label: opt })
  const selected = options.map(norm).find((o) => o.value === value)

  return (
    <div className="custom-select" ref={ref}>
      <div
        className={`select-selected ${open ? 'open' : ''} ${error ? 'err' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.8rem', color: '#64748b' }} />
        <span>{selected ? selected.label : placeholder}</span>
      </div>
      <div className={`select-items ${open ? 'show' : ''}`}>
        {options.map((opt) => {
          const o = norm(opt)
          const isSel = o.value === value
          return (
            <div
              key={o.value}
              className={isSel ? 'selected' : ''}
              onClick={() => {
                onSelect(o.value)
                setOpen(false)
              }}
            >
              <i className="fa-solid fa-circle" style={{ fontSize: '0.4rem' }} />
              {o.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}