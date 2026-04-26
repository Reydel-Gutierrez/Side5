import GameCard from '../components/GameCard'
import QuickActionCard from '../components/QuickActionCard'
import ResultCard from '../components/ResultCard'
import SectionLabel from '../components/SectionLabel'
import { nextGame, recentResult } from '../data/mockData'

function Home() {
  return (
    <div className="screen home-screen">
      <header className="home-top">
        <p className="brand-sm">SIDE5</p>
        <button type="button" className="icon-btn" aria-label="Notifications">
          🔔
        </button>
      </header>

      <section className="greeting-block">
        <p className="greeting-label">Good evening,</p>
        <h1 className="greeting-name">Reydel 👋</h1>
      </section>

      <SectionLabel>NEXT GAME</SectionLabel>
      <GameCard game={nextGame} />

      <SectionLabel>QUICK ACTIONS</SectionLabel>
      <div className="quick-actions-grid">
        <QuickActionCard label="Create Session" />
        <QuickActionCard label="Join Session" />
        <QuickActionCard label="Start Draft" />
      </div>

      <SectionLabel>RECENT RESULTS</SectionLabel>
      <ResultCard result={recentResult} />
    </div>
  )
}

export default Home
