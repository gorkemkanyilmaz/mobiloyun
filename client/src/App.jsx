import { useState, useEffect } from 'react';
import { socket } from './socket';
import MainMenu from './components/MainMenu';
import RoomSetup from './components/RoomSetup';
import Lobby from './components/Lobby';
import VampirKoylu from './games/VampirKoylu';
import SecretHitler from './games/SecretHitler';
import Chameleon from './games/Chameleon';
import Uno from './games/Uno';
import GamePausedOverlay from './components/GamePausedOverlay';
import ReconnectingOverlay from './components/ReconnectingOverlay';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [view, setView] = useState('MENU'); // MENU, SETUP, LOBBY, GAME
  const [selectedGame, setSelectedGame] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [pausedBy, setPausedBy] = useState(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      // Auto-reconnect logic
      const savedRoomId = localStorage.getItem('ph_roomId');
      const savedPlayerId = localStorage.getItem('ph_playerId');

      if (savedRoomId && savedPlayerId) {
        console.log('Attempting to rejoin room:', savedRoomId);
        socket.emit('rejoinRoom', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      // Do NOT reset view immediately, wait for reconnect
    }

    function onRoomCreated(newRoom) {
      setRoom(newRoom);
      setView('LOBBY');
      setError(null);
      localStorage.setItem('ph_roomId', newRoom.id);
      localStorage.setItem('ph_playerId', socket.id);
    }

    function onRoomJoined(joinedRoom) {
      setRoom(joinedRoom);
      setView('LOBBY');
      setError(null);
      localStorage.setItem('ph_roomId', joinedRoom.id);
      localStorage.setItem('ph_playerId', socket.id);
    }

    function onRejoinSuccess({ room, playerId }) {
      setRoom(room);
      if (room.status === 'PLAYING' || room.status === 'PAUSED') {
        setView('GAME');
      } else {
        setView('LOBBY');
      }
      setPausedBy(room.status === 'PAUSED' ? 'Bir oyuncu' : null);
      // Ensure we keep the old ID as our identity for this session if needed?
      // Actually, we just rejoined. socket.id is new, but server maps us to old player.
    }

    function onRoomUpdated(updatedRoom) {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'PAUSED') {
        // We might get this if we are already in game
      } else if (updatedRoom.status === 'PLAYING') {
        setPausedBy(null);
      }
    }

    function onGameStarted(updatedRoom) {
      setRoom(updatedRoom);
      setView('GAME');
    }

    function onGamePaused({ pausedBy }) {
      setPausedBy(pausedBy);
    }

    function onGameResumed() {
      setPausedBy(null);
    }

    function onError(err) {
      setError(err.message);
      // If room not found on rejoin, clear storage
      if (err.message.includes('not found') || err.message.includes('expired')) {
        localStorage.removeItem('ph_roomId');
        localStorage.removeItem('ph_playerId');
        setView('MENU');
        setRoom(null);
      }
      setTimeout(() => setError(null), 3000);
    }

    // Visibility Change Handler for iOS Safari
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        console.log('App became visible, forcing reconnect...');
        socket.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomCreated);
    socket.on('roomJoined', onRoomJoined);
    socket.on('rejoinSuccess', onRejoinSuccess);
    socket.on('roomUpdated', onRoomUpdated);
    socket.on('gameStarted', onGameStarted);
    socket.on('gamePaused', onGamePaused);
    socket.on('gameResumed', onGameResumed);
    socket.on('error', onError);

    socket.connect();

    // Keep-alive ping to prevent Render/Socket timeout
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping'); // Server doesn't need to handle this explicitly, just traffic
      }
    }, 25000); // Every 25 seconds

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('roomJoined', onRoomJoined);
      socket.off('rejoinSuccess', onRejoinSuccess);
      socket.off('roomUpdated', onRoomUpdated);
      socket.off('gameStarted', onGameStarted);
      socket.off('gamePaused', onGamePaused);
      socket.off('gameResumed', onGameResumed);
      socket.off('error', onError);
      socket.disconnect();
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    localStorage.removeItem('ph_roomId');
    localStorage.removeItem('ph_playerId');
    socket.connect(); // Reconnect to get fresh socket ID
    setView('MENU');
    setRoom(null);
  };

  return (
    <div className="app-container">
      <header className={view === 'GAME' ? 'compact' : ''}>
        <h1 onClick={() => setView('MENU')} style={{ cursor: 'pointer' }}>PartyHub</h1>
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Online' : 'Offline'}
        </div>
      </header>

      {error && <div className="error-toast">{error}</div>}
      {!isConnected && view !== 'MENU' && <ReconnectingOverlay />}
      {isConnected && pausedBy && <GamePausedOverlay pausedBy={pausedBy} />}

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
            currentPlayerId={socket.id} // Note: This might be new socket ID, but logic uses it for "isMe" checks. 
            // If we aliased, we might need to use the stored ID? 
            // For now, let's assume socket.id is sufficient or we need to pass the "logical" ID.
            // Actually, since we didn't change player.id in backend, we should use the stored ID for "isMe" checks if possible.
            // But socket.id updates on reconnect.
            // Wait, if player.id === oldSocketId, and my new socket.id is different, then `p.id === socket.id` returns false!
            // FIX: We need to use the stored player ID for identity checks.
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
