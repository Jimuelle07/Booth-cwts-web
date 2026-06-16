// Circular player avatar used on the game-select screen.
//
// Shows the character's portrait when one exists (see characterImages.js);
// otherwise falls back to a generic person icon so every character still
// renders something. The colored ring + glow always reflects the character.

import { getCharacterIcon } from './characterImages'

export default function PlayerAvatar({ char, size = 104, flip = false }) {
  const image = getCharacterIcon(char.id)

  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: char.color,
        boxShadow: `0 0 30px ${char.glow}`,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={char.name}
          className="w-full h-full object-contain"
          draggable={false}
          style={{ transform: flip ? 'scaleX(-1) scale(1.6)' : 'scale(1.6)' }}
        />
      ) : (
        <span className="material-symbols-outlined text-white text-4xl" aria-hidden="true">
          person
        </span>
      )}
    </div>
  )
}
