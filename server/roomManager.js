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

        this.socketToRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.join(player.id); // Join the "channel" of the old ID

        // Resume game if all connected
        const allConnected = room.players.every(p => p.connected);
        if (allConnected && room.status === 'PAUSED') {
            room.status = 'PLAYING';
            this.io.to(roomId).emit('gameResumed');
        }

        socket.emit('rejoinSuccess', { room, playerId: player.id });
        this.io.to(roomId).emit('roomUpdated', room);
        console.log(`Player ${player.name} reconnected to ${roomId}`);
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
                    this.removePlayer(roomId, player.id);
                }, 5 * 60 * 1000); // 5 minutes

                this.disconnectTimeouts.set(player.id, timeout);

                this.io.to(roomId).emit('roomUpdated', room);
            }
        }
        this.socketToRoom.delete(socket.id);
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
