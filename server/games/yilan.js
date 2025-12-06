const { v4: uuidv4 } = require('uuid');

class YilanGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.roomId = room.id;

        // Game settings
        this.WORLD_WIDTH = 1500;
        this.WORLD_HEIGHT = 1500;
        this.TICK_RATE = 60; // 60 FPS
        this.TICK_INTERVAL = 1000 / this.TICK_RATE;
        this.SNAKE_BASE_SPEED = 3;
        this.BOOST_MULTIPLIER = 2;
        this.INITIAL_LENGTH = 10;
        this.ORB_VALUE = 1;
        this.INITIAL_ORBS = 100;
        this.MAX_ORBS = 300;
        this.RESPAWN_DELAY = 3000;
        this.SEGMENT_SPACING = 5;

        // Game state
        this.snakes = new Map(); // playerId -> snake object
        this.orbs = []; // { id, x, y, color, size }
        this.deadPlayers = new Map(); // playerId -> respawnTime
        this.gameLoop = null;
        this.lastUpdate = Date.now();

        // Colors for snakes and orbs
        this.COLORS = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
            '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe',
            '#fab1a0', '#00b894', '#e17055', '#74b9ff'
        ];

        this.init();
    }

    init() {
        // Spawn initial orbs
        this.spawnInitialOrbs();

        // Initialize snakes for all players
        this.room.players.forEach((player, index) => {
            this.spawnSnake(player.id, player.name, index);
        });

        // Start game loop
        this.startGameLoop();

        console.log(`[Yilan] Game initialized for room ${this.roomId}`);
    }

    spawnInitialOrbs() {
        for (let i = 0; i < this.INITIAL_ORBS; i++) {
            this.spawnOrb();
        }
    }

    spawnOrb(x = null, y = null, color = null) {
        if (this.orbs.length >= this.MAX_ORBS) return;

        const orb = {
            id: uuidv4(),
            x: x !== null ? x : Math.random() * (this.WORLD_WIDTH - 100) + 50,
            y: y !== null ? y : Math.random() * (this.WORLD_HEIGHT - 100) + 50,
            color: color || this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
            size: 8 + Math.random() * 4
        };
        this.orbs.push(orb);
        return orb;
    }

    spawnSnake(playerId, playerName, index = 0) {
        // Spawn at random edge position
        const edge = index % 4;
        let x, y, angle;

        const margin = 100;

        switch (edge) {
            case 0: // Top edge
                x = margin + Math.random() * (this.WORLD_WIDTH - 2 * margin);
                y = margin;
                angle = Math.PI / 2; // Facing down
                break;
            case 1: // Right edge
                x = this.WORLD_WIDTH - margin;
                y = margin + Math.random() * (this.WORLD_HEIGHT - 2 * margin);
                angle = Math.PI; // Facing left
                break;
            case 2: // Bottom edge
                x = margin + Math.random() * (this.WORLD_WIDTH - 2 * margin);
                y = this.WORLD_HEIGHT - margin;
                angle = -Math.PI / 2; // Facing up
                break;
            case 3: // Left edge
                x = margin;
                y = margin + Math.random() * (this.WORLD_HEIGHT - 2 * margin);
                angle = 0; // Facing right
                break;
        }

        // Create segments
        const segments = [];
        for (let i = 0; i < this.INITIAL_LENGTH; i++) {
            segments.push({
                x: x - Math.cos(angle) * i * this.SEGMENT_SPACING,
                y: y - Math.sin(angle) * i * this.SEGMENT_SPACING
            });
        }

        const snake = {
            id: playerId,
            name: playerName,
            color: this.COLORS[index % this.COLORS.length],
            segments: segments,
            angle: angle,
            targetX: x + Math.cos(angle) * 100,
            targetY: y + Math.sin(angle) * 100,
            length: this.INITIAL_LENGTH,
            score: 0,
            isBoosting: false,
            isAlive: true,
            lastBoostDrop: 0
        };

        this.snakes.set(playerId, snake);
        return snake;
    }

    startGameLoop() {
        this.gameLoop = setInterval(() => {
            this.update();
        }, this.TICK_INTERVAL);
    }

    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;

        // Check respawns
        this.checkRespawns(now);

        // Update all snakes
        this.snakes.forEach((snake, playerId) => {
            if (!snake.isAlive) return;
            this.updateSnake(snake, deltaTime, now);
        });

        // Check collisions
        this.checkCollisions();

        // Spawn new orbs if needed
        if (this.orbs.length < this.INITIAL_ORBS / 2) {
            for (let i = 0; i < 10; i++) {
                this.spawnOrb();
            }
        }

        // Broadcast state
        this.broadcastState();
    }

    updateSnake(snake, deltaTime, now) {
        const head = snake.segments[0];

        // Calculate angle to target
        const dx = snake.targetX - head.x;
        const dy = snake.targetY - head.y;
        const targetAngle = Math.atan2(dy, dx);

        // Smooth turn towards target
        let angleDiff = targetAngle - snake.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnSpeed = 0.15;
        snake.angle += angleDiff * turnSpeed;

        // Calculate speed
        let speed = this.SNAKE_BASE_SPEED;
        if (snake.isBoosting && snake.length > 3) {
            speed *= this.BOOST_MULTIPLIER;

            // Drop orbs while boosting
            if (now - snake.lastBoostDrop > 100) {
                snake.lastBoostDrop = now;
                const tail = snake.segments[snake.segments.length - 1];
                this.spawnOrb(tail.x, tail.y, snake.color);
                snake.length = Math.max(3, snake.length - 1);

                // Remove last segment
                if (snake.segments.length > snake.length) {
                    snake.segments.pop();
                }
            }
        }

        // Move head
        const newHead = {
            x: head.x + Math.cos(snake.angle) * speed,
            y: head.y + Math.sin(snake.angle) * speed
        };

        // Keep in bounds
        newHead.x = Math.max(10, Math.min(this.WORLD_WIDTH - 10, newHead.x));
        newHead.y = Math.max(10, Math.min(this.WORLD_HEIGHT - 10, newHead.y));

        // Add new head, remove excess tail
        snake.segments.unshift(newHead);
        while (snake.segments.length > snake.length) {
            snake.segments.pop();
        }
    }

    checkRespawns(now) {
        this.deadPlayers.forEach((respawnTime, playerId) => {
            if (now >= respawnTime) {
                const player = this.room.players.find(p => p.id === playerId);
                if (player) {
                    const index = this.room.players.indexOf(player);
                    this.spawnSnake(playerId, player.name, index);
                    console.log(`[Yilan] Player ${player.name} respawned`);
                }
                this.deadPlayers.delete(playerId);
            }
        });
    }

    checkCollisions() {
        this.snakes.forEach((snake, playerId) => {
            if (!snake.isAlive) return;

            const head = snake.segments[0];
            const headRadius = 10;

            // Check orb collisions
            for (let i = this.orbs.length - 1; i >= 0; i--) {
                const orb = this.orbs[i];
                const dist = Math.hypot(head.x - orb.x, head.y - orb.y);

                if (dist < headRadius + orb.size) {
                    // Eat orb
                    snake.length += this.ORB_VALUE;
                    snake.score += 1;
                    this.orbs.splice(i, 1);
                }
            }

            // Check snake-to-snake collisions
            this.snakes.forEach((otherSnake, otherPlayerId) => {
                if (playerId === otherPlayerId) return;
                if (!otherSnake.isAlive) return;

                // Check if head hits other snake's body
                for (let i = 1; i < otherSnake.segments.length; i++) {
                    const segment = otherSnake.segments[i];
                    const dist = Math.hypot(head.x - segment.x, head.y - segment.y);

                    if (dist < headRadius + 8) {
                        // Death!
                        this.killSnake(playerId);
                        return;
                    }
                }

                // Check head-to-head collision
                const otherHead = otherSnake.segments[0];
                const headDist = Math.hypot(head.x - otherHead.x, head.y - otherHead.y);

                if (headDist < headRadius * 2) {
                    // Both die on head-to-head
                    this.killSnake(playerId);
                    this.killSnake(otherPlayerId);
                    return;
                }
            });
        });
    }

    killSnake(playerId) {
        const snake = this.snakes.get(playerId);
        if (!snake || !snake.isAlive) return;

        snake.isAlive = false;

        // Convert body to orbs
        const orbCount = Math.floor(snake.length / 2);
        for (let i = 0; i < orbCount && i < snake.segments.length; i += 2) {
            const segment = snake.segments[i];
            this.spawnOrb(segment.x, segment.y, snake.color);
        }

        // Schedule respawn
        this.deadPlayers.set(playerId, Date.now() + this.RESPAWN_DELAY);

        console.log(`[Yilan] Player ${snake.name} died!`);
    }

    handleAction(socket, action) {
        const playerId = socket.id;
        const snake = this.snakes.get(playerId);

        if (!snake) return;

        switch (action.type) {
            case 'MOVE':
                if (action.x !== undefined && action.y !== undefined) {
                    snake.targetX = action.x;
                    snake.targetY = action.y;
                }
                break;

            case 'BOOST_START':
                snake.isBoosting = true;
                break;

            case 'BOOST_END':
                snake.isBoosting = false;
                break;
        }
    }

    broadcastState() {
        // Build leaderboard
        const leaderboard = Array.from(this.snakes.values())
            .filter(s => s.isAlive)
            .sort((a, b) => b.length - a.length)
            .slice(0, 10)
            .map((s, i) => ({
                rank: i + 1,
                name: s.name,
                score: s.length,
                color: s.color
            }));

        // Prepare snake data for each player
        const snakesData = [];
        this.snakes.forEach(snake => {
            snakesData.push({
                id: snake.id,
                name: snake.name,
                color: snake.color,
                segments: snake.segments,
                isAlive: snake.isAlive,
                isBoosting: snake.isBoosting
            });
        });

        // Send to each player with their specific view
        this.room.players.forEach(player => {
            const mySnake = this.snakes.get(player.id);
            const respawnTime = this.deadPlayers.get(player.id);

            const state = {
                snakes: snakesData,
                orbs: this.orbs,
                leaderboard: leaderboard,
                worldWidth: this.WORLD_WIDTH,
                worldHeight: this.WORLD_HEIGHT,
                mySnakeId: player.id,
                isAlive: mySnake ? mySnake.isAlive : false,
                respawnIn: respawnTime ? Math.max(0, respawnTime - Date.now()) : 0
            };

            this.io.to(player.id).emit('gameState', state);
        });
    }

    sendStateTo(playerId) {
        // For getGameState request
        this.broadcastState();
    }

    updatePlayerId(oldPlayerId, newPlayerId) {
        // Transfer snake to new player ID
        const snake = this.snakes.get(oldPlayerId);
        if (snake) {
            snake.id = newPlayerId;
            this.snakes.delete(oldPlayerId);
            this.snakes.set(newPlayerId, snake);
        }

        // Transfer dead player respawn
        const respawnTime = this.deadPlayers.get(oldPlayerId);
        if (respawnTime) {
            this.deadPlayers.delete(oldPlayerId);
            this.deadPlayers.set(newPlayerId, respawnTime);
        }
    }

    destroy() {
        this.stopGameLoop();
        this.snakes.clear();
        this.orbs = [];
        console.log(`[Yilan] Game destroyed for room ${this.roomId}`);
    }
}

module.exports = YilanGame;
