function PlayerRow({ player, rightContent, onClick }) {
  const content = (
    <>
      <div className="player-row-main">
        <div className="avatar">{player.initials}</div>
        <div>
          <p className="player-name">{player.name}</p>
          <p className="meta">
            {player.position} • ${player.value.toFixed(1)}M
          </p>
        </div>
      </div>
      {rightContent ? <div>{rightContent}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="player-row" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="player-row">{content}</div>
}

export default PlayerRow
