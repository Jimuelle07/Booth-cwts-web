import ParkourGame from './parkour/ParkourGame.jsx'
import BowlingGame from './bowling/BowlingGame.jsx'
import ShootingGame from './shooting-game/ShootingGame.jsx'
import DuckPondGame from './duckpond/DuckPondGame.jsx'

const registry = [
  { id: 'parkour', name: 'Parkour', component: ParkourGame },
  { id: 'bowling', name: 'Bowling', component: BowlingGame },
  { id: 'shooting', name: 'Shooting Game', component: ShootingGame },
  { id: 'duckpond', name: 'Duck Pond', component: DuckPondGame },
]

export default registry
