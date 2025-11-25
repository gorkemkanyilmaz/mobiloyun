class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> roomData
        this.socketToRoom = new Map(); // socketId -> roomId
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

    createRoom(socket, { playerName, gameType }) {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                isReady: false,
                avatar: Math.floor(Math.random() * 10) // Random avatar index
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

    joinRoom(socket, { roomId, playerName }) {
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
            avatar: Math.floor(Math.random() * 10)
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

    handleDisconnect(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);

            if (room.players.length === 0) {
                this.rooms.delete(roomId);
            } else {
                // Assign new host if host left
                if (!room.players.some(p => p.isHost)) {
                    room.players[0].isHost = true;
                }
                this.io.to(roomId).emit('roomUpdated', room);
            }
        }
        this.socketToRoom.delete(socket.id);
    }
}

module.exports = RoomManager;
