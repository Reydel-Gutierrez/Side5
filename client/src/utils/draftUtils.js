export function autoBalanceTeams(players, numberOfTeams, budgetPerTeam) {
  const teams = Array.from({ length: numberOfTeams }, (_, index) => ({
    id: `auto-${index + 1}`,
    playerIds: [],
    budgetUsed: 0,
  }))

  const sortedPlayers = [...players].sort((a, b) => b.value - a.value)

  sortedPlayers.forEach((player, index) => {
    const round = Math.floor(index / numberOfTeams)
    const pickInRound = index % numberOfTeams
    const snakeIndex = round % 2 === 0 ? pickInRound : numberOfTeams - 1 - pickInRound
    const preferredTeam = teams[snakeIndex]

    const teamByBudgetFit = [...teams]
      .sort((a, b) => a.budgetUsed - b.budgetUsed)
      .find((team) => team.budgetUsed + player.value <= budgetPerTeam)

    const targetTeam =
      preferredTeam.budgetUsed + player.value <= budgetPerTeam
        ? preferredTeam
        : teamByBudgetFit ?? preferredTeam

    targetTeam.playerIds.push(player.id)
    targetTeam.budgetUsed = Number((targetTeam.budgetUsed + player.value).toFixed(1))
  })

  return teams
}
