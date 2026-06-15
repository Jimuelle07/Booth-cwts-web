import PongGame from './pong/PongGame.jsx'
import MazeGame from './maze/MazeGame.jsx'
import BowlingGame from './bowling/BowlingGame.jsx'
import ShootingGame from './shooting-game/ShootingGame.jsx'

const registry = [ 
  { id: 'pong', name: 'Pong', component: PongGame },
  { id: 'parkour', name: 'Parkour', component: ParkourGame },
  { id: 'bowling', name: 'Bowling', component: BowlingGame },
  { id: 'shooting', name: 'Shooting Game', component: ShootingGame },
]

export default registry
