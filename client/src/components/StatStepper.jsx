function StatStepper({ label, value, onChange }) {
  return (
    <div className="stepper-row">
      <span>{label}</span>
      <div className="stepper-controls">
        <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(0, value - 1))}>
          -
        </button>
        <span className="stepper-value">{value}</span>
        <button type="button" className="stepper-btn" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

export default StatStepper
