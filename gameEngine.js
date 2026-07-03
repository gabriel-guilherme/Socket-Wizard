class GameEngine {
  constructor(io, matchId, playersConfig) {
    this.io = io;
    this.matchId = matchId;
    this.state = {
      players: {},
      projectiles: [],
      barriers: [],
      crystals: [],
    };

    playersConfig.forEach((p, index) => {
      this.state.players[p.id] = {
        username: p.username,
        x: 100 + index * 400,
        y: 300,
        hp: 100,
        mana: 50,
        shield: false,
        color: index === 0 ? "blue" : "red",
      };
    });

    this.loopInterval = null;
  }

  start() {
    this.io.to(this.matchId).emit("game_started");

    setInterval(() => {
      const crystalType = Math.random() < 0.8 ? "mana" : "shield";
      this.state.crystals.push({
        id: Math.random(),
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        type: crystalType,
      });
    }, 5000);

    // 60 FPS
    this.loopInterval = setInterval(() => this.update(), 1000 / 60);
  }

  handleInput(playerId, input) {
    const player = this.state.players[playerId];
    if (!player || player.hp <= 0) return;

    const checkWallCollision = (newX, newY) => {
      const pSize = 20;
      for (let b of this.state.barriers) {
        if (
          newX + pSize > b.x &&
          newX - pSize < b.x + b.width &&
          newY + pSize > b.y &&
          newY - pSize < b.y + b.height
        ) {
          return true; // colisao
        }
      }
      return false;
    };

    let nextX = player.x;
    let nextY = player.y;

    if (input.keys.w) nextY -= 5;
    if (input.keys.s) nextY += 5;
    if (!checkWallCollision(player.x, nextY)) player.y = nextY;

    if (input.keys.a) nextX -= 5;
    if (input.keys.d) nextX += 5;
    if (!checkWallCollision(nextX, player.y)) player.x = nextX;

    if (input.shoot && player.mana >= 10) {
      player.mana -= 10;
      const dx = input.mouseX - player.x;
      const dy = input.mouseY - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        const speed = 10;
        this.state.projectiles.push({
          x: player.x,
          y: player.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          ownerId: playerId,
        });
      }
    }

    if (input.barrier && player.mana >= 30) {
      player.mana -= 30;

      const dx = input.mouseX - player.x;
      const dy = input.mouseY - player.y;
      const dist = Math.hypot(dx, dy) || 1;

      this.state.barriers.push({
        x: player.x + (dx / dist) * 50 - 20,
        y: player.y + (dy / dist) * 50 - 20,
        width: 40,
        height: 40,
        createdAt: Date.now(),
      });
    }
  }

  update() {
    const now = Date.now();

    for (let i = this.state.barriers.length - 1; i >= 0; i--) {
      if (now - this.state.barriers[i].createdAt > 4000) {
        this.state.barriers.splice(i, 1);
      }
    }

    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      proj.x += proj.vx;
      proj.y += proj.vy;

      if (proj.x < -50 || proj.x > 850 || proj.y < -50 || proj.y > 650) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      let hitBarrier = false;
      for (let b of this.state.barriers) {
        if (
          proj.x > b.x &&
          proj.x < b.x + b.width &&
          proj.y > b.y &&
          proj.y < b.y + b.height
        ) {
          hitBarrier = true;
          break;
        }
      }

      if (hitBarrier) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      let hitPlayer = false;
      Object.entries(this.state.players).forEach(([id, p]) => {
        if (
          p.hp > 0 &&
          id !== proj.ownerId &&
          Math.hypot(p.x - proj.x, p.y - proj.y) < 20
        ) {
          if (p.shield) {
            p.shield = false;
          } else {
            p.hp -= 10;
          }
          hitPlayer = true;
        }
      });

      if (hitPlayer) {
        this.state.projectiles.splice(i, 1);
      }
    }

    Object.values(this.state.players).forEach((p) => {
      if (p.hp <= 0) return;

      for (let cIndex = this.state.crystals.length - 1; cIndex >= 0; cIndex--) {
        const c = this.state.crystals[cIndex];
        if (Math.hypot(p.x - c.x, p.y - c.y) < 25) {
          if (c.type === "mana") {
            p.mana = Math.min(100, p.mana + 20);
          } else if (c.type === "shield") {
            p.shield = true;
          }
          this.state.crystals.splice(cIndex, 1);
        }
      }
    });

    this.io.to(this.matchId).emit("state_update", this.state);
  }
}

module.exports = GameEngine;
