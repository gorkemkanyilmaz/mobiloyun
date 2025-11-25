import React, { useState } from 'react';

function RoomSetup({ selectedGame, onJoin, onCreate, onBack }) {
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [mode, setMode] = useState('MENU'); // MENU, JOIN, CREATE
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleJoin = (e) => {
        e.preventDefault();
        if (playerName && roomId && !isSubmitting) {
            setIsSubmitting(true);
            onJoin(roomId.toUpperCase(), playerName);
            setTimeout(() => setIsSubmitting(false), 2000);
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        if (playerName && !isSubmitting) {
            setIsSubmitting(true);
            onCreate(playerName);
            setTimeout(() => setIsSubmitting(false), 2000);
        }
    };

    if (mode === 'MENU') {
        return (
            <div className="room-setup">
                <h3>{selectedGame}</h3>
                <div className="setup-actions">
                    <button onClick={() => setMode('CREATE')}>Lobi Oluştur</button>
                    <button onClick={() => setMode('JOIN')}>Lobiye Katıl</button>
                    <button className="secondary" onClick={onBack}>Geri</button>
                </div>
            </div>
        );
    }

    return (
        <div className="room-setup">
            <h3>{mode === 'CREATE' ? 'Lobi Oluştur' : 'Lobiye Katıl'}</h3>
            <form onSubmit={mode === 'CREATE' ? handleCreate : handleJoin}>
                <div className="form-group">
                    <label>İsim</label>
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Adın ne?"
                        required
                        maxLength={12}
                    />
                </div>

                {mode === 'JOIN' && (
                    <div className="form-group">
                        <label>Oda Kodu</label>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="KOD"
                            required
                            maxLength={6}
                        />
                    </div>
                )}

                <div className="form-actions">
                    <button type="submit" disabled={isSubmitting}>{mode === 'CREATE' ? 'Oluştur' : 'Katıl'}</button>
                    <button type="button" className="secondary" onClick={() => setMode('MENU')} disabled={isSubmitting}>İptal</button>
                </div>
            </form>
        </div>
    );
}

export default RoomSetup;
