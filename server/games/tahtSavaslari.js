/**
 * Taht Savaşları (Throne Wars) - Game Engine
 * Tournament-style mini-game battle royale for 4 players
 */

class TahtSavaslariGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.roomId = room.id;

        // Game phases
        this.PHASES = {
            WAITING: 'WAITING',
            MATCHUP_INTRO: 'MATCHUP_INTRO',
            TRAP_PLACING: 'TRAP_PLACING',
            TRAP_NAVIGATING: 'TRAP_NAVIGATING',
            TANK_PUSH_PLAYING: 'TANK_PUSH_PLAYING',
            REFLEX_PLAYING: 'REFLEX_PLAYING',
            ROUND_RESULT: 'ROUND_RESULT',
            WAITING_READY: 'WAITING_READY',
            GAME_OVER: 'GAME_OVER'
        };

        // Mini-game types
        this.MINIGAMES = {
            TRAP: 'TRAP',
            TANK_PUSH: 'TANK_PUSH',
            REFLEX: 'REFLEX'
        };

        // Initialize game state
        this.phase = this.PHASES.WAITING;
        this.players = room.players.map(p => ({
            id: p.id,
            name: p.name,
            isEliminated: false,
            wins: 0
        }));

        // Tournament state
        this.challenger = null;
        this.opponent = null;
        this.opponentsQueue = [];
        this.spectators = [];
        this.currentMiniGame = null;
        this.miniGameOrder = [this.MINIGAMES.TRAP, this.MINIGAMES.REFLEX, this.MINIGAMES.TANK_PUSH];
        this.miniGameIndex = 0;

        // Ready tracking
        this.readyPlayers = new Set();
        this.loser = null;
        this.nextChallenger = null;
        this.currentChallengerIndex = 0;

        // Trap Arena state
        this.trapState = {
            traps: [null, null, null],
            currentStep: 0,
            timeRemaining: 20,
            defenderReady: false
        };

        // Tank Push state
        this.tankPushState = null;
        this.tankPushInterval = null;

        // Reflex state
        this.reflexState = {
            greenCell: null,
            scores: {},
            timeRemaining: 60,
            targetScore: 3,
            roundActive: false
        };

        // Timers
        this.gameTimer = null;
        this.reflexRoundTimer = null;
        this.winner = null;

        this.init();
    }

    init() {
        console.log(`[TahtSavaslari] Game initialized for room ${this.roomId}`);
        if (this.players.length >= 2) {
            this.startTournament();
        }
        this.broadcastState();
    }

    startTournament() {
        this.challenger = this.players[0].id;
        this.opponentsQueue = this.players
            .filter(p => p.id !== this.challenger)
            .map(p => p.id);
        this.miniGameOrder = [this.MINIGAMES.TRAP, this.MINIGAMES.REFLEX, this.MINIGAMES.TANK_PUSH];
        this.miniGameIndex = 0;
        this.startNextMatchup();
    }

    startNextMatchup() {
        if (this.opponentsQueue.length === 0) {
            this.declareWinner(this.challenger);
            return;
        }

        this.opponent = this.opponentsQueue.shift();
        this.spectators = this.players
            .filter(p => p.id !== this.challenger && p.id !== this.opponent)
            .map(p => p.id);

        this.phase = this.PHASES.MATCHUP_INTRO;
        this.currentMiniGame = this.miniGameOrder[this.miniGameIndex];
        this.broadcastState();

        setTimeout(() => {
            this.startCurrentMiniGame();
        }, 3000);
    }

    startCurrentMiniGame() {
        switch (this.currentMiniGame) {
            case this.MINIGAMES.TRAP:
                this.startTrapArena();
                break;
            case this.MINIGAMES.TANK_PUSH:
                this.startTankPush();
                break;
            case this.MINIGAMES.REFLEX:
                this.startReflex();
                break;
        }
    }

    // ========== TRAP ARENA ==========
    startTrapArena() {
        this.phase = this.PHASES.TRAP_PLACING;
        this.trapState = {
            traps: [null, null, null],
            currentStep: 0,
            timeRemaining: 20,
            defenderReady: false
        };

        this.broadcastState();

        this.gameTimer = setInterval(() => {
            this.trapState.timeRemaining--;

            if (this.trapState.timeRemaining <= 0 || this.trapState.defenderReady) {
                clearInterval(this.gameTimer);

                for (let i = 0; i < 3; i++) {
                    if (this.trapState.traps[i] === null) {
                        this.trapState.traps[i] = Math.random() < 0.5 ? 0 : 1;
                    }
                }

                this.startTrapNavigation();
            }

            this.broadcastState();
        }, 1000);
    }

    startTrapNavigation() {
        this.phase = this.PHASES.TRAP_NAVIGATING;
        this.trapState.currentStep = 0;
        this.broadcastState();
    }

    placeTrap(playerId, column, position) {
        if (playerId !== this.opponent) return;
        if (this.phase !== this.PHASES.TRAP_PLACING) return;
        if (column < 0 || column > 2) return;

        this.trapState.traps[column] = position;
        this.broadcastState();
    }

    defenderReady(playerId) {
        if (playerId !== this.opponent) return;
        if (this.phase !== this.PHASES.TRAP_PLACING) return;
        this.trapState.defenderReady = true;
    }

    navigateStep(playerId, position) {
        if (playerId !== this.challenger) return;
        if (this.phase !== this.PHASES.TRAP_NAVIGATING) return;

        const step = this.trapState.currentStep;
        const trap = this.trapState.traps[step];

        if (position === trap) {
            this.endMiniGame(this.opponent);
        } else {
            this.trapState.currentStep++;
            if (this.trapState.currentStep >= 3) {
                this.endMiniGame(this.challenger);
            } else {
                this.broadcastState();
            }
        }
    }

    // ========== TANK PUSH (Redesigned 1v1) ==========
    startTankPush() {
        this.phase = this.PHASES.TANK_PUSH_PLAYING;

        const ARENA_LENGTH = 1000;

        this.tankPushState = {
            lanes: [[], [], []],
            challengerHP: 100,
            opponentHP: 100,
            challengerPreview: [
                this.createTank(true),
                this.createTank(true),
                this.createTank(true)
            ],
            opponentPreview: [
                this.createTank(false),
                this.createTank(false),
                this.createTank(false)
            ],
            timeRemaining: 90,
            spawnTimer: 5,
            arenaLength: ARENA_LENGTH,
            lastUpdateTime: Date.now()
        };

        this.broadcastState();

        // Physics loop 30Hz
        this.tankPushInterval = setInterval(() => {
            this.updateTankPhysics();
        }, 33);

        // Timer
        this.gameTimer = setInterval(() => {
            this.tankPushState.timeRemaining--;
            this.tankPushState.spawnTimer--;

            if (this.tankPushState.spawnTimer <= 0) {
                this.tankPushState.spawnTimer = 5;
                this.addPreviewTank(true);
                this.addPreviewTank(false);
            }

            if (this.tankPushState.timeRemaining <= 0) {
                this.endTankPush();
            }

            this.broadcastState();
        }, 1000);
    }

    createTank(isChallenger) {
        const strength = Math.floor(Math.random() * 3) + 1;
        return {
            id: `tank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            strength: strength,
            isChallenger: isChallenger,
            pos: isChallenger ? 50 : 950,
            lane: null,
            width: 30 + strength * 8
        };
    }

    addPreviewTank(isChallenger) {
        const preview = isChallenger
            ? this.tankPushState.challengerPreview
            : this.tankPushState.opponentPreview;

        if (preview.length < 3) {
            preview.push(this.createTank(isChallenger));
        }
    }

    deployTank(playerId, laneIndex, previewIndex = 0) {
        if (this.phase !== this.PHASES.TANK_PUSH_PLAYING) return;
        if (laneIndex < 0 || laneIndex > 2) return;

        const isChallenger = playerId === this.challenger;
        const isOpponent = playerId === this.opponent;

        if (!isChallenger && !isOpponent) return;

        const preview = isChallenger
            ? this.tankPushState.challengerPreview
            : this.tankPushState.opponentPreview;

        if (preview.length === 0) return;

        const tankIndex = Math.min(previewIndex, preview.length - 1);
        const tank = preview.splice(tankIndex, 1)[0];

        if (!tank) return;

        tank.lane = laneIndex;
        tank.pos = isChallenger ? 50 : 950;

        this.tankPushState.lanes[laneIndex].push(tank);
        this.broadcastState();
    }

    updateTankPhysics() {
        if (this.phase !== this.PHASES.TANK_PUSH_PLAYING) return;
        if (!this.tankPushState) return;

        const now = Date.now();
        const dt = (now - this.tankPushState.lastUpdateTime) / 1000;
        this.tankPushState.lastUpdateTime = now;

        const MOVE_SPEED = 100; // px/s (Increased by 30%)
        const ARENA_LENGTH = this.tankPushState.arenaLength;
        const BASE_LINE_TOP = ARENA_LENGTH - 30;
        const BASE_LINE_BOTTOM = 30;
        const COLLISION_THRESHOLD = 50;

        for (let laneIdx = 0; laneIdx < 3; laneIdx++) {
            const lane = this.tankPushState.lanes[laneIdx];
            if (lane.length === 0) continue;

            // Move all tanks
            lane.forEach(tank => {
                if (tank.isChallenger) {
                    tank.pos += MOVE_SPEED * dt; // Move up (toward top)
                } else {
                    tank.pos -= MOVE_SPEED * dt; // Move down (toward bottom)
                }
            });

            // Check collisions between opposing tanks
            const tanksToRemove = new Set();

            for (let i = 0; i < lane.length; i++) {
                if (tanksToRemove.has(i)) continue;
                const tankA = lane[i];

                for (let j = i + 1; j < lane.length; j++) {
                    if (tanksToRemove.has(j)) continue;
                    const tankB = lane[j];

                    // Only check collision between opposing tanks
                    if (tankA.isChallenger === tankB.isChallenger) continue;

                    const distance = Math.abs(tankA.pos - tankB.pos);

                    if (distance <= COLLISION_THRESHOLD) {
                        // Collision detected!
                        if (tankA.strength > tankB.strength) {
                            // A survives, B explodes
                            tankA.strength -= tankB.strength;
                            tanksToRemove.add(j);
                        } else if (tankB.strength > tankA.strength) {
                            // B survives, A explodes
                            tankB.strength -= tankA.strength;
                            tanksToRemove.add(i);
                        } else {
                            // Equal strength - both explode
                            tanksToRemove.add(i);
                            tanksToRemove.add(j);
                        }
                    }
                }
            }

            // Remove exploded tanks (reverse order)
            const removeIndices = Array.from(tanksToRemove).sort((a, b) => b - a);
            removeIndices.forEach(idx => lane.splice(idx, 1));

            // Check tanks reaching enemy base
            for (let i = lane.length - 1; i >= 0; i--) {
                const tank = lane[i];

                if (tank.isChallenger && tank.pos >= BASE_LINE_TOP) {
                    // Challenger tank reached opponent's base
                    this.tankPushState.opponentHP -= tank.strength * 10;
                    lane.splice(i, 1);
                } else if (!tank.isChallenger && tank.pos <= BASE_LINE_BOTTOM) {
                    // Opponent tank reached challenger's base
                    this.tankPushState.challengerHP -= tank.strength * 10;
                    lane.splice(i, 1);
                }
            }
        }

        if (this.tankPushState.challengerHP <= 0 || this.tankPushState.opponentHP <= 0) {
            this.endTankPush();
            return;
        }

        this.broadcastState();
    }

    endTankPush() {
        if (this.tankPushInterval) {
            clearInterval(this.tankPushInterval);
            this.tankPushInterval = null;
        }
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }

        const winner = this.tankPushState.challengerHP > this.tankPushState.opponentHP
            ? this.challenger
            : this.tankPushState.challengerHP < this.tankPushState.opponentHP
                ? this.opponent
                : (Math.random() < 0.5 ? this.challenger : this.opponent);

        this.endMiniGame(winner);
    }

    // ========== REFLEX ==========
    startReflex() {
        this.phase = this.PHASES.REFLEX_PLAYING;

        this.reflexState = {
            greenCell: null,
            scores: {
                [this.challenger]: 0,
                [this.opponent]: 0
            },
            timeRemaining: 60,
            targetScore: 3,
            roundActive: false
        };

        this.broadcastState();

        this.gameTimer = setInterval(() => {
            this.reflexState.timeRemaining--;

            if (this.reflexState.timeRemaining <= 0) {
                clearInterval(this.gameTimer);
                if (this.reflexRoundTimer) clearTimeout(this.reflexRoundTimer);

                const chalScore = this.reflexState.scores[this.challenger];
                const oppScore = this.reflexState.scores[this.opponent];
                this.endMiniGame(chalScore >= oppScore ? this.challenger : this.opponent);
            }

            this.broadcastState();
        }, 1000);

        setTimeout(() => this.startReflexRound(), 1000);
    }

    startReflexRound() {
        if (this.phase !== this.PHASES.REFLEX_PLAYING) return;

        const delay = 1000 + Math.random() * 2000;

        this.reflexRoundTimer = setTimeout(() => {
            this.reflexState.greenCell = {
                x: Math.floor(Math.random() * 4),
                y: Math.floor(Math.random() * 4)
            };
            this.reflexState.roundActive = true;
            this.broadcastState();

            this.reflexRoundTimer = setTimeout(() => {
                if (this.reflexState.roundActive) {
                    this.reflexState.roundActive = false;
                    this.reflexState.greenCell = null;
                    this.broadcastState();
                    this.startReflexRound();
                }
            }, 3000);
        }, delay);
    }

    clickReflexCell(playerId, x, y) {
        if (this.phase !== this.PHASES.REFLEX_PLAYING) return;
        if (!this.reflexState.roundActive) return;
        if (playerId !== this.challenger && playerId !== this.opponent) return;

        const green = this.reflexState.greenCell;
        if (x === green.x && y === green.y) {
            this.reflexState.scores[playerId]++;
            this.reflexState.roundActive = false;
            this.reflexState.greenCell = null;

            if (this.reflexRoundTimer) clearTimeout(this.reflexRoundTimer);

            if (this.reflexState.scores[playerId] >= this.reflexState.targetScore) {
                clearInterval(this.gameTimer);
                this.endMiniGame(playerId);
                return;
            }

            this.broadcastState();
            setTimeout(() => this.startReflexRound(), 500);
        }
    }

    // ========== GAME FLOW ==========
    endMiniGame(winnerId) {
        if (this.gameTimer) clearInterval(this.gameTimer);
        if (this.reflexRoundTimer) clearTimeout(this.reflexRoundTimer);
        if (this.tankPushInterval) clearInterval(this.tankPushInterval);
        this.tankPushInterval = null;

        const challengerWon = winnerId === this.challenger;
        this.loser = challengerWon ? this.opponent : this.challenger;
        this.phase = this.PHASES.ROUND_RESULT;

        this.broadcastState();

        setTimeout(() => {
            // 2-PLAYER MODE SPECIAL LOGIC ("King of the Hill" Gauntlet)
            if (this.players.length === 2) {
                if (challengerWon) {
                    // Challenger defended the throne, move to next challenge
                    this.miniGameIndex++;

                    if (this.miniGameIndex >= 3) {
                        // Challenger survived all 3 games -> Wins the tournament
                        this.declareWinner(winnerId);
                    } else {
                        // Prepare next game for Challenger
                        this.currentMiniGame = this.miniGameOrder[this.miniGameIndex];
                        this.phase = this.PHASES.MATCHUP_INTRO;
                        this.broadcastState();
                        setTimeout(() => this.startCurrentMiniGame(), 3000);
                    }
                } else {
                    // Challenger lost! Opponent takes the throne.
                    // New King must start from the beginning (Game 1)
                    const temp = this.challenger;
                    this.challenger = this.opponent;
                    this.opponent = temp;

                    this.miniGameIndex = 0; // Reset gauntlet
                    this.currentMiniGame = this.miniGameOrder[this.miniGameIndex];
                    this.phase = this.PHASES.MATCHUP_INTRO;
                    this.broadcastState();
                    setTimeout(() => this.startCurrentMiniGame(), 3000);
                }
                return;
            }

            // STANDARD MODE LOGIC (>2 Players)
            if (challengerWon) {
                this.miniGameIndex++;

                if (this.miniGameIndex >= 3 || this.opponentsQueue.length === 0) {
                    this.declareWinner(this.challenger);
                } else {
                    this.startNextMatchup();
                }
            } else {
                this.showWaitingReady();
            }
        }, 3000);
    }

    showWaitingReady() {
        this.phase = this.PHASES.WAITING_READY;
        this.readyPlayers = new Set();
        this.currentChallengerIndex = (this.currentChallengerIndex + 1) % this.players.length;
        this.nextChallenger = this.players[this.currentChallengerIndex].id;
        this.broadcastState();
    }

    playerReady(playerId) {
        if (this.phase !== this.PHASES.WAITING_READY) return;
        this.readyPlayers.add(playerId);
        this.broadcastState();

        if (this.readyPlayers.size >= this.players.length) {
            this.startNewRound();
        }
    }

    startNewRound() {
        this.challenger = this.nextChallenger;
        this.opponentsQueue = this.players
            .filter(p => p.id !== this.challenger)
            .map(p => p.id);

        this.miniGameOrder = [this.MINIGAMES.TRAP, this.MINIGAMES.REFLEX, this.MINIGAMES.TANK_PUSH];
        this.miniGameIndex = 0;
        this.loser = null;
        this.readyPlayers = new Set();
        this.startNextMatchup();
    }

    declareWinner(winnerId) {
        this.phase = this.PHASES.GAME_OVER;
        this.winner = winnerId;
        console.log(`[TahtSavaslari] Winner: ${winnerId}`);
        this.broadcastState();
    }

    getPlayerName(playerId) {
        const player = this.players.find(p => p.id === playerId);
        return player ? player.name : 'Unknown';
    }

    // ========== SOCKET HANDLERS ==========
    handleAction(socket, action) {
        const playerId = socket.id;
        console.log(`[TahtSavaslari] Action from ${playerId}:`, action.type);

        switch (action.type) {
            case 'PLACE_TRAP':
                this.placeTrap(playerId, action.column, action.position);
                break;
            case 'DEFENDER_READY':
                this.defenderReady(playerId);
                break;
            case 'NAVIGATE_STEP':
                this.navigateStep(playerId, action.position);
                break;
            case 'DEPLOY_TANK':
                this.deployTank(playerId, action.laneIndex, action.previewIndex || 0);
                break;
            case 'CLICK_REFLEX':
                this.clickReflexCell(playerId, action.x, action.y);
                break;
            case 'PLAYER_READY':
                this.playerReady(playerId);
                break;
        }
    }

    broadcastState() {
        const baseState = {
            phase: this.phase,
            players: this.players,
            challenger: this.challenger,
            challengerName: this.getPlayerName(this.challenger),
            opponent: this.opponent,
            opponentName: this.getPlayerName(this.opponent),
            spectators: this.spectators,
            currentMiniGame: this.currentMiniGame,
            miniGameIndex: this.miniGameIndex,
            miniGameOrder: this.miniGameOrder,
            winner: this.winner,
            winnerName: this.winner ? this.getPlayerName(this.winner) : null,
            loser: this.loser,
            loserName: this.loser ? this.getPlayerName(this.loser) : null,
            readyPlayers: Array.from(this.readyPlayers),
            nextChallenger: this.nextChallenger,
            nextChallengerName: this.nextChallenger ? this.getPlayerName(this.nextChallenger) : null
        };

        if (this.currentMiniGame === this.MINIGAMES.TRAP) {
            baseState.trapState = {
                timeRemaining: this.trapState.timeRemaining,
                currentStep: this.trapState.currentStep,
                defenderReady: this.trapState.defenderReady
            };
        } else if (this.currentMiniGame === this.MINIGAMES.TANK_PUSH && this.tankPushState) {
            baseState.tankPushState = {
                lanes: this.tankPushState.lanes,
                challengerHP: this.tankPushState.challengerHP,
                opponentHP: this.tankPushState.opponentHP,
                challengerPreview: this.tankPushState.challengerPreview,
                opponentPreview: this.tankPushState.opponentPreview,
                timeRemaining: this.tankPushState.timeRemaining,
                spawnTimer: this.tankPushState.spawnTimer,
                arenaLength: this.tankPushState.arenaLength
            };
        } else if (this.currentMiniGame === this.MINIGAMES.REFLEX) {
            baseState.reflexState = {
                greenCell: this.reflexState.greenCell,
                scores: this.reflexState.scores,
                timeRemaining: this.reflexState.timeRemaining,
                targetScore: this.reflexState.targetScore,
                roundActive: this.reflexState.roundActive
            };
        }

        for (const player of this.players) {
            const playerState = { ...baseState, myId: player.id };

            if (this.currentMiniGame === this.MINIGAMES.TRAP) {
                const isChallenger = player.id === this.challenger;
                // Deep copy trapState for each player
                playerState.trapState = {
                    ...baseState.trapState,
                    // Challenger can't see traps during TRAP_PLACING, everyone else can
                    traps: (isChallenger && this.phase === this.PHASES.TRAP_PLACING)
                        ? [null, null, null]
                        : this.trapState.traps
                };
            }

            this.io.to(player.id).emit('gameState', playerState);
        }
    }

    handleDisconnect(socket) {
        console.log(`[TahtSavaslari] Player disconnected: ${socket.id}`);
    }
}

module.exports = TahtSavaslariGame;
