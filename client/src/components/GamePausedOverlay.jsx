import React from 'react';
import './GamePausedOverlay.css';

function GamePausedOverlay({ pausedBy }) {
    return (
        <div className="paused-overlay">
            <div className="paused-content">
                <div className="spinner">⏸</div>
                <h2>OYUN DURAKLATILDI</h2>
                <p><strong>{pausedBy}</strong> bağlantısı koptu.</p>
                <p>1 dakika içinde bağlanmazsa oyun iptal edilecek.</p>
            </div>
        </div>
    );
}

export default GamePausedOverlay;
