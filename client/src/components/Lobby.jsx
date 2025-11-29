import React from 'react';

function Lobby({ room, currentPlayerId, onReady, onStart, onLeave }) {
    const isHost = room.players.find(p => p.id === currentPlayerId)?.isHost;
    const allReady = room.players.every(p => p.isReady);
    const canStart = isHost && allReady && room.players.length >= 2;

    return (
        <div className="lobby">
            <div className="lobby-header">
                <h2>Lobi: {room.id}</h2>
                <span className="game-badge">{room.gameType}</span>
            </div>

            <div className="player-list">
                {room.players.map((player) => (
                    <div key={player.id} className={`player-card ${player.isReady ? 'ready' : ''}`}>
                        <div className="avatar">
                            {/* Real Photo Avatar */}
                            <img
                                src={`https://randomuser.me/api/portraits/${player.avatar}.jpg`}
                                alt="avatar"
                            />
                        </div>
                        <div className="player-info">
                            <span className="player-name">{player.name} {player.id === currentPlayerId ? '(Sen)' : ''}</span>
                            {player.isHost && <span className="host-badge">👑</span>}
                        </div>
                        <div className="status">
                            {player.isReady ? '✅ Hazır' : '⏳ Bekliyor'}
                        </div>
                    </div>
                ))}
            </div>

            <div className="lobby-actions">
                <button
                    className={`ready-btn ${room.players.find(p => p.id === currentPlayerId)?.isReady ? 'active' : ''}`}
                    onClick={onReady}
                >
                    {room.players.find(p => p.id === currentPlayerId)?.isReady ? 'Hazır Değilim' : 'Hazırım!'}
                </button>

                {isHost && (
                    <button className="start-btn" disabled={!canStart} onClick={onStart}>
                        Oyunu Başlat
                    </button>
                )}

                <button className="leave-btn secondary" onClick={onLeave}>
                    Ayrıl
                </button>
            </div>
        </div>
    );
}

export default Lobby;
