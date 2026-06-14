export function createParticleSystem() {
  return { particles: [] }
}

export function spawnDeathParticles(particleSystem, x, y) {
  const colors = ['#e74c3c', '#f39c12', '#e67e22', '#c0392b']
  for (let i = 0; i < 20; i++) {
    particleSystem.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 400,
      vy: (Math.random() - 0.5) * 400 - 150,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export function spawnFinishParticles(particleSystem, x, y) {
  const colors = ['#2ecc71', '#27ae60', '#f1c40f', '#3498db']
  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 * i) / 30
    const speed = 100 + Math.random() * 200
    particleSystem.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 0.8 + Math.random() * 0.4,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export function updateParticles(particleSystem, dt) {
  for (let i = particleSystem.particles.length - 1; i >= 0; i--) {
    const p = particleSystem.particles[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 500 * dt
    p.life -= dt
    if (p.life <= 0) {
      particleSystem.particles.splice(i, 1)
    }
  }
}

export function emitGrabContactParticles(particleSystem, x, y) {
  const colors = ['#ffffff', '#ffff00', '#ffd700', '#fff8c4']
  const count = 4 + Math.floor(Math.random() * 3) // 4-6 particles
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 60
    particleSystem.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.2 + Math.random() * 0.1,
      maxLife: 0.2 + Math.random() * 0.1,
      size: 2 + Math.random() * 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
}

export function drawParticles(ctx, camera, particleSystem) {
  for (const p of particleSystem.particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color || '#e74c3c'
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}
