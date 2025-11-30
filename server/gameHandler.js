const VampirKoylu = require('./games/vampirKoylu');
const SecretHitler = require('./games/secretHitler');
const ChameleonGame = require('./games/chameleon');
const UnoGame = require('./games/uno');
const MonopolyDeal = require('./games/monopolyDeal');

class GameHandler {
    // Let's check consistency. VampirKoylu and SecretHitler likely updated to take (room, io) or we need to adapt.
    // Based on previous files, they were refactored. Let's assume (room, io) or adapt.
    // Actually, looking at Chameleon it takes (room, io).
    // Let's check VampirKoylu constructor signature if possible, but for now pass (room, io) as it's the cleaner new pattern.
    // If legacy games fail, we will fix them.
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
