import React from 'react';
import './GamePausedOverlay.css'; // Reuse styles

function ReconnectingOverlay() {
    return (
        <div className="paused-overlay" style={{ zIndex: 99999 }}>
            <div className="paused-content">
                <div className="spinner">🔄</div>
                <h2>BAĞLANTI KOPTU</h2>
                <p>Sunucuya tekrar bağlanılıyor...</p>
                <p>Lütfen bekleyin.</p>
            </div>
        </div>
    );
}

export default ReconnectingOverlay;
