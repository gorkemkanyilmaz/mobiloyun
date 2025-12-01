import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './VampirKoylu.css';

function VampirKoylu({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [logs, setLogs] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [timer, setTimer] = useState(0);
    const [warningMessage, setWarningMessage] = useState('');

    useEffect(() => {
        socket.on('gameState', (state) => {
            setGameState(state);
            setLogs(state.logs || []);
            if (state.timer) setTimer(state.timer);
        });

        socket.on('gameLog', (log) => {
            setLogs(prev => [...prev, log]);
        });

        socket.on('timerUpdate', (time) => {
            setTimer(time);
        });

        // Request initial state
        socket.emit('getGameState');

        return () => {
            socket.off('gameState');
            socket.off('gameLog');
            socket.off('timerUpdate');
        };
    }, []);

    const handleReady = () => {
        socket.emit('gameAction', { type: 'READY' });
    };

    const handleNightReady = () => {
        socket.emit('gameAction', { type: 'NIGHT_READY' });
    };

    const handleAction = () => {
        if (selectedTarget) {
            // Client-side validation: Doctor cannot protect same person twice in a row
            if (gameState.phase === 'NIGHT' && gameState.myRole === 'DOKTOR' &&
                selectedTarget === gameState.doctorLastSaved) {
                setWarningMessage('Bir önceki tur kurtardığın kişiyi tekrar kurtaramazsın!');
                setSelectedTarget(null);
                setTimeout(() => setWarningMessage(''), 3000);
                return;
            }

            if (gameState.phase === 'VOTING') {
                socket.emit('gameAction', { type: 'VOTE', targetId: selectedTarget });
            } else if (gameState.phase === 'NIGHT') {
                socket.emit('gameAction', { type: 'NIGHT_ACTION', targetId: selectedTarget });
            }
            setSelectedTarget(null);
        }
    };

    if (!gameState) return <div className="loading">Oyun Yükleniyor...</div>;

    const myPlayer = room.players.find(p => p.id === socket.id);
    const isAlive = gameState.alive[socket.id];

    // Determine if it's my turn
    let isMyTurn = false;
    let actionPrompt = "";
    let showNightReadyBtn = false;

    if (isAlive) {
        if (gameState.phase === 'ROLE_REVEAL') {
            isMyTurn = !gameState.readyPlayers.includes(socket.id);
            actionPrompt = "Rolünü anladıysan Hazırım de.";
        } else if (gameState.phase === 'VOTING') {
            isMyTurn = !gameState.votes[socket.id];
            actionPrompt = "Şüpheliyi oyla!";
        } else if (gameState.phase === 'NIGHT') {
            if (gameState.myRole === 'VAMPIR') {
                isMyTurn = !gameState.nightActions[socket.id];
                actionPrompt = "Bu gece kimi öldürmek istiyorsun?";
            } else if (gameState.myRole === 'DOKTOR') {
                isMyTurn = !gameState.nightActions[socket.id];
                actionPrompt = "Bu gece kimi kurtarmak istiyorsun? (Bir önceki gece kurtardığın kişiyi tekrar kurtaramazsın)";
            } else if (gameState.myRole === 'KOYLU') {
                // Villager night logic
                showNightReadyBtn = gameState.nightReadyPlayers && !gameState.nightReadyPlayers.includes(socket.id);
            }
        }
    }

    return (
        <div className={`game-container vampir-koylu ${gameState.phase.toLowerCase()}`}>
            <div className="game-header">
                <div className="phase-indicator">
                    {gameState.phase === 'ROLE_REVEAL' && '🎭 ROL DAĞITIMI'}
                    {gameState.phase === 'DAY' && `☀️ GÜNDÜZ (${timer}s)`}
                    {gameState.phase === 'VOTING' && '🗳️ OYLAMA'}
                    {gameState.phase === 'NIGHT' && '🌙 GECE'}
                    {gameState.phase === 'END' && '🏁 OYUN BİTTİ'}
                </div>
                <div className="role-card">
                    <span className="label">Rolün:</span>
                    <span className={`value ${gameState.myRole}`}>{gameState.myRole}</span>
                </div>
            </div>

            <div className="game-area">
                {gameState.phase === 'ROLE_REVEAL' && (
                    <div className="role-reveal-overlay">
                        <h2>Senin Rolün: {gameState.myRole}</h2>
                        <p>
                            {gameState.myRole === 'VAMPIR' && 'Gece köylüleri avla. Diğer vampirlerle işbirliği yap.'}
                            {gameState.myRole === 'DOKTOR' && 'Gece birini vampir saldırısından koru.'}
                            {gameState.myRole === 'KOYLU' && 'Vampirleri bul ve onları köyden at.'}
                        </p>
                        {isMyTurn ? (
                            <button className="ready-btn" onClick={handleReady}>HAZIRIM</button>
                        ) : (
                            <div className="waiting-msg">Diğerleri bekleniyor... ({gameState.readyPlayers.length}/{room.players.length})</div>
                        )}
                    </div>
                )}

                <div className="players-grid">
                    {room.players.map(p => {
                        const pAlive = gameState.alive[p.id];
                        const isMe = p.id === socket.id;
                        const isSelected = selectedTarget === p.id;

                        // Show votes/actions if applicable
                        let statusBadge = null;
                        let voteCount = 0;
                        let votedForName = null;

                        if (gameState.phase === 'ROLE_REVEAL' && gameState.readyPlayers.includes(p.id)) {
                            statusBadge = '✅';
                        } else if (gameState.phase === 'VOTING') {
                            // Calculate votes received
                            voteCount = Object.values(gameState.votes).filter(id => id === p.id).length;

                            // Show who they voted for
                            if (gameState.votes[p.id]) {
                                const targetId = gameState.votes[p.id];
                                votedForName = room.players.find(tp => tp.id === targetId)?.name;
                            }
                        } else if (gameState.phase === 'NIGHT') {
                            if (gameState.myRole === 'VAMPIR' && gameState.nightActions[p.id]) {
                                const targetId = gameState.nightActions[p.id];
                                if (targetId) {
                                    const targetName = room.players.find(tp => tp.id === targetId)?.name;
                                    statusBadge = `🎯 ${targetName}`;
                                }
                            }
                            // Show checkmark for ready villagers
                            if (gameState.nightReadyPlayers && gameState.nightReadyPlayers.includes(p.id)) {
                                // Only show for self
                                if (p.id === socket.id) {
                                    statusBadge = '✅';
                                }
                            }
                        }

                        // Allow self-selection for night actions (Vampire, Doctor) but not for voting
                        const canSelect = pAlive && isMyTurn && gameState.phase !== 'ROLE_REVEAL' && !showNightReadyBtn;
                        const cannotSelectSelf = gameState.phase === 'VOTING' && isMe; // Can't vote for yourself
                        const isClickable = canSelect && !cannotSelectSelf;

                        return (
                            <div
                                key={p.id}
                                className={`player-token ${pAlive ? 'alive' : 'dead'} ${isSelected ? 'selected' : ''}`}
                                onClick={() => isClickable ? setSelectedTarget(p.id) : null}
                            >
                                <div className="avatar">
                                    <img src={`/avatars/avatar_${p.avatar}.png`} alt="avatar" />
                                    {!pAlive && <div className="dead-overlay">💀</div>}
                                    {statusBadge && <div className="status-badge">{statusBadge}</div>}
                                    {gameState.phase === 'VOTING' && (
                                        <div className="vote-badge">{voteCount}</div>
                                    )}
                                </div>
                                <div className="name">{p.name} {isMe ? '(Sen)' : ''}</div>
                                {votedForName && <div className="voted-for">Oy: {votedForName}</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="action-area">
                {warningMessage && <div className="warning-message">{warningMessage}</div>}
                {gameState.phase === 'END' ? (
                    <div className="game-over">
                        <h3>KAZANAN: {gameState.logs[gameState.logs.length - 1]?.message.split(': ')[1]}</h3>
                        <button onClick={() => window.location.reload()}>Ana Menüye Dön</button>
                    </div>
                ) : (
                    <>
                        {!isAlive && (
                            <div className="dead-message">
                                Öldüğünüz için herhangi bir oy kullanamazsınız. Oyun dışı kaldınız.
                            </div>
                        )}

                        {isAlive && gameState.phase === 'NIGHT' && gameState.myRole === 'KOYLU' && (
                            <div className="villager-night-message">
                                Rolünüz Köylü olduğu için bu gece sadece uyuyorsunuz. Hazırsanız butona basın.
                            </div>
                        )}

                        <div className="logs">
                            {logs.map((l, i) => <div key={i} className="log-entry">{l.message}</div>)}
                        </div>

                        {isMyTurn && gameState.phase !== 'ROLE_REVEAL' && !showNightReadyBtn && (
                            <div className="controls">
                                <p>{actionPrompt}</p>
                                <button
                                    disabled={!selectedTarget}
                                    onClick={handleAction}
                                    className="action-btn"
                                >
                                    ONAYLA
                                </button>
                            </div>
                        )}

                        {showNightReadyBtn && (
                            <div className="controls">
                                <button onClick={handleNightReady} className="ready-btn-small">
                                    HAZIRIM
                                </button>
                            </div>
                        )}

                        {gameState.phase === 'DAY' && (
                            <div className="day-info">
                                <p>Tartışma Süresi: {timer} saniye</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div >
    );
}

export default VampirKoylu;
