import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import './Taboo.css';

function Taboo({ room, playerId }) {
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        socket.on('gameState', setGameState);
        socket.emit('getGameState');
        return () => socket.off('gameState');
    }, []);

    const assignTeam = (team) => socket.emit('gameAction', { type: 'ASSIGN_TEAM', team });
    const startGame = () => socket.emit('gameAction', { type: 'START_GAME' });
    const bildi = () => socket.emit('gameAction', { type: 'BILDI' });
    const pas = () => socket.emit('gameAction', { type: 'PAS' });
    const hatali = () => socket.emit('gameAction', { type: 'HATALI' });
    const nextRound = () => socket.emit('gameAction', { type: 'NEXT_ROUND' });

    if (!gameState) return <div className="loading">Yükleniyor...</div>;

    const { phase, teams, currentTeam, currentDescriber, currentCard, timeRemaining, passesRemaining, roundScore } = gameState;
    const myTeam = teams.mavi.players.includes(playerId) ? 'mavi' : teams.kirmizi.players.includes(playerId) ? 'kirmizi' : null;
    const isDescriber = currentDescriber === playerId;
    const opposingTeam = currentTeam === 'mavi' ? 'kirmizi' : 'mavi';

    return (
        <div className="taboo-game">
            {phase === 'TEAM_SETUP' && (
                <div className="team-setup">
                    <h2>Takımları Oluştur</h2>
                    <div className="teams-container">
                        <div className="team mavi">
                            <h3>Mavi Takım ({teams.mavi.score})</h3>
                            <div className="team-players">
                                {teams.mavi.players.map(p => {
                                    const player = room.players.find(pl => pl.id === p);
                                    return <div key={p} className="player-badge">{player?.name || 'Oyuncu'}</div>;
                                })}
                            </div>
                            <button onClick={() => assignTeam('mavi')}>Mavi Takıma Geç</button>
                        </div>
                        <div className="team kirmizi">
                            <h3>Kırmızı Takım ({teams.kirmizi.score})</h3>
                            <div className="team-players">
                                {teams.kirmizi.players.map(p => {
                                    const player = room.players.find(pl => pl.id === p);
                                    return <div key={p} className="player-badge">{player?.name || 'Oyuncu'}</div>;
                                })}
                            </div>
                            <button onClick={() => assignTeam('kirmizi')}>Kırmızı Takıma Geç</button>
                        </div>
                    </div>
                    <button className="start-btn" onClick={startGame}>Oyunu Başlat</button>
                </div>
            )}

            {phase === 'ROUND_START' && (
                <div className="round-start">
                    <h1>{currentTeam === 'mavi' ? 'Mavi' : 'Kırmızı'} Takım Anlatıyor</h1>
                    <h2>Anlatıcı: {room.players.find(p => p.id === currentDescriber)?.name}</h2>
                    <div className="countdown">Hazırlan...</div>
                </div>
            )}

            {phase === 'PLAYING' && (
                <div className="playing">
                    <div className="game-header">
                        <div className={`team-indicator ${currentTeam}`}>
                            {currentTeam === 'mavi' ? 'MAVİ' : 'KIRMIZI'} TAKIM
                        </div>
                        <div className="timer">{timeRemaining}s</div>
                        <div className="scores">
                            <span className="mavi">{teams.mavi.score}</span> - <span className="kirmizi">{teams.kirmizi.score}</span>
                        </div>
                    </div>

                    {currentCard && (isDescriber || myTeam === opposingTeam) && (
                        <div className="card">
                            <div className="main-word">{currentCard.w}</div>
                            <div className="forbidden-words">
                                {currentCard.f.map((fw, i) => <div key={i} className="forbidden">{fw}</div>)}
                            </div>
                        </div>
                    )}

                    {!isDescriber && myTeam === currentTeam && (
                        <div className="waiting-message">
                            <h2>Dinle ve Tahmin Et!</h2>
                            <p>Anlatıcı: {room.players.find(p => p.id === currentDescriber)?.name}</p>
                        </div>
                    )}

                    {isDescriber && (
                        <div className="controls">
                            <button className="bildi-btn" onClick={bildi}>✓ Bildi (+1)</button>
                            <button className="pas-btn" onClick={pas} disabled={passesRemaining === 0}>
                                Pas ({passesRemaining}/3)
                            </button>
                            <button className="hatali-btn" onClick={hatali}>✗ Hatalı (-1)</button>
                            <div className="round-score">Tur Puanı: {roundScore}</div>
                        </div>
                    )}
                </div>
            )}

            {phase === 'ROUND_END' && (
                <div className="round-end">
                    <h2>Tur Bitti!</h2>
                    <div className="summary">
                        <h3>{currentTeam === 'mavi' ? 'Mavi' : 'Kırmızı'} Takım: +{roundScore} puan</h3>
                        <div className="scores-display">
                            <div className="team-score mavi">Mavi: {teams.mavi.score}</div>
                            <div className="team-score kirmizi">Kırmızı: {teams.kirmizi.score}</div>
                        </div>
                    </div>
                    <button className="next-btn" onClick={nextRound}>Sonraki Tur</button>
                </div>
            )}

            {phase === 'GAME_END' && (
                <div className="game-end">
                    <h1>🎉 Oyun Bitti! 🎉</h1>
                    <h2>{teams.mavi.score > teams.kirmizi.score ? 'MAVİ' : 'KIRMIZI'} TAKIM KAZANDI!</h2>
                    <div className="final-scores">
                        <div>Mavi: {teams.mavi.score}</div>
                        <div>Kırmızı: {teams.kirmizi.score}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Taboo;
