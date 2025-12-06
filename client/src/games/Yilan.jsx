import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import './Yilan.css';

function Yilan({ room, playerId }) {
    const canvasRef = useRef(null);
    const minimapRef = useRef(null);

    // Server state and interpolation
    const serverStateRef = useRef(null);
    const prevServerStateRef = useRef(null);
    const lastServerUpdateRef = useRef(0);
    const interpolatedSnakesRef = useRef(new Map());

    // UI state (only these cause re-renders)
    const [isAlive, setIsAlive] = useState(true);
    const [respawnIn, setRespawnIn] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myLength, setMyLength] = useState(0);
    const [isBoosting, setIsBoosting] = useState(false);

    // Control state
    const isTouchingRef = useRef(false);
    const targetAngleRef = useRef(0);
    const cameraRef = useRef({ x: 750, y: 750 });
    const lastEmitRef = useRef(0);
    const animationRef = useRef(null);

    // Handle game state updates with interpolation setup
    useEffect(() => {
        const handleGameState = (state) => {
            // Store previous state for interpolation
            prevServerStateRef.current = serverStateRef.current;
            serverStateRef.current = state;
            lastServerUpdateRef.current = performance.now();

            // Update UI state sparingly
            const mySnake = state.snakes.find(s => s.id === state.mySnakeId);
            setIsAlive(mySnake?.isAlive ?? false);
            setRespawnIn(state.respawnIn || 0);
            setLeaderboard(state.leaderboard || []);
            setMyLength(mySnake?.segments?.length || 0);
        };

        socket.on('gameState', handleGameState);
        socket.emit('getGameState');

        return () => {
            socket.off('gameState', handleGameState);
        };
    }, []);

    // Calculate target from touch/mouse
    const updateTarget = useCallback((clientX, clientY) => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const dx = clientX - rect.left - centerX;
        const dy = clientY - rect.top - centerY;

        targetAngleRef.current = Math.atan2(dy, dx);
    }, []);

    // Send movement
    const sendMovement = useCallback(() => {
        if (!isTouchingRef.current || !serverStateRef.current) return;

        const now = Date.now();
        if (now - lastEmitRef.current < 50) return;
        lastEmitRef.current = now;

        const camera = cameraRef.current;
        const targetX = camera.x + Math.cos(targetAngleRef.current) * 500;
        const targetY = camera.y + Math.sin(targetAngleRef.current) * 500;

        socket.emit('gameAction', { type: 'MOVE', x: targetX, y: targetY });
    }, []);

    // Touch handlers
    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        isTouchingRef.current = true;
        if (e.touches.length > 0) {
            updateTarget(e.touches[0].clientX, e.touches[0].clientY);
            sendMovement();
        }
    }, [updateTarget, sendMovement]);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            updateTarget(e.touches[0].clientX, e.touches[0].clientY);
            sendMovement();
        }
    }, [updateTarget, sendMovement]);

    const handleTouchEnd = useCallback((e) => {
        e.preventDefault();
        isTouchingRef.current = false;
    }, []);

    const handleMouseDown = useCallback((e) => {
        isTouchingRef.current = true;
        updateTarget(e.clientX, e.clientY);
        sendMovement();
    }, [updateTarget, sendMovement]);

    const handleMouseMove = useCallback((e) => {
        if (!isTouchingRef.current) return;
        updateTarget(e.clientX, e.clientY);
        sendMovement();
    }, [updateTarget, sendMovement]);

    const handleMouseUp = useCallback(() => {
        isTouchingRef.current = false;
    }, []);

    // Boost handlers
    const handleBoostStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsBoosting(true);
        socket.emit('gameAction', { type: 'BOOST_START' });
    }, []);

    const handleBoostEnd = useCallback((e) => {
        if (e) e.preventDefault();
        setIsBoosting(false);
        socket.emit('gameAction', { type: 'BOOST_END' });
    }, []);

    // Main render loop with interpolation
    useEffect(() => {
        const canvas = canvasRef.current;
        const minimap = minimapRef.current;
        if (!canvas || !minimap) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        const minimapCtx = minimap.getContext('2d');

        // Disable image smoothing for sharper rendering
        ctx.imageSmoothingEnabled = false;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        let lastFrameTime = performance.now();

        const render = (currentTime) => {
            const deltaTime = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;

            const state = serverStateRef.current;
            if (!state) {
                animationRef.current = requestAnimationFrame(render);
                return;
            }

            // Calculate interpolation factor (0 to 1)
            const timeSinceUpdate = currentTime - lastServerUpdateRef.current;
            const serverTickMs = 16.67; // ~60fps from server
            const t = Math.min(timeSinceUpdate / serverTickMs, 1);

            // Interpolate snake positions
            const interpolatedSnakes = [];
            for (let i = 0; i < state.snakes.length; i++) {
                const snake = state.snakes[i];
                if (!snake.isAlive || snake.segments.length === 0) {
                    interpolatedSnakes.push(snake);
                    continue;
                }

                // Get previous snake position if available
                let prevSnake = null;
                if (prevServerStateRef.current) {
                    prevSnake = prevServerStateRef.current.snakes.find(s => s.id === snake.id);
                }

                if (prevSnake && prevSnake.segments.length > 0) {
                    // Interpolate segments
                    const interpolatedSegments = [];
                    const maxLen = Math.min(snake.segments.length, prevSnake.segments.length);

                    for (let j = 0; j < snake.segments.length; j++) {
                        if (j < maxLen) {
                            interpolatedSegments.push({
                                x: prevSnake.segments[j].x + (snake.segments[j].x - prevSnake.segments[j].x) * t,
                                y: prevSnake.segments[j].y + (snake.segments[j].y - prevSnake.segments[j].y) * t
                            });
                        } else {
                            interpolatedSegments.push(snake.segments[j]);
                        }
                    }

                    interpolatedSnakes.push({
                        ...snake,
                        segments: interpolatedSegments
                    });
                } else {
                    interpolatedSnakes.push(snake);
                }
            }

            // Find my snake for camera
            const mySnake = interpolatedSnakes.find(s => s.id === state.mySnakeId);
            if (mySnake?.isAlive && mySnake.segments.length > 0) {
                const head = mySnake.segments[0];
                cameraRef.current.x += (head.x - cameraRef.current.x) * 0.2;
                cameraRef.current.y += (head.y - cameraRef.current.y) * 0.2;
            }

            const camera = cameraRef.current;
            const worldWidth = state.worldWidth;
            const worldHeight = state.worldHeight;

            // Clear
            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const worldX = canvas.width / 2 - camera.x;
            const worldY = canvas.height / 2 - camera.y;

            // Clip to world
            ctx.save();
            ctx.beginPath();
            ctx.rect(Math.max(0, worldX), Math.max(0, worldY),
                Math.min(canvas.width, worldWidth), Math.min(canvas.height, worldHeight));
            ctx.clip();

            // World background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(worldX, worldY, worldWidth, worldHeight);

            // Simple grid instead of hexagons for performance
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            const gridSize = 80;
            const startGridX = Math.floor(camera.x / gridSize) * gridSize;
            const startGridY = Math.floor(camera.y / gridSize) * gridSize;

            ctx.beginPath();
            for (let gx = startGridX - canvas.width; gx < startGridX + canvas.width; gx += gridSize) {
                if (gx >= 0 && gx <= worldWidth) {
                    const sx = gx - camera.x + canvas.width / 2;
                    ctx.moveTo(sx, Math.max(0, worldY));
                    ctx.lineTo(sx, Math.min(canvas.height, worldY + worldHeight));
                }
            }
            for (let gy = startGridY - canvas.height; gy < startGridY + canvas.height; gy += gridSize) {
                if (gy >= 0 && gy <= worldHeight) {
                    const sy = gy - camera.y + canvas.height / 2;
                    ctx.moveTo(Math.max(0, worldX), sy);
                    ctx.lineTo(Math.min(canvas.width, worldX + worldWidth), sy);
                }
            }
            ctx.stroke();

            ctx.translate(worldX, worldY);

            // Draw orbs - simple circles
            const orbs = state.orbs;
            for (let i = 0; i < orbs.length; i++) {
                const orb = orbs[i];
                const sx = orb.x - camera.x + canvas.width / 2;
                const sy = orb.y - camera.y + canvas.height / 2;
                if (sx < -15 || sx > canvas.width + 15 || sy < -15 || sy > canvas.height + 15) continue;

                ctx.fillStyle = orb.color;
                ctx.beginPath();
                ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw snakes
            for (let i = 0; i < interpolatedSnakes.length; i++) {
                const snake = interpolatedSnakes[i];
                if (!snake.isAlive || snake.segments.length === 0) continue;

                const segments = snake.segments;
                const head = segments[0];

                // Check if visible
                const hsx = head.x - camera.x + canvas.width / 2;
                const hsy = head.y - camera.y + canvas.height / 2;
                if (hsx < -200 || hsx > canvas.width + 200 || hsy < -200 || hsy > canvas.height + 200) continue;

                // Draw body as connected circles
                ctx.fillStyle = snake.color;
                for (let j = segments.length - 1; j >= 0; j--) {
                    const seg = segments[j];
                    const radius = 5 + (j / segments.length) * 7;
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Eyes
                let angle = 0;
                if (segments.length > 1) {
                    angle = Math.atan2(head.y - segments[1].y, head.x - segments[1].x);
                }

                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(head.x + Math.cos(angle + 0.5) * 4, head.y + Math.sin(angle + 0.5) * 4, 3, 0, Math.PI * 2);
                ctx.arc(head.x + Math.cos(angle - 0.5) * 4, head.y + Math.sin(angle - 0.5) * 4, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(head.x + Math.cos(angle + 0.5) * 4 + Math.cos(angle), head.y + Math.sin(angle + 0.5) * 4 + Math.sin(angle), 1.5, 0, Math.PI * 2);
                ctx.arc(head.x + Math.cos(angle - 0.5) * 4 + Math.cos(angle), head.y + Math.sin(angle - 0.5) * 4 + Math.sin(angle), 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Name
                ctx.fillStyle = 'white';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(snake.name, head.x, head.y - 16);
            }

            ctx.restore();

            // World boundary
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
            ctx.lineWidth = 3;
            ctx.strokeRect(worldX, worldY, worldWidth, worldHeight);

            // Minimap
            const mapSize = minimap.width;
            const scale = mapSize / worldWidth;

            minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            minimapCtx.fillRect(0, 0, mapSize, mapSize);
            minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            minimapCtx.strokeRect(0, 0, mapSize, mapSize);

            for (let i = 0; i < interpolatedSnakes.length; i++) {
                const snake = interpolatedSnakes[i];
                if (!snake.isAlive || snake.segments.length === 0) continue;

                const head = snake.segments[0];
                const isMe = snake.id === state.mySnakeId;

                minimapCtx.fillStyle = snake.color;
                minimapCtx.beginPath();
                minimapCtx.arc(head.x * scale, head.y * scale, isMe ? 4 : 2, 0, Math.PI * 2);
                minimapCtx.fill();
            }

            if (isTouchingRef.current) sendMovement();

            animationRef.current = requestAnimationFrame(render);
        };

        animationRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [sendMovement]);

    const myName = serverStateRef.current?.snakes?.find(s => s.id === serverStateRef.current?.mySnakeId)?.name;

    return (
        <div
            className="yilan-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <canvas
                ref={canvasRef}
                className="game-canvas"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            />

            <canvas ref={minimapRef} className="minimap" width={100} height={100} />

            <div className="leaderboard">
                <h3>Skor</h3>
                {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={i} className={`leaderboard-entry ${entry.name === myName ? 'me' : ''}`}>
                        <span className="rank">#{entry.rank}</span>
                        <span className="color-dot" style={{ backgroundColor: entry.color }}></span>
                        <span className="name">{entry.name}</span>
                        <span className="score">{entry.score}</span>
                    </div>
                ))}
            </div>

            {isAlive && myLength > 0 && (
                <div className="my-score">Uzunluk: {myLength}</div>
            )}

            <button
                className={`boost-btn ${isBoosting ? 'active' : ''} ${!isAlive ? 'disabled' : ''}`}
                onMouseDown={handleBoostStart}
                onMouseUp={handleBoostEnd}
                onMouseLeave={handleBoostEnd}
                onTouchStart={handleBoostStart}
                onTouchEnd={handleBoostEnd}
                disabled={!isAlive}
            >
                ⚡
            </button>

            {!isAlive && respawnIn > 0 && (
                <div className="death-overlay">
                    <h2>💀</h2>
                    <p>{Math.ceil(respawnIn / 1000)}s</p>
                </div>
            )}

            <div className="touch-hint">Basılı tut → Yönlendir</div>
        </div>
    );
}

export default Yilan;
