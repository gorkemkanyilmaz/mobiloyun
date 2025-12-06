import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { socket } from '../socket';
import './AmiralBatti.css';

const GRID_SIZE = 10;
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function AmiralBatti({ room, playerId }) {
    const [gameState, setGameState] = useState(null);
    const [selectedShip, setSelectedShip] = useState(null);
    const [isHorizontal, setIsHorizontal] = useState(true);
    const [hoverCell, setHoverCell] = useState(null);
    const [lastShot, setLastShot] = useState(null);
    const [selectedTarget, setSelectedTarget] = useState(null);

    // Listen for game state
    useEffect(() => {
        const handleGameState = (state) => {
            setGameState(state);

            // Auto-select first enemy target in 1v1
            if (state.enemyViews && !selectedTarget) {
                const targets = Object.keys(state.enemyViews);
                if (targets.length === 1) {
                    setSelectedTarget(targets[0]);
                }
            }
        };

        socket.on('gameState', handleGameState);
        socket.emit('getGameState');

        return () => socket.off('gameState', handleGameState);
    }, [selectedTarget]);

    // Get unplaced ships
    const unplacedShips = useMemo(() => {
        if (!gameState?.shipTypes || !gameState?.myShips) return [];

        const placed = {};
        gameState.myShips.forEach(ship => {
            placed[ship.type] = (placed[ship.type] || 0) + 1;
        });

        const unplaced = [];
        for (const [type, config] of Object.entries(gameState.shipTypes)) {
            const remaining = config.count - (placed[type] || 0);
            for (let i = 0; i < remaining; i++) {
                unplaced.push({ type, ...config });
            }
        }
        return unplaced;
    }, [gameState?.shipTypes, gameState?.myShips]);

    // Handle ship placement
    const handlePlaceShip = useCallback((x, y) => {
        if (!selectedShip || gameState?.phase !== 'PLACEMENT') return;

        socket.emit('gameAction', {
            type: 'PLACE_SHIP',
            shipType: selectedShip.type,
            x,
            y,
            isHorizontal
        });
        setSelectedShip(null);
    }, [selectedShip, isHorizontal, gameState?.phase]);

    // Handle removing a ship (click on placed ship to remove)
    const handleRemoveShip = useCallback((shipId) => {
        socket.emit('gameAction', { type: 'REMOVE_SHIP', shipId });
    }, []);

    // Handle ready toggle
    const handleReady = useCallback(() => {
        socket.emit('gameAction', { type: 'SET_READY', isReady: !gameState?.amIReady });
    }, [gameState?.amIReady]);

    // Handle shooting
    const handleShoot = useCallback((x, y) => {
        if (!gameState?.isMyTurn || gameState?.phase !== 'PLAYING' || !selectedTarget) return;

        socket.emit('gameAction', {
            type: 'SHOOT',
            targetId: selectedTarget,
            x,
            y
        });
        setLastShot({ x, y, time: Date.now() });
    }, [gameState?.isMyTurn, gameState?.phase, selectedTarget]);

    // Calculate preview cells for ship placement
    const previewCells = useMemo(() => {
        if (!selectedShip || !hoverCell) return [];

        const cells = [];
        for (let i = 0; i < selectedShip.size; i++) {
            const x = isHorizontal ? hoverCell.x + i : hoverCell.x;
            const y = isHorizontal ? hoverCell.y : hoverCell.y + i;
            if (x < GRID_SIZE && y < GRID_SIZE) {
                cells.push({ x, y });
            }
        }
        return cells;
    }, [selectedShip, hoverCell, isHorizontal]);

    if (!gameState) {
        return <div className="ab-loading">Amiral Battı Yükleniyor...</div>;
    }

    const { phase, myGrid, myShips, enemyViews, isMyTurn, currentTurnName, winner, gameStats, teams, myTeam, hasAllShips, amIReady } = gameState;

    return (
        <div className="ab-container">
            {/* Header */}
            <div className="ab-header">
                <h2>🚢 Amiral Battı</h2>
                <div className="ab-phase-indicator">
                    {phase === 'PLACEMENT' && '📍 Gemi Yerleştirme'}
                    {phase === 'PLAYING' && (isMyTurn ? '🎯 Sıra Sende!' : `⏳ ${currentTurnName} oynuyor...`)}
                    {phase === 'FINISHED' && '🏆 Oyun Bitti!'}
                </div>
            </div>

            {/* Main Game Area */}
            <div className="ab-game-area">
                {/* Enemy Grid (Top) - Only show during PLAYING */}
                {phase === 'PLAYING' && selectedTarget && enemyViews[selectedTarget] && (
                    <div className="ab-enemy-section">
                        <div className="ab-section-label">
                            <span className="ab-target-icon">🎯</span>
                            {enemyViews[selectedTarget].name}'in Alanı
                        </div>

                        {/* Target selector for 2v2 */}
                        {Object.keys(enemyViews).length > 1 && (
                            <div className="ab-target-selector">
                                {Object.entries(enemyViews).map(([id, view]) => (
                                    <button
                                        key={id}
                                        className={`ab-target-btn ${selectedTarget === id ? 'active' : ''}`}
                                        onClick={() => setSelectedTarget(id)}
                                    >
                                        {view.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <Grid
                            grid={enemyViews[selectedTarget].grid}
                            isEnemy={true}
                            onCellClick={handleShoot}
                            isMyTurn={isMyTurn}
                            sunkShips={enemyViews[selectedTarget].sunkShips}
                        />
                    </div>
                )}

                {/* HUD Separator */}
                {phase === 'PLAYING' && <div className="ab-hud-separator">━━━ Düşman Alanı ━━━ Benim Alanım ━━━</div>}

                {/* My Grid (Bottom) */}
                <div className="ab-my-section">
                    {phase === 'PLACEMENT' && (
                        <div className="ab-section-label">📍 Gemilerini Yerleştir</div>
                    )}
                    {phase === 'PLAYING' && (
                        <div className="ab-section-label">🛡️ Benim Alanım</div>
                    )}

                    <Grid
                        grid={myGrid}
                        isEnemy={false}
                        onCellClick={phase === 'PLACEMENT' ? handlePlaceShip : undefined}
                        onCellHover={phase === 'PLACEMENT' ? setHoverCell : undefined}
                        previewCells={previewCells}
                        selectedShip={selectedShip}
                        ships={myShips}
                        onShipClick={phase === 'PLACEMENT' ? handleRemoveShip : undefined}
                    />
                </div>

                {/* Placement Controls - Right below grid */}
                {phase === 'PLACEMENT' && (
                    <div className="ab-placement-controls">
                        <div className="ab-ships-panel">
                            <h4>Gemiler</h4>
                            <div className="ab-ship-list">
                                {unplacedShips.map((ship, i) => (
                                    <button
                                        key={`${ship.type}-${i}`}
                                        className={`ab-ship-btn ${selectedShip?.type === ship.type ? 'selected' : ''}`}
                                        onClick={() => setSelectedShip(ship)}
                                    >
                                        <span className="ab-ship-visual">
                                            {'🟦'.repeat(ship.size)}
                                        </span>
                                        <span className="ab-ship-name">{ship.name}</span>
                                    </button>
                                ))}
                                {unplacedShips.length === 0 && (
                                    <div className="ab-all-placed">✅ Tüm gemiler yerleştirildi!</div>
                                )}
                            </div>
                        </div>

                        <div className="ab-placement-actions">
                            <button
                                className={`ab-rotate-btn ${isHorizontal ? 'horizontal' : 'vertical'}`}
                                onClick={() => setIsHorizontal(!isHorizontal)}
                            >
                                🔄 {isHorizontal ? 'Yatay' : 'Dikey'}
                            </button>

                            <button
                                className={`ab-ready-btn ${amIReady ? 'ready' : ''}`}
                                onClick={handleReady}
                                disabled={!hasAllShips}
                            >
                                {amIReady ? '❌ Hazır Değilim' : '✅ Hazırım'}
                            </button>
                        </div>

                        <div className="ab-players-status">
                            {gameState.players.map(p => (
                                <div key={p.id} className={`ab-player-status ${p.isReady ? 'ready' : ''}`}>
                                    <span>{p.name}</span>
                                    <span>{p.isReady ? '✅' : `${p.shipsPlaced}/6`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Game Info during PLAYING */}
            {phase === 'PLAYING' && (
                <div className="ab-game-info">
                    <div className="ab-turn-indicator">
                        {isMyTurn ? (
                            <span className="ab-your-turn">🎯 Sıra Sende! Ateş et!</span>
                        ) : (
                            <span className="ab-waiting">⏳ {currentTurnName} oynuyor...</span>
                        )}
                    </div>

                    {teams && (
                        <div className="ab-team-info">
                            <span className={`ab-team ${myTeam}`}>
                                {myTeam === 'blue' ? '🔵 Mavi Takım' : '🔴 Kırmızı Takım'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Winner Overlay */}
            {phase === 'FINISHED' && winner && (
                <div className="ab-winner-overlay">
                    <div className="ab-winner-popup">
                        <h1>🏆 Oyun Bitti!</h1>
                        <div className="ab-winner-name">
                            {winner === 'blue' && '🔵 Mavi Takım Kazandı!'}
                            {winner === 'red' && '🔴 Kırmızı Takım Kazandı!'}
                            {winner !== 'blue' && winner !== 'red' && (
                                <>🎉 {gameState.players.find(p => p.id === winner)?.name || 'Kazanan'} Kazandı!</>
                            )}
                        </div>

                        {gameStats && (
                            <div className="ab-stats">
                                <h3>📊 İstatistikler</h3>
                                {Object.entries(gameStats).map(([id, stats]) => (
                                    <div key={id} className="ab-stat-row">
                                        <span className="ab-stat-name">{stats.name}</span>
                                        <span className="ab-stat-detail">
                                            🎯 {stats.hits} / 💨 {stats.misses}
                                            ({stats.accuracy}%)
                                            🚢 {stats.shipsSunk} batırdı
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Grid Component
function Grid({ grid, isEnemy, onCellClick, onCellHover, previewCells, selectedShip, ships, onShipClick, isMyTurn, sunkShips }) {
    const getPreviewClass = (x, y) => {
        if (!previewCells) return '';
        return previewCells.some(c => c.x === x && c.y === y) ? 'preview' : '';
    };

    const getShipId = (x, y) => {
        if (!ships) return null;
        for (const ship of ships) {
            if (ship.cells.some(c => c.x === x && c.y === y)) {
                return ship.id;
            }
        }
        return null;
    };

    const isSunkShipCell = (x, y) => {
        if (!sunkShips) return false;
        return sunkShips.some(ship => ship.cells.some(c => c.x === x && c.y === y));
    };

    return (
        <div className={`ab-grid ${isEnemy ? 'enemy' : 'mine'}`}>
            {/* Column headers */}
            <div className="ab-grid-row header">
                <div className="ab-cell corner"></div>
                {COLUMNS.map(col => (
                    <div key={col} className="ab-cell header">{col}</div>
                ))}
            </div>

            {/* Grid rows */}
            {grid.map((row, y) => (
                <div key={y} className="ab-grid-row">
                    <div className="ab-cell row-header">{y + 1}</div>
                    {row.map((cell, x) => {
                        const shipId = getShipId(x, y);
                        const isSunk = isSunkShipCell(x, y);

                        return (
                            <div
                                key={`${x}-${y}`}
                                className={`ab-cell 
                                    ${cell.hasShip && !isEnemy ? 'has-ship' : ''} 
                                    ${cell.isHit ? 'hit' : ''} 
                                    ${cell.isMiss ? 'miss' : ''}
                                    ${isSunk ? 'sunk' : ''}
                                    ${getPreviewClass(x, y)}
                                    ${isEnemy && isMyTurn && !cell.isHit && !cell.isMiss ? 'clickable' : ''}
                                `}
                                onClick={() => {
                                    if (isEnemy && onCellClick && isMyTurn && !cell.isHit && !cell.isMiss) {
                                        onCellClick(x, y);
                                    } else if (!isEnemy && onCellClick && selectedShip) {
                                        onCellClick(x, y);
                                    } else if (!isEnemy && shipId && onShipClick) {
                                        onShipClick(shipId);
                                    }
                                }}
                                onMouseEnter={() => onCellHover && onCellHover({ x, y })}
                                onMouseLeave={() => onCellHover && onCellHover(null)}
                            >
                                {cell.isHit && <span className="ab-marker hit">💥</span>}
                                {cell.isMiss && <span className="ab-marker miss">💨</span>}
                                {!isEnemy && cell.hasShip && !cell.isHit && (
                                    <span className="ab-ship-marker">🟦</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export default AmiralBatti;
