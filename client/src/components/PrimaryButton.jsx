function PrimaryButton({ children, type = 'button', onClick, disabled = false, className = '' }) {
  return (
    <button type={type} className={`btn btn-primary ${className}`.trim()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export default PrimaryButton
