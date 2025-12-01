import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './MonopolyDeal.css';

function MonopolyDeal({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [selectedCardIndex, setSelectedCardIndex] = useState(null);
    const [selectedPaymentCards, setSelectedPaymentCards] = useState([]);
    const [targetPlayerId, setTargetPlayerId] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        socket.on('gameState', (state) => {
            setGameState(state);
            setLogs(state.logs || []);
            // Reset selections on state update
            if (state.phase !== 'PAYMENT') setSelectedPaymentCards([]);
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

        const card = gameState.players[playerId].hand[selectedCardIndex];
        const needsTarget = ['Sly Deal', 'Forced Deal', 'Deal Breaker', 'Debt Collector'].includes(card.subType);

        if (needsTarget && !targetPlayerId && target === 'ACTION') {
            alert('Lütfen bir hedef oyuncu seçin!');
            return;
        }

        socket.emit('gameAction', {
            type: 'PLAY_CARD',
            cardIndex: selectedCardIndex,
            target: target, // 'BANK', 'PROPERTY', 'ACTION'
            opts: { targetId: targetPlayerId }
        });
        setSelectedCardIndex(null);
        setTargetPlayerId(null);
    };

    const handlePayDebt = () => {
        socket.emit('gameAction', {
            type: 'PAY_DEBT',
            cards: selectedPaymentCards // [{source: 'BANK'|'PROPERTY', index: 0, color: 'red'}]
        });
    };

    const togglePaymentSelection = (source, index, color = null, value) => {
        const existingIdx = selectedPaymentCards.findIndex(item =>
            item.source === source && item.index === index && item.color === color
        );

        if (existingIdx >= 0) {
            setSelectedPaymentCards(prev => prev.filter((_, i) => i !== existingIdx));
        } else {
            setSelectedPaymentCards(prev => [...prev, { source, index, color, value }]);
        }
    };

    const handleEndTurn = () => {
        socket.emit('gameAction', { type: 'END_TURN' });
    };

    if (!gameState) return <div className="loading">Oyun Yükleniyor...</div>;

    const myPlayer = gameState.players[playerId];
    const isMyTurn = gameState.turnPlayerId === playerId;
    const isPaymentPhase = gameState.phase === 'PAYMENT' && gameState.paymentRequest?.targetIds.includes(playerId);
    const paymentAmount = gameState.paymentRequest?.amount || 0;
    const currentPaymentValue = selectedPaymentCards.reduce((sum, item) => sum + item.value, 0);

    const renderCard = (card, index, source, color = null) => {
        const isHand = source === 'HAND';
        const isSelected = isHand ? index === selectedCardIndex :
            selectedPaymentCards.some(item => item.source === source && item.index === index && item.color === color);

        const onClick = () => {
            if (isHand) setSelectedCardIndex(index);
            else if (isPaymentPhase) togglePaymentSelection(source, index, color, card.value);
        };

        return (
            <div
                key={`${source}-${index}`}
                className={`card ${card.type.toLowerCase()} ${card.color1 || ''} ${isSelected ? 'selected' : ''}`}
                onClick={onClick}
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

            {isPaymentPhase && (
                <div className="payment-modal">
                    <h2>Ödeme Yapmalısın!</h2>
                    <p>İstenen Tutar: <strong>{paymentAmount}M</strong></p>
                    <p>Seçilen Tutar: <strong>{currentPaymentValue}M</strong></p>
                    <button
                        className="pay-btn"
                        disabled={currentPaymentValue < paymentAmount} // Allow partial if bankrupt logic added later
                        onClick={handlePayDebt}
                    >
                        ÖDE
                    </button>
                </div>
            )}

            <div className="game-board">
                {/* Opponents Area */}
                <div className="opponents-area">
                    {Object.values(gameState.players).map(p => {
                        if (p.id === playerId) return null;
                        return (
                            <div
                                key={p.id}
                                className={`opponent ${targetPlayerId === p.id ? 'target-selected' : ''}`}
                                onClick={() => setTargetPlayerId(p.id)}
                            >
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
                                    {cards.map((c, i) => renderCard(c, i, 'PROPERTY', color))}
                                </div>
                            ))}
                        </div>
                        <div className="my-bank">
                            <h4>Bankam ({myPlayer.bank.reduce((sum, c) => sum + c.value, 0)}M)</h4>
                            {myPlayer.bank.map((c, i) => renderCard(c, i, 'BANK'))}
                        </div>
                    </div>

                    {/* Controls */}
                    {isMyTurn && selectedCardIndex !== null && !isPaymentPhase && (
                        <div className="controls-area">
                            <button className="action-btn btn-bank" onClick={() => handlePlayCard('BANK')}>Bankaya At</button>
                            <button className="action-btn btn-property" onClick={() => handlePlayCard('PROPERTY')}>Yere Aç</button>
                            <button className="action-btn btn-action" onClick={() => handlePlayCard('ACTION')}>Oyna</button>
                        </div>
                    )}

                    {isMyTurn && !isPaymentPhase && (
                        <div className="turn-info">
                            Kalan Hamle: {gameState.actionsRemaining}
                            <button className="action-btn btn-end" onClick={handleEndTurn}>Turu Bitir</button>
                        </div>
                    )}

                    <div className="my-hand">
                        {myPlayer.hand.map((c, i) => renderCard(c, i, 'HAND'))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MonopolyDeal;
