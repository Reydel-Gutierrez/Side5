function PageHeader({ title, subtitle, rightContent, titleClassName = '' }) {
  return (
    <header className="page-header">
      <div>
        <h1 className={`page-title ${titleClassName}`.trim()}>{title}</h1>
        {subtitle ? <p className="meta">{subtitle}</p> : null}
      </div>
      {rightContent ? <div>{rightContent}</div> : null}
    </header>
  )
}

export default PageHeader
