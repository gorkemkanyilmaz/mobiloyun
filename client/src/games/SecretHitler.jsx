import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './SecretHitler.css';

function SecretHitler({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        socket.on('gameState', (state) => {
            setGameState(state);
            setLogs(state.logs || []);
        });

        socket.on('gameLog', (log) => {
            setLogs(prev => [...prev, log]);
        });

        // Request initial state
        socket.emit('getGameState');

        return () => {
            socket.off('gameState');
            socket.off('gameLog');
        };
    }, []);

    const handleNominate = (targetId) => {
        socket.emit('gameAction', { type: 'NOMINATE', targetId });
    };

    const handleVote = (vote) => {
        socket.emit('gameAction', { type: 'VOTE', vote });
    };

    const handleDiscard = (index) => {
        socket.emit('gameAction', { type: 'DISCARD', index });
    };

    if (!gameState) return <div className="loading">Oyun Yükleniyor...</div>;

    const myPlayer = room.players.find(p => p.id === playerId);
    const isPresident = gameState.presidentId === playerId;
    const isChancellor = gameState.chancellorId === playerId;

    return (
        <div className="secret-hitler">
            <div className="sh-header">
                <div className="role-info">
                    Rolün: <span className={`role ${gameState.myRole}`}>{gameState.myRole}</span>
                </div>
                <div className="status-info">
                    Faz: {gameState.phase}
                </div>
            </div>

            <div className="boards">
                <div className="board liberal">
                    <h3>Liberal Yasalar: {gameState.liberalPolicies} / 5</h3>
                    <div className="track">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`slot ${i < gameState.liberalPolicies ? 'filled' : ''}`}></div>
                        ))}
                    </div>
                </div>
                <div className="board fascist">
                    <h3>Faşist Yasalar: {gameState.fascistPolicies} / 6</h3>
                    <div className="track">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`slot ${i < gameState.fascistPolicies ? 'filled' : ''}`}></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="game-area">
                {gameState.phase === 'ELECTION' && isPresident && (
                    <div className="action-prompt">
                        <h3>Şansölye Adayını Seç:</h3>
                        <div className="player-select">
                            {room.players.map(p => (
                                p.id !== socket.id && p.id !== gameState.lastChancellorId && (
                                    <button key={p.id} onClick={() => handleNominate(p.id)}>{p.name}</button>
                                )
                            ))}
                        </div>
                    </div>
                )}

                {gameState.phase === 'VOTING' && gameState.votes[socket.id] === undefined && (
                    <div className="voting-booth">
                        <h3>Şansölye Adayı: {room.players.find(p => p.id === gameState.chancellorNomineeId)?.name}</h3>
                        <div className="vote-buttons">
                            <button className="ja" onClick={() => handleVote(true)}>JA! (Evet)</button>
                            <button className="nein" onClick={() => handleVote(false)}>NEIN! (Hayır)</button>
                        </div>
                    </div>
                )}

                {gameState.phase === 'LEGISLATIVE' && gameState.hand.length > 0 && (
                    <div className="legislative-session">
                        <h3>Yasa Seçimi (1 tane at):</h3>
                        <div className="cards">
                            {gameState.hand.map((card, i) => (
                                <button key={i} className={`policy-card ${card}`} onClick={() => handleDiscard(i)}>
                                    {card}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="logs-area">
                {logs.slice(-3).map((l, i) => <div key={i}>{l.message}</div>)}
            </div>
        </div>
    );
}

export default SecretHitler;
