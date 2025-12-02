const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const RoomManager = require('./roomManager');
const GameHandler = require('./gameHandler');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('PartyHub Server is Running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const roomManager = new RoomManager(io);
const gameHandler = new GameHandler(io, roomManager);
roomManager.setGameHandler(gameHandler);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Room Management
    socket.on('createRoom', (data) => roomManager.createRoom(socket, data));
    socket.on('joinRoom', (data) => roomManager.joinRoom(socket, data));
    socket.on('playerReady', (data) => roomManager.playerReady(socket, data));
    socket.on('startGame', () => roomManager.startGame(socket));
    socket.on('rejoinRoom', (data) => roomManager.rejoinRoom(socket, data));
    socket.on('resetToLobby', () => roomManager.resetToLobby(socket));
    socket.on('playAgain', () => roomManager.playAgain(socket));

    // Game Events
    socket.on('gameAction', (data) => gameHandler.handleAction(socket, data));
    socket.on('getGameState', () => gameHandler.handleGetState(socket));

    socket.on('disconnect', () => {
        roomManager.handleDisconnect(socket);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
