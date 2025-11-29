import React, { useState } from 'react';

function RoomSetup({ selectedGame, onJoin, onCreate, onBack }) {
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('Aneka');
    const [mode, setMode] = useState('MENU'); // MENU, JOIN, CREATE
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Digital Art / Lorelei seeds (Beautiful drawings)
    const avatars = [
        'Aneka', 'Felix', 'Precious', 'Caleb', 'Gracie', 
        'John', 'Mimi', 'Bear', 'Boots', 'Jack'
    ];

    const GAME_NAMES = {
        'VAMPIR_KOYLU': 'Vampir Köylü',
        'SECRET_HITLER': 'Secret Hitler',
        'CHAMELEON': 'Bukalemun',
        'UNO': 'Uno',
        'MONOPOLY_DEAL': 'Monopoly Deal',
        'TABOO': 'Taboo',
        'GUESS_NUMBER': 'Kim Daha Yakın?'
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (playerName && roomId && !isSubmitting) {
            setIsSubmitting(true);
            onJoin(roomId.toUpperCase(), playerName, selectedAvatar);
            setTimeout(() => setIsSubmitting(false), 2000);
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        if (playerName && !isSubmitting) {
            setIsSubmitting(true);
            onCreate(playerName, selectedAvatar);
            setTimeout(() => setIsSubmitting(false), 2000);
        }
    };

    if (mode === 'MENU') {
        return (
            <div className="room-setup">
                <h3>{GAME_NAMES[selectedGame] || selectedGame}</h3>
                <div className="setup-actions">
                    <button className="primary-btn" onClick={() => setMode('CREATE')}>Lobi Oluştur</button>
                    <button className="primary-btn" onClick={() => setMode('JOIN')}>Lobiye Katıl</button>
                    <button className="secondary-btn" onClick={onBack}>Geri</button>
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

                <div className="form-group">
                    <label>Avatar Seç</label>
                    <div className="avatar-grid">
                        {avatars.map((seed) => (
                            <div
                                key={seed}
                                className={`avatar-option ${selectedAvatar === seed ? 'selected' : ''}`}
                                onClick={() => setSelectedAvatar(seed)}
                            >
                                <img 
                                    src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                                    alt="avatar" 
                                />
                            </div>
                        ))}
                    </div>
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
                    <button type="submit" className="primary-btn" disabled={isSubmitting}>
                        {mode === 'CREATE' ? 'Oluştur' : 'Katıl'}
                    </button>
                    <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setMode('MENU')}
                        disabled={isSubmitting}
                    >
                        İptal
                    </button>
                </div>
            </form>
        </div>
    );
}

export default RoomSetup;
