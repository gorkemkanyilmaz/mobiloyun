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

        let gameInstance;
        // Check game type to determine constructor signature
        if (room.gameType === 'CHAMELEON' || room.gameType === 'UNO') {
            // New signature: (room, io)
            gameInstance = new GameClass(room, this.io);
        } else {
            // Legacy signature: (io, roomId, players)
            // Used by: VAMPIR_KOYLU, SECRET_HITLER, MONOPOLY_DEAL
            gameInstance = new GameClass(this.io, room.id, room.players);
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
