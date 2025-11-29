import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './Chameleon.css';

function Chameleon({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [logs, setLogs] = useState([]);
    const [selectedVote, setSelectedVote] = useState(null);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        socket.on('gameState', (state) => {
            console.log('Received GameState:', state);
            console.log('First Speaker ID:', state.firstSpeakerId);
            setGameState(state);
            // Always replace logs with server state logs to ensure clearing works
            setLogs(state.logs || []);
            if (state.timer) setTimer(state.timer);
        });

        socket.on('gameLog', (log) => {
            setLogs(prev => [...prev, log]);
        });

        socket.on('timerUpdate', (time) => {
            setTimer(time);
        });

        socket.emit('getGameState');

        return () => {
            socket.off('gameState');
            socket.off('gameLog');
            socket.off('timerUpdate');
        };
    }, []);

    const handleStartRound = () => {
        socket.emit('gameAction', { type: 'START_ROUND' });
    };

    const handleVote = () => {
        if (selectedVote) {
            socket.emit('gameAction', { type: 'VOTE', targetId: selectedVote });
        }
    };

    const handleGuess = (word) => {
        socket.emit('gameAction', { type: 'GUESS_WORD', word });
    };

    if (!gameState) return <div className="loading">Oyun Yükleniyor...</div>;

    const myPlayer = room.players.find(p => p.id === socket.id);
    const isHost = myPlayer?.isHost;
    const isChameleon = gameState.myRole === 'CHAMELEON';

    return (
        <div className="game-container chameleon">
            <div className="game-header">
                <div className="phase-indicator">
                    {gameState.phase === 'ROLE_REVEAL' && '🎭 ROL DAĞITIMI'}
                    {gameState.phase === 'DISCUSSION' && `🗣️ TARTIŞMA (${timer}s)`}
                    {gameState.phase === 'VOTING' && '🗳️ OYLAMA'}
                    {gameState.phase === 'CHAMELEON_GUESS' && '🦎 BUKALEMUN TAHMİNİ'}
                    {gameState.phase === 'END' && '🏁 OYUN BİTTİ'}
                </div>
                <div className="role-card">
                    <span className="label">Rolün:</span>
                    <span className={`value ${isChameleon ? 'imposter' : 'citizen'}`}>
                        {isChameleon ? 'BUKALEMUN' : 'VATANDAŞ'}
                    </span>
                </div>
            </div>

            <div className="info-card">
                <div className="topic-info">
                    <h3>KONU: {gameState.topic}</h3>
                </div>
                <div className="secret-word-box">
                    {isChameleon ? (
                        <div className="imposter-msg">
                            Sen Bukalemunsun! Konuyu biliyorsun ama kelimeyi bilmiyorsun.
                            Çaktırmadan diğerlerine uyum sağla!
                        </div>
                    ) : (
                        <div className="secret-word">
                            GİZLİ KELİME: <span>{gameState.secretWord}</span>
                        </div>
                    )}
                    {gameState.phase === 'DISCUSSION' && (
                        <div className="discussion-timer" style={{ marginTop: '10px', fontSize: '1.2rem', color: '#ffeb3b' }}>
                            ⏳ {timer}
                        </div>
                    )}
                </div>
            </div>

            <div className="game-area">
                {gameState.phase === 'CHAMELEON_GUESS' && isChameleon ? (
                    <div className="guess-grid">
                        <h3>Gizli Kelimeyi Tahmin Et!</h3>
                        <div className="words-container">
                            {gameState.wordList.map(word => (
                                <button key={word} onClick={() => handleGuess(word)} className="word-btn">
                                    {word}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="players-grid">
                        {room.players.map(p => {
                            const isMe = p.id === socket.id;
                            const isSelected = selectedVote === p.id;
                            const isFirstSpeaker = gameState.firstSpeakerId === p.id;

                            // Show votes
                            const voteCount = gameState.phase === 'VOTING' || gameState.phase === 'END'
                                ? Object.values(gameState.votes).filter(id => id === p.id).length
                                : 0;

                            return (
                                <div
                                    key={p.id}
                                    className={`player-token ${isSelected ? 'selected' : ''}`}
                                    onClick={() => gameState.phase === 'VOTING' && !isMe ? setSelectedVote(p.id) : null}
                                >
                                    <div className="avatar">
                                        <img src={`/avatars/avatar_${p.avatar}.png`} alt="avatar" />
                                        {voteCount > 0 && <div className="vote-badge">{voteCount}</div>}
                                        {isFirstSpeaker && <div className="speaker-badge" title="İlk Konuşmacı">📢</div>}
                                    </div>
                                    <div className="name">{p.name} {isMe ? '(Sen)' : ''}</div>
                                    <div className="score">Puan: {gameState.scores ? gameState.scores[p.id] : 0}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="action-area">
                <div className="logs">
                    {logs.map((l, i) => <div key={i} className="log-entry">{l.message}</div>)}
                </div>

                <div className="controls">
                    {gameState.phase === 'ROLE_REVEAL' && isHost && (
                        <button onClick={handleStartRound} className="action-btn">TARTIŞMAYI BAŞLAT</button>
                    )}

                    {gameState.phase === 'VOTING' && (
                        <button
                            onClick={handleVote}
                            disabled={!selectedVote}
                            className="action-btn"
                        >
                            OYLA
                        </button>
                    )}

                    {gameState.phase === 'END' && (
                        <div className="next-round-msg">Yeni tur 5 saniye içinde başlıyor...</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Chameleon;
