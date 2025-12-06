import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import './Yilan.css';

function Yilan({ room, playerId }) {
    const canvasRef = useRef(null);
    const minimapRef = useRef(null);
    const [gameState, setGameState] = useState(null);
    const [isBoosting, setIsBoosting] = useState(false);
    const targetRef = useRef({ x: 0, y: 0 });
    const cameraRef = useRef({ x: 0, y: 0 });
    const lastEmitRef = useRef(0);

    // Handle game state updates
    useEffect(() => {
        socket.on('gameState', (state) => {
            setGameState(state);
        });

        socket.emit('getGameState');

        return () => {
            socket.off('gameState');
        };
    }, []);

    // Handle touch/mouse input
    const handlePointerMove = useCallback((clientX, clientY) => {
        if (!canvasRef.current || !gameState) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Convert screen position to world position
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;

        // Calculate world position based on camera
        const worldX = screenX + cameraRef.current.x - canvas.width / 2;
        const worldY = screenY + cameraRef.current.y - canvas.height / 2;

        targetRef.current = { x: worldX, y: worldY };

        // Throttle emit to ~30 times per second
        const now = Date.now();
        if (now - lastEmitRef.current > 33) {
            lastEmitRef.current = now;
            socket.emit('gameAction', {
                type: 'MOVE',
                x: worldX,
                y: worldY
            });
        }
    }, [gameState]);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        }
    }, [handlePointerMove]);

    const handleMouseMove = useCallback((e) => {
        handlePointerMove(e.clientX, e.clientY);
    }, [handlePointerMove]);

    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
        }
    }, [handlePointerMove]);

    // Boost handlers
    const handleBoostStart = useCallback(() => {
        setIsBoosting(true);
        socket.emit('gameAction', { type: 'BOOST_START' });
    }, []);

    const handleBoostEnd = useCallback(() => {
        setIsBoosting(false);
        socket.emit('gameAction', { type: 'BOOST_END' });
    }, []);

    // Canvas rendering
    useEffect(() => {
        if (!canvasRef.current || !gameState) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Find my snake for camera
        const mySnake = gameState.snakes.find(s => s.id === gameState.mySnakeId);
        if (mySnake && mySnake.isAlive && mySnake.segments.length > 0) {
            const head = mySnake.segments[0];
            // Smooth camera follow
            cameraRef.current.x += (head.x - cameraRef.current.x) * 0.1;
            cameraRef.current.y += (head.y - cameraRef.current.y) * 0.1;
        }

        const camera = cameraRef.current;

        // Clear canvas with dark outside-world color
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate world rect on screen
        const worldScreenX = canvas.width / 2 - camera.x;
        const worldScreenY = canvas.height / 2 - camera.y;

        // Draw game world with clipping
        ctx.save();

        // Clip to world boundaries
        ctx.beginPath();
        ctx.rect(worldScreenX, worldScreenY, gameState.worldWidth, gameState.worldHeight);
        ctx.clip();

        // Fill world background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(worldScreenX, worldScreenY, gameState.worldWidth, gameState.worldHeight);

        // Draw hexagonal background pattern (only inside world)
        drawHexGrid(ctx, camera, canvas.width, canvas.height, gameState.worldWidth, gameState.worldHeight);

        // Translate for world objects
        ctx.translate(worldScreenX, worldScreenY);

        // Draw orbs
        gameState.orbs.forEach(orb => {
            drawOrb(ctx, orb);
        });

        // Draw snakes
        gameState.snakes.forEach(snake => {
            if (snake.isAlive) {
                drawSnake(ctx, snake, snake.id === gameState.mySnakeId);
            }
        });

        ctx.restore();

        // Draw world boundary line
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 4;
        ctx.strokeRect(worldScreenX, worldScreenY, gameState.worldWidth, gameState.worldHeight);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [gameState, playerId]);

    // Minimap rendering
    useEffect(() => {
        if (!minimapRef.current || !gameState) return;

        const minimap = minimapRef.current;
        const ctx = minimap.getContext('2d');
        const size = minimap.width;

        // Clear
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, size, size);

        // Scale factor
        const scale = size / gameState.worldWidth;

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, size, size);

        // Draw all snakes as dots
        gameState.snakes.forEach(snake => {
            if (!snake.isAlive || snake.segments.length === 0) return;

            const head = snake.segments[0];
            const x = head.x * scale;
            const y = head.y * scale;
            const isMe = snake.id === gameState.mySnakeId;
            const dotSize = isMe ? 6 : 4;

            // Glow for current player
            if (isMe) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(x, y, dotSize + 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = snake.color;
            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fill();
        });

    }, [gameState]);

    // Animation loop
    useEffect(() => {
        let animationId;

        const animate = () => {
            // Trigger re-render for smooth camera
            setGameState(prev => prev ? { ...prev } : prev);
            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, []);

    if (!gameState) {
        return <div className="loading">Yılan Yükleniyor...</div>;
    }

    const mySnake = gameState.snakes.find(s => s.id === gameState.mySnakeId);
    const isAlive = mySnake?.isAlive;

    return (
        <div className="yilan-container">
            <canvas
                ref={canvasRef}
                className="game-canvas"
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                onTouchStart={handleTouchStart}
            />

            {/* Minimap */}
            <canvas
                ref={minimapRef}
                className="minimap"
                width={120}
                height={120}
            />

            {/* Leaderboard */}
            <div className="leaderboard">
                <h3>Leaderboard</h3>
                {gameState.leaderboard.map((entry, i) => (
                    <div
                        key={i}
                        className={`leaderboard-entry ${entry.name === mySnake?.name ? 'me' : ''}`}
                    >
                        <span className="rank">#{entry.rank}</span>
                        <span className="color-dot" style={{ backgroundColor: entry.color }}></span>
                        <span className="name">{entry.name}</span>
                        <span className="score">{entry.score}</span>
                    </div>
                ))}
            </div>

            {/* My Score */}
            {isAlive && mySnake && (
                <div className="my-score">
                    Uzunluk: {mySnake.segments.length}
                </div>
            )}

            {/* Boost Button */}
            <button
                className={`boost-btn ${isBoosting ? 'active' : ''} ${!isAlive ? 'disabled' : ''}`}
                onMouseDown={handleBoostStart}
                onMouseUp={handleBoostEnd}
                onMouseLeave={handleBoostEnd}
                onTouchStart={(e) => { e.preventDefault(); handleBoostStart(); }}
                onTouchEnd={(e) => { e.preventDefault(); handleBoostEnd(); }}
                disabled={!isAlive}
            >
                ⚡ BOOST
            </button>

            {/* Death Overlay */}
            {!isAlive && gameState.respawnIn > 0 && (
                <div className="death-overlay">
                    <h2>Öldün!</h2>
                    <p>Yeniden doğma: {Math.ceil(gameState.respawnIn / 1000)}s</p>
                </div>
            )}
        </div>
    );
}

// Helper functions for drawing
function drawHexGrid(ctx, camera, canvasWidth, canvasHeight, worldWidth, worldHeight) {
    const hexSize = 40;
    const hexHeight = hexSize * 2;
    const hexWidth = Math.sqrt(3) * hexSize;
    const vertDist = hexHeight * 0.75;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    const startX = Math.floor((camera.x - canvasWidth / 2) / hexWidth) - 1;
    const endX = Math.ceil((camera.x + canvasWidth / 2) / hexWidth) + 1;
    const startY = Math.floor((camera.y - canvasHeight / 2) / vertDist) - 1;
    const endY = Math.ceil((camera.y + canvasHeight / 2) / vertDist) + 1;

    for (let row = startY; row <= endY; row++) {
        for (let col = startX; col <= endX; col++) {
            const x = col * hexWidth + (row % 2) * (hexWidth / 2);
            const y = row * vertDist;

            // Skip if outside world
            if (x < -hexWidth || x > worldWidth + hexWidth ||
                y < -hexHeight || y > worldHeight + hexHeight) continue;

            // Convert to screen coordinates
            const screenX = x - camera.x + canvasWidth / 2;
            const screenY = y - camera.y + canvasHeight / 2;

            drawHexagon(ctx, screenX, screenY, hexSize);
        }
    }
}

function drawHexagon(ctx, x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    ctx.stroke();
}

function drawOrb(ctx, orb) {
    // Glow effect
    const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.size * 2);
    gradient.addColorStop(0, orb.color);
    gradient.addColorStop(0.5, orb.color + '80');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = orb.color;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
    ctx.fill();
}

function drawSnake(ctx, snake, isMe) {
    if (snake.segments.length === 0) return;

    const segments = snake.segments;
    const color = snake.color;

    // Draw body segments (from tail to head)
    for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        const progress = i / segments.length;
        const radius = 8 + progress * 4; // Thicker at head

        // Body segment
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Darker outline
        ctx.strokeStyle = shadeColor(color, -30);
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw head
    const head = segments[0];

    // Head glow if boosting
    if (snake.isBoosting) {
        const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 25);
        glow.addColorStop(0, color + '80');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Eyes
    const eyeOffset = 5;
    const eyeRadius = 4;
    const pupilRadius = 2;

    // Calculate eye positions based on movement direction
    let angle = 0;
    if (segments.length > 1) {
        const dx = head.x - segments[1].x;
        const dy = head.y - segments[1].y;
        angle = Math.atan2(dy, dx);
    }

    const leftEyeX = head.x + Math.cos(angle + 0.5) * eyeOffset;
    const leftEyeY = head.y + Math.sin(angle + 0.5) * eyeOffset;
    const rightEyeX = head.x + Math.cos(angle - 0.5) * eyeOffset;
    const rightEyeY = head.y + Math.sin(angle - 0.5) * eyeOffset;

    // White of eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(leftEyeX + Math.cos(angle) * 1.5, leftEyeY + Math.sin(angle) * 1.5, pupilRadius, 0, Math.PI * 2);
    ctx.arc(rightEyeX + Math.cos(angle) * 1.5, rightEyeY + Math.sin(angle) * 1.5, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Name tag (only for non-me snakes or always)
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(snake.name, head.x, head.y - 20);
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default Yilan;
