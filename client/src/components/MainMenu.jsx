import React from 'react';

const GAMES = [
    { id: 'VAMPIR_KOYLU', name: 'Vampir Köylü', icon: '🧛' },
    { id: 'SECRET_HITLER', name: 'Secret Hitler', icon: '📜' },
    { id: 'CHAMELEON', name: 'Bukalemun', icon: '🦎' },
    { id: 'UNO', name: 'Uno', icon: '🃏' },
    { id: 'TABOO', name: 'Taboo', icon: '🚫' },
    { id: 'KIM_DAHA_YAKIN', name: 'Kim Daha Yakın?', icon: '🔢' },
];

function MainMenu({ onSelectGame }) {
    return (
        <div className="main-menu">
            <h2>Oyun Seç</h2>
            <div className="game-grid">
                {GAMES.map((game) => (
                    <button key={game.id} className="game-card" onClick={() => onSelectGame(game.id)}>
                        <span className="game-icon">{game.icon}</span>
                        <span className="game-name">{game.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default MainMenu;
