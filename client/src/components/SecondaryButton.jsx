function SecondaryButton({ children, type = 'button', onClick, disabled = false, className = '' }) {
  return (
    <button type={type} className={`btn btn-secondary ${className}`.trim()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default SecondaryButton
