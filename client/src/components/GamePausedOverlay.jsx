import React from 'react';
import './GamePausedOverlay.css';

function GamePausedOverlay({ pausedBy, onLeave }) {
    return (
        <div className="game-paused-overlay">
            <div className="paused-content">
                <div className="spinner"></div>
                <h2>Oyun Duraklatıldı</h2>
                <p>{pausedBy} oyundan ayrıldı.</p>
                <p>Tekrar bağlanması bekleniyor...</p>
                <button className="leave-game-btn" onClick={onLeave}>
                    Oyundan Çık
                </button>
            </div>
        </div>
    );
}

export default GamePausedOverlay;
