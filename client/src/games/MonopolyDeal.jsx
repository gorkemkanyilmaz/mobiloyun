import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './MonopolyDeal.css';

function MonopolyDeal({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [logs, setLogs] = useState([]);

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

    const handlePlayCard = (target) => {
        if (selectedCardIndex === null) return;

        socket.emit('gameAction', {
            type: 'PLAY_CARD',
            cardIndex: selectedCardIndex,
            target: target, // 'BANK', 'PROPERTY', 'ACTION'
            opts: {} // For color selection later
        });
        setSelectedCardIndex(null);
    };

    const handleEndTurn = () => {
        socket.emit('gameAction', { type: 'END_TURN' });
    };

    if (!gameState) return <div className="loading">Oyun Yükleniyor...</div>;

    const myPlayer = gameState.players[playerId];
    const isMyTurn = gameState.turnPlayerId === playerId;

    const renderCard = (card, index, isHand = false) => {
        const isSelected = isHand && index === selectedCardIndex;
        return (
            <div
                key={index}
                className={`card ${card.type.toLowerCase()} ${card.color1 || ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => isHand && setSelectedCardIndex(index)}
            >
                <div className="card-value">{card.value}M</div>
                <div className="card-header">{card.subType}</div>
                <div className="card-body">
                    {card.type === 'PROPERTY' && <div className="property-icon">🏠</div>}
                    {card.type === 'MONEY' && <div className="money-icon">💰</div>}
                    {card.type === 'ACTION' && <div className="action-icon">⚡</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="monopoly-deal">
            <div className="game-logs">
                {logs.slice(-5).map((l, i) => <div key={i}>{l.message}</div>)}
            </div>

            <div className="game-board">
                {/* Opponents Area */}
                <div className="opponents-area">
                    {Object.values(gameState.players).map(p => {
                        if (p.id === playerId) return null;
                        return (
                            <div key={p.id} className="opponent">
                                <h3>{p.name} {gameState.turnPlayerId === p.id && '⏳'}</h3>
                                <div className="bank-preview">Banka: {p.bank.length} Kart</div>
                                <div className="properties-preview">
                                    {Object.entries(p.properties).map(([color, cards]) => (
                                        <div key={color}>{color}: {cards.length}</div>
                                    ))}
                                </div>
                                <div className="hand-count">El: {p.hand} Kart</div>
                            </div>
                        );
                    })}
                </div>

                {/* My Area */}
                <div className="player-area">
                    <div className="my-table">
                        <div className="my-properties">
                            <h4>Tapularım</h4>
                            {Object.entries(myPlayer.properties).map(([color, cards]) => (
                                <div key={color} className="property-set">
                                    {cards.map((c, i) => renderCard(c, i))}
                                </div>
                            ))}
                        </div>
                        <div className="my-bank">
                            <h4>Bankam ({myPlayer.bank.reduce((sum, c) => sum + c.value, 0)}M)</h4>
                            {myPlayer.bank.map((c, i) => renderCard(c, i))}
                        </div>
                    </div>

                    {/* Controls */}
                    {isMyTurn && selectedCardIndex !== null && (
                        <div className="controls-area">
                            <button className="action-btn btn-bank" onClick={() => handlePlayCard('BANK')}>Bankaya At</button>
                            <button className="action-btn btn-property" onClick={() => handlePlayCard('PROPERTY')}>Yere Aç</button>
                            <button className="action-btn btn-action" onClick={() => handlePlayCard('ACTION')}>Oyna</button>
                        </div>
                    )}

                    {isMyTurn && (
                        <div className="turn-info">
                            Kalan Hamle: {gameState.actionsRemaining}
                            <button className="action-btn btn-end" onClick={handleEndTurn}>Turu Bitir</button>
                        </div>
                    )}

                    <div className="my-hand">
                        {myPlayer.hand.map((c, i) => renderCard(c, i, true))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonopolyDeal;
