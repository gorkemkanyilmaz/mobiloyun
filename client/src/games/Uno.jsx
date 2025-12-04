import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './Uno.css';

function Uno({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [logs, setLogs] = useState([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingCard, setPendingCard] = useState(null); // Card waiting for color choice

    useEffect(() => {
        socket.on('gameState', (state) => {
            setGameState(state);
            setLogs(state.logs || []);
        });

        socket.on('gameLog', (log) => {
            setLogs(prev => [...prev, log]);
        });

        socket.emit('getGameState');

        return () => {
            socket.off('gameState');
            socket.off('gameLog');
        };
    }, []);

    const handlePlayCard = (card) => {
        if (gameState.turnPlayerId !== playerId) return;

        if (card.color === 'black') {
            setPendingCard(card);
            setShowColorPicker(true);
        } else {
            socket.emit('gameAction', { type: 'PLAY_CARD', cardId: card.id });
        }
    };

    const handleColorPick = (color) => {
        if (pendingCard) {
            socket.emit('gameAction', { type: 'PLAY_CARD', cardId: pendingCard.id, chosenColor: color });
            setShowColorPicker(false);
            setPendingCard(null);
        }
    };

    const handleDrawCard = () => {
        if (gameState.turnPlayerId !== playerId) return;
        socket.emit('gameAction', { type: 'DRAW_CARD' });
    };

    const handleSayUno = () => {
        socket.emit('gameAction', { type: 'SAY_UNO' });
    };

    if (!gameState) return <div className="loading">Uno Yükleniyor...</div>;

    const myPlayer = room.players.find(p => p.id === playerId);
    const isMyTurn = gameState.turnPlayerId === playerId;

    // Helper to render a single card
    const renderCard = (card, onClick = null, isPlayable = false) => {
        const isWild = card.color === 'black';
        const displayColor = isWild ? 'black' : card.color;

        let content = card.value;
        if (card.type === 'skip') content = '🚫';
        if (card.type === 'reverse') content = '⇄';
        if (card.type === 'draw2') content = '+2';
        if (card.type === 'wild') content = '🌈';
        if (card.type === 'wild4') content = '+4';

        return (
            <div
                key={card.id}
                className={`uno-card ${displayColor} ${isPlayable ? 'playable' : ''}`}
                onClick={onClick}
            >
                <div className="card-inner">
                    <span className="card-value">{content}</span>
                    <span className="card-icon-small">{content}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="game-container uno">
            {/* Opponents Area */}
            <div className="opponents-area">
                {room.players.filter(p => p.id !== socket.id).map(p => {
                    const isTurn = gameState.turnPlayerId === p.id;
                    const cardCount = gameState.opponentHands[p.id] || 0;

                    return (
                        <div key={p.id} className={`opponent ${isTurn ? 'turn' : ''}`}>
                            <div className="avatar">
                                <img src={`/avatars/avatar_${p.avatar}.png`} alt="avatar" />
                                <div className="card-count-badge">{cardCount}</div>
                            </div>
                            <div className="name">{p.name}</div>
                        </div>
                    );
                })}
            </div>

            {/* Game Center */}
            <div className="game-center">
                {/* Turn Indicator */}
                <div className="center-turn-indicator">
                    Kart Atma Sırası: {gameState.turnPlayerId === playerId ? 'SENDE' : room.players.find(p => p.id === gameState.turnPlayerId)?.name || 'Bilinmeyen'}
                </div>

                <div className="deck-area" onClick={handleDrawCard}>
                    <div className="uno-card back">
                        <div className="oval">UNO</div>
                    </div>
                    {isMyTurn && <div className="draw-hint" onClick={handleDrawCard}>ÇEK</div>}
                </div>

                <div className="discard-area">
                    {gameState.discardTop && renderCard(gameState.discardTop)}
                </div>

                <div className="current-color-indicator" style={{ backgroundColor: gameState.currentColor }}>
                    Rengi
                </div>

                {gameState.direction === 1 ? <div className="direction-indicator cw">↻</div> : <div className="direction-indicator ccw">↺</div>}
            </div>

            {/* Action Buttons */}
            <div className="uno-controls">
                <button
                    className="uno-btn"
                    onClick={handleSayUno}
                    disabled={gameState.myHand.length > 2}
                >
                    UNO!
                </button>
            </div>

            {/* My Hand */}
            <div className={`my-hand ${isMyTurn ? 'active-turn' : ''}`}>
                {gameState.myHand.map(card => {
                    // Check if playable for simple visual feedback
                    const isPlayable = isMyTurn && (
                        card.color === 'black' ||
                        card.color === gameState.currentColor ||
                        (card.type === 'number' && card.value === gameState.discardTop.value) ||
                        (['skip', 'reverse', 'draw2'].includes(card.type) && card.type === gameState.discardTop.type)
                    );

                    return renderCard(card, () => isPlayable && handlePlayCard(card), isPlayable);
                })}
            </div>

            {/* ... Color Picker ... */}
            {showColorPicker && (
                <div className="color-picker-overlay">
                    <div className="color-picker">
                        <h3>Renk Seç</h3>
                        <div className="colors">
                            {['red', 'blue', 'green', 'yellow'].map(c => (
                                <div
                                    key={c}
                                    className={`color-btn ${c}`}
                                    onClick={() => handleColorPick(c)}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Logs */}
            <div className="game-logs">
                {logs.slice(-3).map((l, i) => (
                    <div key={i} className="log-entry">{l.message}</div>
                ))}
            </div>

            {gameState.winner && (
                <div className="winner-overlay">
                    <h1>KAZANAN</h1>
                    <div className="winner-name">
                        {room.players.find(p => p.id === gameState.winner)?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button onClick={() => socket.emit('resetToLobby')}>Lobiye Dön</button>
                        <button onClick={() => socket.emit('playAgain')}>Tekrar Oyna</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Uno;
