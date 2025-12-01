import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './KimDahaYakin.css';

function KimDahaYakin({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [guess, setGuess] = useState('');

    useEffect(() => {
        socket.on('gameState', setGameState);
        socket.emit('getGameState');
        return () => socket.off('gameState');
    }, []);

    const handleSubmit = () => {
        if (guess && !gameState.players[playerId].hasAnswered) {
            socket.emit('gameAction', { type: 'SUBMIT_GUESS', guess: parseInt(guess) });
            setGuess('');
        }
    };

    if (!gameState) return <div className="loading">Yükleniyor...</div>;

    const { phase, currentQuestion, timeRemaining, currentRound, totalRounds, players, roundResults } = gameState;
    const myPlayer = players[playerId];

    return (
        <div className="kim-daha-yakin">
            <div className="game-header">
                <div className="round-info">Tur {currentRound}/{totalRounds}</div>
                <div className="timer">{timeRemaining}s</div>
            </div>

            {phase === 'QUESTION' && (
                <div className="question-phase">
                    <div className="category-badge">{currentQuestion.cat}</div>
                    <h1 className="question-text">{currentQuestion.q}</h1>
                    {!myPlayer.hasAnswered ? (
                        <div className="answer-input">
                            <input
                                type="number"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                                placeholder="Tahmininiz..."
                                autoFocus
                            />
                            <button onClick={handleSubmit}>Gönder</button>
                        </div>
                    ) : (
                        <div className="waiting">✓ Cevap gönderildi, diğerleri bekleniyor...</div>
                    )}
                </div>
            )}

            {phase === 'REVEAL' && roundResults && (
                <div className="reveal-phase">
                    <div className="correct-answer">
                        <span>Doğru Cevap:</span>
                        <h2>{roundResults.correct}</h2>
                    </div>
                    <div className="guesses-list">
                        {roundResults.guesses.map((g, i) => (
                            <div key={i} className={`guess-item ${i === 0 ? 'winner' : ''}`}>
                                <span>{i + 1}. {g.player}</span>
                                <span className="guess-value">{g.guess}</span>
                                <span className="diff">({g.diff} fark)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {phase === 'END' && (
                <div className="end-phase">
                    <h1>Oyun Bitti!</h1>
                    <div className="final-scores">
                        {Object.values(players).sort((a, b) => b.score - a.score).map((p, i) => (
                            <div key={i} className={`score-item ${i === 0 ? 'champion' : ''}`}>
                                <span>{p.name}</span>
                                <span className="score">{p.score} puan</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="scoreboard">
                {Object.values(players).map(p => (
                    <div key={p.name} className={`player-score ${p.name === myPlayer.name ? 'me' : ''}`}>
                        <span>{p.name}</span>
                        <span className="score">{p.score}</span>
                        {p.hasAnswered && phase === 'QUESTION' && <span className="check">✓</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default KimDahaYakin;
