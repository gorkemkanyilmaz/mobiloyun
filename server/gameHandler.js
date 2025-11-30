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
