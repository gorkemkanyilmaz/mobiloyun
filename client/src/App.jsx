import { useState, useEffect } from 'react';
import { socket } from './socket';
import MainMenu from './components/MainMenu';
import RoomSetup from './components/RoomSetup';
import Lobby from './components/Lobby';
import VampirKoylu from './games/VampirKoylu';
import SecretHitler from './games/SecretHitler';
import Chameleon from './games/Chameleon';
import Uno from './games/Uno';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [view, setView] = useState('MENU'); // MENU, SETUP, LOBBY, GAME
  const [selectedGame, setSelectedGame] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setView('MENU');
      setRoom(null);
    }

    function onRoomCreated(newRoom) {
      setRoom(newRoom);
      setView('LOBBY');
      setError(null);
    }

    function onRoomJoined(joinedRoom) {
      setRoom(joinedRoom);
      setView('LOBBY');
      setError(null);
    }

    function onRoomUpdated(updatedRoom) {
      setRoom(updatedRoom);
    }

    function onGameStarted(updatedRoom) {
      setRoom(updatedRoom);
      setView('GAME');
    }

    function onError(err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomCreated);
    socket.on('roomJoined', onRoomJoined);
    socket.on('roomUpdated', onRoomUpdated);
    socket.on('gameStarted', onGameStarted);
    socket.on('error', onError);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('roomJoined', onRoomJoined);
      socket.off('roomUpdated', onRoomUpdated);
      socket.off('gameStarted', onGameStarted);
      socket.off('error', onError);
      socket.disconnect();
    };
  }, []);

  const handleSelectGame = (gameId) => {
    setSelectedGame(gameId);
    setView('SETUP');
  };

  const handleCreateRoom = (playerName, avatar) => {
    socket.emit('createRoom', { playerName, gameType: selectedGame, avatar });
  };

  const handleJoinRoom = (roomId, playerName, avatar) => {
    socket.emit('joinRoom', { roomId, playerName, avatar });
  };

  const handleReady = () => {
    socket.emit('playerReady');
  };

  const handleStartGame = () => {
    socket.emit('startGame');
  };

  const handleLeaveRoom = () => {
    socket.disconnect();
    socket.connect(); // Reconnect to get fresh socket ID
    setView('MENU');
    setRoom(null);
  };

  return (
    <div className="app-container">
      <header>
        <h1 onClick={() => setView('MENU')} style={{ cursor: 'pointer' }}>PartyHub</h1>
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Online' : 'Offline'}
        </div>
      </header>

      {error && <div className="error-toast">{error}</div>}

      <main>
        {view === 'MENU' && (
          <MainMenu onSelectGame={handleSelectGame} />
        )}

        {view === 'SETUP' && (
          <RoomSetup
            selectedGame={selectedGame}
            onCreate={handleCreateRoom}
            onJoin={handleJoinRoom}
            onBack={() => setView('MENU')}
          />
        )}

        {view === 'LOBBY' && room && (
          <Lobby
            room={room}
            currentPlayerId={socket.id}
            onReady={handleReady}
            onStart={handleStartGame}
            onLeave={handleLeaveRoom}
          />
        )}

        {view === 'GAME' && (
          <div className="game-wrapper">
            {room?.gameType === 'VAMPIR_KOYLU' && <VampirKoylu room={room} />}
            {room?.gameType === 'SECRET_HITLER' && <SecretHitler room={room} />}
            {room?.gameType === 'CHAMELEON' && <Chameleon room={room} />}
            {room?.gameType === 'UNO' && <Uno room={room} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
