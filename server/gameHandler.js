const VampirKoylu = require('./games/vampirKoylu');
const SecretHitler = require('./games/secretHitler');

class GameHandler {
    constructor(io, roomManager) {
        this.io = io;
        this.roomManager = roomManager;
        this.games = new Map(); // roomId -> gameInstance
    }

    initGame(room) {
        let gameInstance;
        switch (room.gameType) {
            case 'VAMPIR_KOYLU':
                gameInstance = new VampirKoylu(this.io, room.id, room.players);
                break;
            case 'SECRET_HITLER':
                gameInstance = new SecretHitler(this.io, room.id, room.players);
                break;
            default:
                console.error('Unknown game type:', room.gameType);
                return;
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
        console.log(`[GameHandler] getGameState request from ${socket.id} for room ${roomId}`);
        if (!roomId) return;

        const game = this.games.get(roomId);
        if (game && game.sendStateTo) {
            console.log(`[GameHandler] Sending state for room ${roomId}`);
            game.sendStateTo(socket.id);
        } else {
            console.log(`[GameHandler] Game or sendStateTo not found for room ${roomId}`);
        }
    }
}

module.exports = GameHandler;
