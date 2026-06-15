import PongGame from './pong/PongGame.jsx'
import MazeGame from './maze/MazeGame.jsx'
import BowlingGame from './bowling/BowlingGame.jsx'

const registry = [
  { id: 'pong', name: 'Pong', component: PongGame },
  { id: 'maze', name: 'Maze', component: MazeGame },
  { id: 'bowling', name: 'Bowling', component: BowlingGame },
]

export default registry
