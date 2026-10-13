export default function ConfirmDeleteModal({ title, description, itemName, onCancel, onConfirm, saving, confirmIcon, confirmLabel }) {
  const icon = confirmIcon || 'fa-trash'
  const label = confirmLabel || 'Delete'

  return (
    <div className="modal-overlay">
      <div className="modal-container sm">
        <div className="modal-body modal-body-center">
          <div className="delete-icon-circle">
            <i className={`fa-solid ${icon}`} />
          </div>
          <h3 className="delete-modal-title">{title}</h3>
          <p className="delete-modal-desc">
            {description}{itemName ? <> <b>{itemName}</b>?</> : ''}
          </p>
        </div>
        <div className="modal-foot modal-foot-center">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : icon}`} />
            {label}
          </button>
        </div>
      </div>
    </div>
  )
}
