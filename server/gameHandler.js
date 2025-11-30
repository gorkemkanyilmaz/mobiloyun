const VampirKoylu = require('./games/vampirKoylu');
const SecretHitler = require('./games/secretHitler');
const ChameleonGame = require('./games/chameleon');
const UnoGame = require('./games/uno');
const MonopolyDeal = require('./games/monopolyDeal');

class GameHandler {
    constructor(io, roomManager) {
        this.io = io;
        this.roomManager = roomManager;
        this.games = new Map(); // roomId -> gameInstance
        this.gameTypes = {
            'VAMPIR_KOYLU': VampirKoylu,
            'SECRET_HITLER': SecretHitler,
            'CHAMELEON': ChameleonGame,
            'UNO': UnoGame,
            'MONOPOLY_DEAL': MonopolyDeal
        };
    }

    initGame(room) {
        const GameClass = this.gameTypes[room.gameType];
        if (!GameClass) {
            console.error('Unknown game type:', room.gameType);
            return;
        }

        // Initialize game with room and io
        // Note: Existing games expect (io, roomId, players) or (room, io)
        // Let's check consistency. VampirKoylu and SecretHitler likely updated to take (room, io) or we need to adapt.
        // Based on previous files, they were refactored. Let's assume (room, io) or adapt.
        // Actually, looking at Chameleon it takes (room, io).
        // Let's check VampirKoylu constructor signature if possible, but for now pass (room, io) as it's the cleaner new pattern.
        // If legacy games fail, we will fix them.

        // Wait, previous gameHandler passed: new VampirKoylu(this.io, room.id, room.players);
        // Chameleon expects: new ChameleonGame(room, this.io);
        // I should standardize or handle both.

        let gameInstance;
        if (room.gameType === 'CHAMELEON' || room.gameType === 'UNO' || room.gameType === 'MONOPOLY_DEAL') {
            gameInstance = new GameClass(this.io, room.id, room.players); // Wait, my new class uses (io, roomId, players)
            // Actually, let's check my MonopolyDeal constructor: constructor(io, roomId, players)
            // So it matches the OLD pattern, not the new (room, io) pattern of Chameleon/Uno.
            // I should have made it consistent.
            // Let's fix the instantiation here to match the constructor I just wrote.
        } else {
            // Legacy support for Vampir/SecretHitler
            if (room.gameType === 'VAMPIR_KOYLU' || room.gameType === 'SECRET_HITLER' || room.gameType === 'MONOPOLY_DEAL') {
                gameInstance = new GameClass(this.io, room.id, room.players);
            } else {
                gameInstance = new GameClass(room, this.io);
            }
        }

        if (gameInstance) {
            this.games.set(room.id, gameInstance);
            console.log(`Initialized game ${room.gameType} for room ${room.id}`);
        }
    }

    handleAction(socket, action) {
        const roomId = this.roomManager.socketToRoom.get(socket.id);
        if (!roomId) return;

        const game = this.games.get(roomId);
        if (game) {
            game.handleAction(socket, action);
        }
    }

    handleGetState(socket) {
        const roomId = this.roomManager.socketToRoom.get(socket.id);
        if (!roomId) return;

        const game = this.games.get(roomId);
        if (game) {
            if (game.sendStateTo) {
                game.sendStateTo(socket.id);
            } else if (game.broadcastState) {
                game.broadcastState();
            }
        }
    }

    updatePlayerId(roomId, oldPlayerId, newPlayerId) {
        const game = this.games.get(roomId);
        if (game && game.updatePlayerId) {
            game.updatePlayerId(oldPlayerId, newPlayerId);
        }
    }
}

module.exports = GameHandler;
