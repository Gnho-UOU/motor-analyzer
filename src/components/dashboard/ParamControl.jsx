export function ParamControl({ config, value, onChange }) {
  const id = `param-${config.key}`
  const unit = config.key === 'loadPercent' ? '%' : config.unit

  return (
    <label className="param-control" htmlFor={id}>
      <span className="param-copy">
        <span className="param-label">{config.label}</span>
        <span className="param-subtitle">{config.subtitle}</span>
      </span>
      <span className="param-input-row">
        <input
          className="param-slider"
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(event) => onChange(config.key, event.target.value)}
        />
        <span className="param-number-wrap">
          <input
            id={id}
            className="param-number"
          type="number"
          min={config.inputMin ?? config.min}
          max={config.inputMax ?? config.max}
          step={config.step}
            value={value}
            onChange={(event) => onChange(config.key, event.target.value)}
          />
          <span className="param-unit">{unit}</span>
        </span>
      </span>
    </label>
  )
}

