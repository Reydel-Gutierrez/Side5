function PageHeader({ title, subtitle, rightContent }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="meta">{subtitle}</p> : null}
      </div>
      {rightContent ? <div>{rightContent}</div> : null}
    </header>
  )
}

export default PageHeader
