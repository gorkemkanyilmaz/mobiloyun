/**
 * Amiral Battı (Battleship) Game Engine
 * Supports 1v1 and 2v2 modes
 */

class AmiralBattiGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.roomId = room.id;

        // Game phases
        this.PHASES = {
            PLACEMENT: 'PLACEMENT',
            PLAYING: 'PLAYING',
            FINISHED: 'FINISHED'
        };

        // Ship configurations
        this.SHIP_TYPES = {
            CARRIER: { name: 'Uçak Gemisi', size: 4, count: 1 },
            BATTLESHIP: { name: 'Savaş Gemisi', size: 3, count: 2 },
            DESTROYER: { name: 'Destroyer', size: 2, count: 2 },
            SUBMARINE: { name: 'Denizaltı', size: 1, count: 1 }
        };

        this.GRID_SIZE = 10;

        // Game state
        this.phase = this.PHASES.PLACEMENT;
        this.players = new Map(); // playerId -> player state
        this.teams = { blue: [], red: [] }; // For 2v2
        this.turnOrder = []; // Array of player IDs
        this.currentTurnIndex = 0;
        this.winner = null;
        this.gameStats = {};

        this.init();
    }

    init() {
        const playerCount = this.room.players.length;
        const is2v2 = playerCount === 4;

        // Initialize each player
        this.room.players.forEach((player, index) => {
            this.players.set(player.id, {
                id: player.id,
                name: player.name,
                grid: this.createEmptyGrid(),
                ships: [],
                enemyView: this.createEmptyGrid(), // What they see of enemy
                isReady: false,
                hits: 0,
                misses: 0
            });

            // Team assignment for 2v2: Blue = P1, P3 | Red = P2, P4
            if (is2v2) {
                if (index % 2 === 0) {
                    this.teams.blue.push(player.id);
                } else {
                    this.teams.red.push(player.id);
                }
            }
        });

        // Set turn order
        if (is2v2) {
            // B1 -> R1 -> B2 -> R2
            this.turnOrder = [
                this.teams.blue[0],
                this.teams.red[0],
                this.teams.blue[1],
                this.teams.red[1]
            ];
        } else {
            // 1v1: Alternating
            this.turnOrder = this.room.players.map(p => p.id);
        }

        // Randomize first turn
        this.currentTurnIndex = Math.floor(Math.random() * this.turnOrder.length);

        console.log(`[AmiralBatti] Game initialized for room ${this.roomId}, ${playerCount} players`);
        this.broadcastState();
    }

    createEmptyGrid() {
        const grid = [];
        for (let y = 0; y < this.GRID_SIZE; y++) {
            const row = [];
            for (let x = 0; x < this.GRID_SIZE; x++) {
                row.push({
                    hasShip: false,
                    shipId: null,
                    isHit: false,
                    isMiss: false
                });
            }
            grid.push(row);
        }
        return grid;
    }

    // Get valid targets for current player (enemies)
    getValidTargets(playerId) {
        const playerCount = this.room.players.length;

        if (playerCount === 2) {
            // 1v1: Target is the other player
            return this.room.players.filter(p => p.id !== playerId).map(p => p.id);
        } else {
            // 2v2: Target is enemy team
            const isBlueTeam = this.teams.blue.includes(playerId);
            return isBlueTeam ? this.teams.red : this.teams.blue;
        }
    }

    // Validate ship placement
    canPlaceShip(playerId, shipType, startX, startY, isHorizontal) {
        const player = this.players.get(playerId);
        if (!player) return { valid: false, reason: 'Player not found' };

        const shipConfig = this.SHIP_TYPES[shipType];
        if (!shipConfig) return { valid: false, reason: 'Invalid ship type' };

        // Check if player already has max of this ship type
        const existingCount = player.ships.filter(s => s.type === shipType).length;
        if (existingCount >= shipConfig.count) {
            return { valid: false, reason: 'Maximum ships of this type already placed' };
        }

        // Calculate ship cells
        const cells = [];
        for (let i = 0; i < shipConfig.size; i++) {
            const x = isHorizontal ? startX + i : startX;
            const y = isHorizontal ? startY : startY + i;

            // Check bounds
            if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
                return { valid: false, reason: 'Ship out of bounds' };
            }

            cells.push({ x, y });
        }

        // Check for overlaps and adjacency
        for (const cell of cells) {
            // Check the cell itself
            if (player.grid[cell.y][cell.x].hasShip) {
                return { valid: false, reason: 'Cell already occupied' };
            }

            // Check all 8 adjacent cells
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;

                    const nx = cell.x + dx;
                    const ny = cell.y + dy;

                    if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
                        if (player.grid[ny][nx].hasShip) {
                            // Check if it's part of the same ship being placed
                            const isPartOfCurrentShip = cells.some(c => c.x === nx && c.y === ny);
                            if (!isPartOfCurrentShip) {
                                return { valid: false, reason: 'Ships cannot touch each other' };
                            }
                        }
                    }
                }
            }
        }

        return { valid: true, cells };
    }

    // Place a ship
    placeShip(playerId, shipType, startX, startY, isHorizontal) {
        if (this.phase !== this.PHASES.PLACEMENT) {
            return { success: false, reason: 'Not in placement phase' };
        }

        const validation = this.canPlaceShip(playerId, shipType, startX, startY, isHorizontal);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }

        const player = this.players.get(playerId);
        const shipId = `${playerId}_${shipType}_${player.ships.length}`;

        // Place ship on grid
        for (const cell of validation.cells) {
            player.grid[cell.y][cell.x].hasShip = true;
            player.grid[cell.y][cell.x].shipId = shipId;
        }

        // Add to player's ships
        player.ships.push({
            id: shipId,
            type: shipType,
            cells: validation.cells,
            hits: 0,
            isSunk: false
        });

        console.log(`[AmiralBatti] ${player.name} placed ${shipType} at (${startX},${startY})`);
        this.broadcastState();

        return { success: true, shipId };
    }

    // Remove a ship (for repositioning)
    removeShip(playerId, shipId) {
        if (this.phase !== this.PHASES.PLACEMENT) {
            return { success: false, reason: 'Not in placement phase' };
        }

        const player = this.players.get(playerId);
        if (!player) return { success: false, reason: 'Player not found' };

        const shipIndex = player.ships.findIndex(s => s.id === shipId);
        if (shipIndex === -1) return { success: false, reason: 'Ship not found' };

        const ship = player.ships[shipIndex];

        // Remove from grid
        for (const cell of ship.cells) {
            player.grid[cell.y][cell.x].hasShip = false;
            player.grid[cell.y][cell.x].shipId = null;
        }

        // Remove from ships array
        player.ships.splice(shipIndex, 1);

        this.broadcastState();
        return { success: true };
    }

    // Check if player has placed all required ships
    hasAllShipsPlaced(playerId) {
        const player = this.players.get(playerId);
        if (!player) return false;

        let totalRequired = 0;
        for (const type in this.SHIP_TYPES) {
            totalRequired += this.SHIP_TYPES[type].count;
        }

        return player.ships.length === totalRequired;
    }

    // Mark player as ready
    setReady(playerId, isReady) {
        if (this.phase !== this.PHASES.PLACEMENT) {
            return { success: false, reason: 'Not in placement phase' };
        }

        const player = this.players.get(playerId);
        if (!player) return { success: false, reason: 'Player not found' };

        if (isReady && !this.hasAllShipsPlaced(playerId)) {
            return { success: false, reason: 'Must place all ships first' };
        }

        player.isReady = isReady;
        console.log(`[AmiralBatti] ${player.name} is ${isReady ? 'ready' : 'not ready'}`);

        // Check if all players are ready
        const allReady = Array.from(this.players.values()).every(p => p.isReady);
        if (allReady) {
            this.phase = this.PHASES.PLAYING;
            console.log(`[AmiralBatti] Game starting!`);
        }

        this.broadcastState();
        return { success: true };
    }

    // Shoot at a cell
    shoot(playerId, targetPlayerId, x, y) {
        if (this.phase !== this.PHASES.PLAYING) {
            return { success: false, reason: 'Game not in playing phase' };
        }

        // Check if it's this player's turn
        if (this.turnOrder[this.currentTurnIndex] !== playerId) {
            return { success: false, reason: 'Not your turn' };
        }

        // Validate target
        const validTargets = this.getValidTargets(playerId);
        if (!validTargets.includes(targetPlayerId)) {
            return { success: false, reason: 'Invalid target' };
        }

        const shooter = this.players.get(playerId);
        const target = this.players.get(targetPlayerId);
        if (!shooter || !target) {
            return { success: false, reason: 'Player not found' };
        }

        // Check bounds
        if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) {
            return { success: false, reason: 'Invalid coordinates' };
        }

        // Check if already shot here
        const targetCell = target.grid[y][x];
        if (targetCell.isHit || targetCell.isMiss) {
            return { success: false, reason: 'Already shot at this cell' };
        }

        let result = { success: true, hit: false, sunk: false, shipType: null };

        if (targetCell.hasShip) {
            // HIT!
            targetCell.isHit = true;
            shooter.hits++;
            result.hit = true;

            // Find and update the ship
            const ship = target.ships.find(s => s.id === targetCell.shipId);
            if (ship) {
                ship.hits++;
                result.shipType = ship.type;

                // Check if sunk
                const shipConfig = this.SHIP_TYPES[ship.type];
                if (ship.hits >= shipConfig.size) {
                    ship.isSunk = true;
                    result.sunk = true;
                    result.sunkShip = {
                        type: ship.type,
                        cells: ship.cells
                    };
                    console.log(`[AmiralBatti] ${shooter.name} sunk ${target.name}'s ${ship.type}!`);
                }
            }

            console.log(`[AmiralBatti] HIT! ${shooter.name} hit ${target.name} at (${x},${y})`);
        } else {
            // MISS
            targetCell.isMiss = true;
            shooter.misses++;
            console.log(`[AmiralBatti] MISS! ${shooter.name} missed at (${x},${y})`);
        }

        // Move to next turn
        this.nextTurn();

        // Check win condition
        this.checkWinCondition();

        this.broadcastState();
        return result;
    }

    nextTurn() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;

        // Skip eliminated players in 2v2
        if (this.room.players.length === 4) {
            let attempts = 0;
            while (attempts < 4) {
                const currentPlayerId = this.turnOrder[this.currentTurnIndex];
                const player = this.players.get(currentPlayerId);

                // Check if this player has any ships left
                const hasShipsLeft = player.ships.some(s => !s.isSunk);
                if (hasShipsLeft) break;

                this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
                attempts++;
            }
        }
    }

    checkWinCondition() {
        const playerCount = this.room.players.length;

        if (playerCount === 2) {
            // 1v1: Check if any player has all ships sunk
            for (const [playerId, player] of this.players) {
                const allSunk = player.ships.every(s => s.isSunk);
                if (allSunk && player.ships.length > 0) {
                    // This player lost
                    const winnerId = Array.from(this.players.keys()).find(id => id !== playerId);
                    this.endGame(winnerId);
                    return;
                }
            }
        } else {
            // 2v2: Check if entire team has all ships sunk
            for (const teamName of ['blue', 'red']) {
                const teamIds = this.teams[teamName];
                let teamAllSunk = true;

                for (const playerId of teamIds) {
                    const player = this.players.get(playerId);
                    const allSunk = player.ships.every(s => s.isSunk);
                    if (!allSunk || player.ships.length === 0) {
                        teamAllSunk = false;
                        break;
                    }
                }

                if (teamAllSunk) {
                    // This team lost
                    const winnerTeam = teamName === 'blue' ? 'red' : 'blue';
                    this.endGame(null, winnerTeam);
                    return;
                }
            }
        }
    }

    endGame(winnerId, winnerTeam = null) {
        this.phase = this.PHASES.FINISHED;
        this.winner = winnerTeam || winnerId;

        // Calculate stats
        this.gameStats = {};
        for (const [playerId, player] of this.players) {
            const totalShots = player.hits + player.misses;
            this.gameStats[playerId] = {
                name: player.name,
                hits: player.hits,
                misses: player.misses,
                accuracy: totalShots > 0 ? Math.round((player.hits / totalShots) * 100) : 0,
                shipsSunk: this.countSunkShips(playerId)
            };
        }

        console.log(`[AmiralBatti] Game ended! Winner: ${this.winner}`);
        this.broadcastState();
    }

    countSunkShips(shooterId) {
        let count = 0;
        const validTargets = this.getValidTargets(shooterId);

        for (const targetId of validTargets) {
            const target = this.players.get(targetId);
            if (target) {
                count += target.ships.filter(s => s.isSunk).length;
            }
        }
        return count;
    }

    handleAction(socket, action) {
        const playerId = socket.id;

        switch (action.type) {
            case 'PLACE_SHIP':
                return this.placeShip(playerId, action.shipType, action.x, action.y, action.isHorizontal);

            case 'REMOVE_SHIP':
                return this.removeShip(playerId, action.shipId);

            case 'SET_READY':
                return this.setReady(playerId, action.isReady);

            case 'SHOOT':
                return this.shoot(playerId, action.targetId, action.x, action.y);

            case 'VALIDATE_PLACEMENT':
                return this.canPlaceShip(playerId, action.shipType, action.x, action.y, action.isHorizontal);

            default:
                console.log(`[AmiralBatti] Unknown action: ${action.type}`);
                return { success: false, reason: 'Unknown action' };
        }
    }

    broadcastState() {
        const is2v2 = this.room.players.length === 4;

        this.room.players.forEach(player => {
            const playerId = player.id;
            const playerState = this.players.get(playerId);
            if (!playerState) return;

            // Build enemy views
            const enemyViews = {};
            const validTargets = this.getValidTargets(playerId);

            for (const targetId of validTargets) {
                const target = this.players.get(targetId);
                if (!target) continue;

                // Create a sanitized view of enemy grid (only show hits/misses and sunk ships)
                const enemyGrid = [];
                for (let y = 0; y < this.GRID_SIZE; y++) {
                    const row = [];
                    for (let x = 0; x < this.GRID_SIZE; x++) {
                        const cell = target.grid[y][x];
                        row.push({
                            isHit: cell.isHit,
                            isMiss: cell.isMiss,
                            // Only reveal ship info if it's sunk
                            hasShip: cell.isHit && cell.hasShip,
                            shipId: cell.isHit ? cell.shipId : null
                        });
                    }
                    enemyGrid.push(row);
                }

                // Get sunk ships info
                const sunkShips = target.ships.filter(s => s.isSunk).map(s => ({
                    type: s.type,
                    cells: s.cells
                }));

                enemyViews[targetId] = {
                    name: target.name,
                    grid: enemyGrid,
                    sunkShips,
                    remainingShips: target.ships.filter(s => !s.isSunk).length
                };
            }

            // 2v2: Include teammate info
            let teammateInfo = null;
            if (is2v2) {
                const isBlueTeam = this.teams.blue.includes(playerId);
                const teammateId = (isBlueTeam ? this.teams.blue : this.teams.red)
                    .find(id => id !== playerId);

                if (teammateId) {
                    const teammate = this.players.get(teammateId);
                    if (teammate) {
                        teammateInfo = {
                            id: teammateId,
                            name: teammate.name,
                            shipsRemaining: teammate.ships.filter(s => !s.isSunk).length,
                            totalShips: teammate.ships.length
                        };
                    }
                }
            }

            const state = {
                phase: this.phase,
                myGrid: playerState.grid,
                myShips: playerState.ships,
                enemyViews,
                isMyTurn: this.turnOrder[this.currentTurnIndex] === playerId,
                currentTurnPlayer: this.turnOrder[this.currentTurnIndex],
                currentTurnName: this.players.get(this.turnOrder[this.currentTurnIndex])?.name,
                allReady: Array.from(this.players.values()).every(p => p.isReady),
                amIReady: playerState.isReady,
                shipTypes: this.SHIP_TYPES,
                hasAllShips: this.hasAllShipsPlaced(playerId),
                teams: is2v2 ? this.teams : null,
                myTeam: is2v2 ? (this.teams.blue.includes(playerId) ? 'blue' : 'red') : null,
                teammateInfo,
                winner: this.winner,
                gameStats: this.phase === this.PHASES.FINISHED ? this.gameStats : null,
                players: Array.from(this.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    isReady: p.isReady,
                    shipsPlaced: p.ships.length
                }))
            };

            this.io.to(playerId).emit('gameState', state);
        });
    }

    sendStateTo(playerId) {
        this.broadcastState();
    }

    updatePlayerId(oldPlayerId, newPlayerId) {
        const playerState = this.players.get(oldPlayerId);
        if (playerState) {
            playerState.id = newPlayerId;
            this.players.delete(oldPlayerId);
            this.players.set(newPlayerId, playerState);

            // Update turn order
            const turnIndex = this.turnOrder.indexOf(oldPlayerId);
            if (turnIndex !== -1) {
                this.turnOrder[turnIndex] = newPlayerId;
            }

            // Update teams
            for (const team of ['blue', 'red']) {
                const index = this.teams[team].indexOf(oldPlayerId);
                if (index !== -1) {
                    this.teams[team][index] = newPlayerId;
                }
            }
        }
    }

    destroy() {
        console.log(`[AmiralBatti] Game destroyed for room ${this.roomId}`);
    }
}

module.exports = AmiralBattiGame;
