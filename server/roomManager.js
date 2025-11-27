class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> roomData
        this.socketToRoom = new Map(); // socketId -> roomId
        this.disconnectTimeouts = new Map(); // playerId -> timeout
        this.gameHandler = null; // Will be set by index.js
    }

    setGameHandler(handler) {
        this.gameHandler = handler;
    }

    generateRoomId() {
        // Generate a 6-character uppercase alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Ensure uniqueness
        if (this.rooms.has(result)) {
            return this.generateRoomId();
        }
        return result;
    }

    createRoom(socket, { playerName, gameType, avatar }) {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                isReady: false,
                connected: true,
                avatar: avatar || '1' // Use provided avatar or default
            }],
            gameState: null,
            gameType: gameType || 'VAMPIR_KOYLU', // Default or selected
            status: 'LOBBY'
        };

        this.rooms.set(roomId, room);
        this.socketToRoom.set(socket.id, roomId);

        socket.join(roomId);
        socket.emit('roomCreated', room);
        console.log(`Room created: ${roomId} by ${playerName} for ${room.gameType}`);
    }

    joinRoom(socket, { roomId, playerName, avatar }) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.status !== 'LOBBY') {
            socket.emit('error', { message: 'Game already started' });
            return;
        }

        if (room.players.length >= 8) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        if (room.players.some(p => p.name === playerName)) {
            socket.emit('error', { message: 'Name already taken in this room' });
            return;
        }

        const newPlayer = {
            id: socket.id,
            name: playerName,
            isHost: false,
            isReady: false,
            connected: true,
            avatar: avatar || '1'
        };

        room.players.push(newPlayer);
        this.socketToRoom.set(socket.id, roomId);

        socket.join(roomId);
        socket.emit('roomJoined', room);
        this.io.to(roomId).emit('roomUpdated', room);
        console.log(`${playerName} joined room ${roomId}`);
    }

    playerReady(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = !player.isReady;
            this.io.to(roomId).emit('roomUpdated', room);

            // Check if all ready to possibly auto-start or notify host
            const allReady = room.players.every(p => p.isReady);
            if (allReady && room.players.length >= 2) { // Min 2 players
                this.io.to(roomId).emit('readyToStart', { canStart: true });
            }
        }
    }

    startGame(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', { message: 'Only host can start game' });
            return;
        }

        if (!room.players.every(p => p.isReady)) {
            socket.emit('error', { message: 'Not all players are ready' });
            return;
        }

        room.status = 'PLAYING';
        this.io.to(roomId).emit('gameStarted', room);
        console.log(`Game started in room ${roomId}`);

        // Initialize game logic
        this.gameHandler.initGame(room);
    }

    rejoinRoom(socket, { roomId, playerId }) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found or expired' });
            return;
        }

        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            socket.emit('error', { message: 'Player not found in this room' });
            return;
        }

        player.connected = true;

        // Clear timeout from Map
        if (this.disconnectTimeouts.has(player.id)) {
            clearTimeout(this.disconnectTimeouts.get(player.id));
            this.disconnectTimeouts.delete(player.id);
        }

        // CRITICAL FIX: Update player ID to new socket ID
        // This ensures game logic (which uses socket.id) works for the reconnected player.
        const oldPlayerId = player.id;
        const newPlayerId = socket.id;

        player.id = newPlayerId; // Update internal player object
        this.socketToRoom.delete(oldPlayerId); // Remove old mapping (if any)
        this.socketToRoom.set(newPlayerId, roomId); // Add new mapping

        // Update Game Handler to migrate game state
        if (this.gameHandler) {
            this.gameHandler.updatePlayerId(roomId, oldPlayerId, newPlayerId);
        }

        socket.join(roomId);

        // Resume game if all connected
        const allConnected = room.players.every(p => p.connected);
        if (allConnected && room.status === 'PAUSED') {
            room.status = 'PLAYING';
            this.io.to(roomId).emit('gameResumed');
        }

        socket.emit('rejoinSuccess', { room, playerId: newPlayerId });
        this.io.to(roomId).emit('roomUpdated', room);
        console.log(`Player ${player.name} reconnected to ${roomId} (ID updated: ${oldPlayerId} -> ${newPlayerId})`);
    }

    handleDisconnect(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);

            if (player) {
                player.connected = false;
                console.log(`Player ${player.name} disconnected (soft)`);

                // Pause Game
                if (room.status === 'PLAYING') {
                    room.status = 'PAUSED';
                    this.io.to(roomId).emit('gamePaused', {
                        pausedBy: player.name
                    });
                }

                // Set timeout to fully remove (Store in Map, NOT in player object)
                const timeout = setTimeout(() => {
                    // STRICT TIMEOUT: If player doesn't return in 1 minute, close the room for everyone.
                    console.log(`Player ${player.name} timed out. Closing room ${roomId}.`);

                    this.io.to(roomId).emit('roomClosed', {
                        reason: `${player.name} tekrar bağlanmadı. Oyun iptal edildi.`
                    });

                    this.rooms.delete(roomId);
                    // Cleanup all timeouts for this room? 
                    // Ideally yes, but for now just deleting room prevents interactions.

                }, 60 * 1000); // 1 minute strict timeout

                this.disconnectTimeouts.set(player.id, timeout);

                this.io.to(roomId).emit('roomUpdated', room);
            }
        }
        this.socketToRoom.delete(socket.id);
    }

    resetToLobby(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        // Only host can reset? Or anyone? Let's say anyone for now or just host.
        // Usually host controls flow.
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        room.status = 'LOBBY';
        room.gameState = null;
        room.players.forEach(p => p.isReady = false);

        this.io.to(roomId).emit('roomUpdated', room);
    }

    playAgain(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        // Reset game state but keep players
        room.status = 'PLAYING';
        room.gameState = null;

        // Re-init game
        this.io.to(roomId).emit('gameStarted', room);
        this.gameHandler.initGame(room);
    }

    removePlayer(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players = room.players.filter(p => p.id !== playerId);

        // Clean up timeout if exists
        if (this.disconnectTimeouts.has(playerId)) {
            clearTimeout(this.disconnectTimeouts.get(playerId));
            this.disconnectTimeouts.delete(playerId);
        }

        if (room.players.length === 0) {
            this.rooms.delete(roomId);
        } else {
            if (!room.players.some(p => p.isHost)) {
                room.players[0].isHost = true;
            }
            // If game was paused and this guy left, maybe resume?
            // Or if not enough players, end game.
            if (room.players.length < 2 && room.status !== 'LOBBY') {
                room.status = 'LOBBY'; // Reset to lobby
                this.io.to(roomId).emit('gameEnded', { reason: 'Not enough players' });
            } else if (room.status === 'PAUSED') {
                // Check if everyone else is connected
                if (room.players.every(p => p.connected)) {
                    room.status = 'PLAYING';
                    this.io.to(roomId).emit('gameResumed');
                }
            }
            this.io.to(roomId).emit('roomUpdated', room);
        }
    }
}

module.exports = RoomManager;
