import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../socket';
import './TahtSavaslari.css';

function TahtSavaslari({ room, playerId }) {
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        const handleGameState = (state) => {
            setGameState(state);
        };

        socket.on('gameState', handleGameState);
        socket.emit('getGameState');

        return () => {
            socket.off('gameState', handleGameState);
        };
    }, []);

    const sendAction = useCallback((action) => {
        socket.emit('gameAction', action);
    }, []);

    if (!gameState) {
        return <div className="ts-loading">⏳ Yükleniyor...</div>;
    }

    const { phase, challenger, opponent, myId, currentMiniGame } = gameState;
    const isChallenger = myId === challenger;
    const isOpponent = myId === opponent;
    const isSpectator = !isChallenger && !isOpponent;

    return (
        <div className="ts-container">
            <div className="ts-header">
                <h1>👑 Taht Savaşları</h1>
                {phase !== 'GAME_OVER' && phase !== 'WAITING' && (
                    <div className="ts-matchup">
                        <span className={isChallenger ? 'ts-me' : ''}>⚔️ {gameState.challengerName}</span>
                        <span className="ts-vs">VS</span>
                        <span className={isOpponent ? 'ts-me' : ''}>🛡️ {gameState.opponentName}</span>
                    </div>
                )}
            </div>

            <div className="ts-main">
                {phase === 'WAITING' && <WaitingScreen gameState={gameState} />}
                {phase === 'MATCHUP_INTRO' && <MatchupIntro gameState={gameState} isChallenger={isChallenger} isOpponent={isOpponent} />}
                {(phase === 'TRAP_PLACING' || phase === 'TRAP_NAVIGATING') && (
                    <TrapArena gameState={gameState} isChallenger={isChallenger} isOpponent={isOpponent} isSpectator={isSpectator} sendAction={sendAction} />
                )}
                {phase === 'TANK_PUSH_PLAYING' && (
                    <TankPushGame gameState={gameState} isChallenger={isChallenger} isOpponent={isOpponent} sendAction={sendAction} />
                )}
                {phase === 'REFLEX_PLAYING' && (
                    <ReflexGame gameState={gameState} isChallenger={isChallenger} isOpponent={isOpponent} sendAction={sendAction} />
                )}
                {phase === 'ROUND_RESULT' && <RoundResult gameState={gameState} />}
                {phase === 'WAITING_READY' && <WaitingReady gameState={gameState} sendAction={sendAction} />}
                {phase === 'GAME_OVER' && <GameOver gameState={gameState} />}
            </div>

            {isSpectator && phase !== 'GAME_OVER' && phase !== 'WAITING' && (
                <div className="ts-spectator-badge">👁️ Seyirci Modu</div>
            )}
        </div>
    );
}

function WaitingScreen({ gameState }) {
    return (
        <div className="ts-waiting">
            <div className="ts-crown-anim">👑</div>
            <h2>Oyuncular Bekleniyor...</h2>
            <div className="ts-player-list">
                {gameState.players.map((player, idx) => (
                    <div key={player.id} className="ts-player-item">
                        <span className="ts-player-num">{idx + 1}</span>
                        <span className="ts-player-name">{player.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MatchupIntro({ gameState, isChallenger, isOpponent }) {
    const miniGameNames = { TRAP: '🪤 Tuzak Arenası', TANK_PUSH: '🎖️ Tank Push', REFLEX: '⚡ Refleks Oyunu' };
    return (
        <div className="ts-intro">
            <div className="ts-intro-title">Tur {gameState.miniGameIndex + 1}/3</div>
            <div className="ts-intro-matchup">
                <div className={`ts-intro-player ${isChallenger ? 'me' : ''}`}>
                    <span className="ts-intro-emoji">⚔️</span>
                    <span>{gameState.challengerName}</span>
                    {isChallenger && <span className="ts-you-badge">SEN</span>}
                </div>
                <span className="ts-intro-vs">VS</span>
                <div className={`ts-intro-player ${isOpponent ? 'me' : ''}`}>
                    <span className="ts-intro-emoji">🛡️</span>
                    <span>{gameState.opponentName}</span>
                    {isOpponent && <span className="ts-you-badge">SEN</span>}
                </div>
            </div>
            <div className="ts-intro-game">{miniGameNames[gameState.currentMiniGame]}</div>
        </div>
    );
}

function TrapArena({ gameState, isChallenger, isOpponent, isSpectator, sendAction }) {
    const { trapState, phase } = gameState;
    const isPlacing = phase === 'TRAP_PLACING';
    const isNavigating = phase === 'TRAP_NAVIGATING';

    const handlePlaceTrap = (column, position) => sendAction({ type: 'PLACE_TRAP', column, position });
    const handleNavigate = (position) => sendAction({ type: 'NAVIGATE_STEP', position });
    const handleReady = () => sendAction({ type: 'DEFENDER_READY' });

    return (
        <div className="ts-trap-arena">
            <div className="ts-trap-header">
                <h2>🪤 Tuzak Arenası</h2>
                {isPlacing && <div className="ts-trap-timer">⏱️ {trapState.timeRemaining}s</div>}
            </div>

            <div className="ts-trap-info">
                {isPlacing && isOpponent && <p className="ts-trap-instruction">Tuzakları yerleştir! Her sütun için ÜST, ORTA veya ALT seç.</p>}
                {isPlacing && isChallenger && <p className="ts-trap-instruction">Rakip tuzakları yerleştiriyor... Bekle.</p>}
                {isPlacing && isSpectator && <p className="ts-trap-instruction">Tuzakları görebilirsin! (Seyirci)</p>}
                {isNavigating && isChallenger && <p className="ts-trap-instruction">Tuzaklardan kaç! Her adımda ÜST, ORTA veya ALT seç.</p>}
                {isNavigating && !isChallenger && <p className="ts-trap-instruction">Rakip ilerlemeye çalışıyor...</p>}
            </div>

            <div className="ts-trap-grid">
                {[0, 1, 2].map(col => {
                    // Only show traps to opponent and spectators, NEVER to challenger
                    const canSeeTrap = !isChallenger;

                    return (
                        <div key={col} className="ts-trap-column">
                            <div className="ts-column-label">Adım {col + 1}</div>
                            {[0, 1, 2].map(row => {
                                const hasTrap = canSeeTrap && trapState.traps && trapState.traps[col] === row;
                                const isPassed = trapState.currentStep > col;
                                const isCurrent = trapState.currentStep === col;

                                return (
                                    <div
                                        key={row}
                                        className={`ts-trap-cell ${hasTrap ? 'has-trap' : ''} ${isNavigating && isCurrent && isChallenger ? 'selectable' : ''} ${isPassed ? 'passed' : ''}`}
                                        onClick={() => {
                                            if (isPlacing && isOpponent) handlePlaceTrap(col, row);
                                            if (isNavigating && isChallenger && isCurrent) handleNavigate(row);
                                        }}
                                    >
                                        {hasTrap && <span>💣</span>}
                                        {isPassed && <span>✅</span>}
                                        {isPlacing && isOpponent && !hasTrap && <span>{row === 0 ? 'ÜST' : row === 1 ? 'ORTA' : 'ALT'}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {isPlacing && isOpponent && <button className="ts-ready-btn" onClick={handleReady}>✅ Hazırım</button>}
        </div>
    );
}

// ========== TANK PUSH GAME ==========
function TankPushGame({ gameState, isChallenger, isOpponent, sendAction }) {
    const { tankPushState, challengerName, opponentName } = gameState;
    const canPlay = isChallenger || isOpponent;

    const myQueue = isChallenger ? tankPushState.challengerPreview : tankPushState.opponentPreview;
    const myHP = isChallenger ? tankPushState.challengerHP : tankPushState.opponentHP;
    const enemyHP = isChallenger ? tankPushState.opponentHP : tankPushState.challengerHP;
    const nextTank = myQueue && myQueue.length > 0 ? myQueue[0] : null;

    const handleDeployTank = (laneIndex) => {
        if (!canPlay || !nextTank) return;
        sendAction({ type: 'DEPLOY_TANK', laneIndex, previewIndex: 0 });
    };

    // Tank visual using uploaded image
    const TankIcon = ({ isPlayer, strength }) => (
        <div className={`tank-icon ${isPlayer ? 'player-tank-icon' : 'enemy-tank-icon'} strength-${strength}`}>
            <img src="/tank.png" alt="tank" className="tank-img" />
            <span className="tank-strength-label">{strength}</span>
        </div>
    );

    return (
        <div className="tp-game">
            {/* Enemy Base & HP */}
            <div className="tp-base enemy-base">
                <div className="tp-base-structure">🏰</div>
                <div className="tp-base-hp">
                    <span className="tp-hp-num">{enemyHP}</span>
                    <div className="tp-hp-track">
                        <div className="tp-hp-bar enemy" style={{ width: `${enemyHP}%` }} />
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="tp-arena">
                {/* Left Sidebar */}
                {canPlay && (
                    <div className="tp-sidebar-queue">
                        {nextTank && (
                            <div className="tp-ready-tank">
                                <TankIcon isPlayer={true} strength={nextTank.strength} />
                            </div>
                        )}
                        <div className="tp-queue-tanks">
                            {myQueue && myQueue.slice(1, 4).map((tank, idx) => (
                                <div key={idx} className="tp-queue-tank-small">
                                    <TankIcon isPlayer={true} strength={tank.strength} />
                                </div>
                            ))}
                        </div>
                        <div className="tp-timer-box">🔄 {tankPushState.spawnTimer}s</div>
                    </div>
                )}

                {/* Lanes */}
                <div className="tp-lanes">
                    {[0, 1, 2].map(laneIdx => (
                        <div
                            key={laneIdx}
                            className={`tp-lane ${canPlay ? 'can-deploy' : ''}`}
                            onClick={() => handleDeployTank(laneIdx)}
                        >
                            <div className="tp-lane-road" />
                            {tankPushState.lanes[laneIdx].map(tank => {
                                const posPercent = (tank.pos / tankPushState.arenaLength) * 100;

                                // Perspective-based position:
                                // Challenger/Spectator: topPos = 100 - posPercent (challenger tanks go up)
                                // Opponent: topPos = posPercent (flipped view - their tanks go up too)
                                const topPos = isOpponent ? posPercent : (100 - posPercent);

                                // Determine if this is MY tank for visual rotation only
                                let isMyTank;
                                if (isChallenger) {
                                    isMyTank = tank.isChallenger;
                                } else if (isOpponent) {
                                    isMyTank = !tank.isChallenger;
                                } else {
                                    isMyTank = tank.isChallenger;
                                }

                                return (
                                    <div
                                        key={tank.id}
                                        className={`tp-tank ${isMyTank ? 'my-tank' : 'enemy-tank'}`}
                                        style={{ top: `${topPos}%` }}
                                    >
                                        <TankIcon isPlayer={isMyTank} strength={tank.strength} />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Timer */}
            <div className="tp-game-timer">⏱️ {tankPushState.timeRemaining}s</div>

            {/* My Base & HP */}
            <div className="tp-base my-base">
                <div className="tp-base-hp">
                    <div className="tp-hp-track">
                        <div className="tp-hp-bar player" style={{ width: `${myHP}%` }} />
                    </div>
                    <span className="tp-hp-num">{myHP}</span>
                </div>
                <div className="tp-base-structure">🏰</div>
            </div>

            {!canPlay && <div className="tp-spectator-overlay">👁️ Seyirci Modu</div>}
        </div>
    );
}

function ReflexGame({ gameState, isChallenger, isOpponent, sendAction }) {
    const { reflexState, challenger, opponent } = gameState;
    const canPlay = isChallenger || isOpponent;
    const handleClick = (x, y) => { if (canPlay) sendAction({ type: 'CLICK_REFLEX', x, y }); };

    const grid = [];
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const isGreen = reflexState.greenCell && reflexState.greenCell.x === x && reflexState.greenCell.y === y;
            grid.push({ x, y, isGreen });
        }
    }

    return (
        <div className="ts-reflex">
            <div className="ts-reflex-header">
                <h2>⚡ Refleks Oyunu</h2>
                <div className="ts-reflex-timer">⏱️ {reflexState.timeRemaining}s</div>
            </div>
            <div className="ts-reflex-scores">
                <div className={`ts-score-card ${isChallenger ? 'me' : ''}`}>
                    <span className="ts-score-name">{gameState.challengerName}</span>
                    <span className="ts-score">{reflexState.scores[challenger] || 0}</span>
                </div>
                <span className="ts-vs">vs</span>
                <div className={`ts-score-card ${isOpponent ? 'me' : ''}`}>
                    <span className="ts-score-name">{gameState.opponentName}</span>
                    <span className="ts-score">{reflexState.scores[opponent] || 0}</span>
                </div>
            </div>
            <div className="ts-score-target">İlk {reflexState.targetScore} puanı alan kazanır!</div>
            <div className="ts-reflex-grid">
                {grid.map(cell => (
                    <div key={`${cell.x}-${cell.y}`} className={`ts-reflex-cell ${cell.isGreen ? 'green' : ''}`} onClick={() => handleClick(cell.x, cell.y)} />
                ))}
            </div>
            {!canPlay && <p className="ts-spectator-info">Oyuncuların tıklamalarını izliyorsun...</p>}
        </div>
    );
}

function RoundResult({ gameState }) {
    const { loser, loserName, myId } = gameState;
    const iAmLoser = myId === loser;
    return (
        <div className="ts-result">
            {iAmLoser ? (
                <>
                    <div className="ts-result-icon lose">😢</div>
                    <h2 className="ts-lose-text">Kaybettin!</h2>
                    <p>Sıradaki oyuncu başlayacak...</p>
                </>
            ) : (
                <>
                    <div className="ts-result-icon">🎉</div>
                    <h2>Tur Tamamlandı!</h2>
                    <p>{loserName} kaybetti!</p>
                </>
            )}
        </div>
    );
}

function WaitingReady({ gameState, sendAction }) {
    const { readyPlayers, players, myId, nextChallengerName, loserName } = gameState;
    const isReady = readyPlayers.includes(myId);
    const handleReady = () => sendAction({ type: 'PLAYER_READY' });

    return (
        <div className="ts-waiting-ready">
            <div className="ts-loss-announcement">
                <div className="ts-loss-icon">💀</div>
                <h2>{loserName} Elendi!</h2>
                <p>Sıradaki taht için mücadele edecek:</p>
                <div className="ts-next-challenger">
                    <span className="ts-crown-small">👑</span>
                    <span>{nextChallengerName}</span>
                </div>
            </div>
            <div className="ts-ready-section">
                <h3>Hazır mısınız?</h3>
                <div className="ts-ready-list">
                    {players.map(player => {
                        const playerReady = readyPlayers.includes(player.id);
                        const isMe = player.id === myId;
                        return (
                            <div key={player.id} className={`ts-ready-item ${playerReady ? 'ready' : ''} ${isMe ? 'me' : ''}`}>
                                <span>{player.name}</span>
                                <span>{playerReady ? '✅' : '⏳'}</span>
                            </div>
                        );
                    })}
                </div>
                {!isReady && <button className="ts-ready-btn large" onClick={handleReady}>✋ Hazırım!</button>}
                {isReady && <p className="ts-waiting-others">Diğer oyuncular bekleniyor...</p>}
            </div>
        </div>
    );
}

function GameOver({ gameState }) {
    const handleExit = () => {
        socket.disconnect();
        localStorage.removeItem('ph_roomId');
        localStorage.removeItem('ph_playerId');
        socket.connect();
        window.location.href = '/';
    };
    return (
        <div className="ts-gameover">
            <div className="ts-crown-winner">👑</div>
            <h1>TAHTIN KRALI</h1>
            <h2 className="ts-winner-name">{gameState.winnerName}</h2>
            <p>Tüm rakipleri yenerek tahta çıktı!</p>
            <button className="ts-exit-btn" onClick={handleExit}>🏠 Ana Menü</button>
        </div>
    );
}

export default TahtSavaslari;
