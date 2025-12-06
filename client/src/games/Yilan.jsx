import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import './Yilan.css';

function Yilan({ room, playerId }) {
    const canvasRef = useRef(null);
    const minimapRef = useRef(null);
    const joystickRef = useRef(null);
    const joystickKnobRef = useRef(null);

    // Server state and interpolation
    const serverStateRef = useRef(null);
    const prevServerStateRef = useRef(null);
    const lastServerUpdateRef = useRef(0);

    // UI state
    const [isAlive, setIsAlive] = useState(true);
    const [respawnIn, setRespawnIn] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myLength, setMyLength] = useState(0);
    const [isBoosting, setIsBoosting] = useState(false);

    // Control state
    const isJoystickActiveRef = useRef(false);
    const joystickAngleRef = useRef(0);
    const joystickCenterRef = useRef({ x: 0, y: 0 });
    const cameraRef = useRef({ x: 750, y: 750 });
    const lastEmitRef = useRef(0);
    const animationRef = useRef(null);

    // Handle game state updates
    useEffect(() => {
        const handleGameState = (state) => {
            prevServerStateRef.current = serverStateRef.current;
            serverStateRef.current = state;
            lastServerUpdateRef.current = performance.now();

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

    // Send movement based on joystick angle
    const sendMovement = useCallback(() => {
        if (!isJoystickActiveRef.current || !serverStateRef.current) return;

        const now = Date.now();
        if (now - lastEmitRef.current < 50) return;
        lastEmitRef.current = now;

        const camera = cameraRef.current;
        const targetX = camera.x + Math.cos(joystickAngleRef.current) * 500;
        const targetY = camera.y + Math.sin(joystickAngleRef.current) * 500;

        socket.emit('gameAction', { type: 'MOVE', x: targetX, y: targetY });
    }, []);

    // Joystick handlers
    const updateJoystick = useCallback((clientX, clientY) => {
        const center = joystickCenterRef.current;
        const dx = clientX - center.x;
        const dy = clientY - center.y;

        // Calculate angle
        joystickAngleRef.current = Math.atan2(dy, dx);

        // Calculate knob position (limit to joystick radius)
        const maxRadius = 35;
        const dist = Math.min(Math.hypot(dx, dy), maxRadius);
        const knobX = Math.cos(joystickAngleRef.current) * dist;
        const knobY = Math.sin(joystickAngleRef.current) * dist;

        // Update knob visual position
        if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
        }
    }, []);

    const handleJoystickStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        isJoystickActiveRef.current = true;

        const joystick = joystickRef.current;
        if (!joystick) return;

        const rect = joystick.getBoundingClientRect();
        joystickCenterRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        const touch = e.touches ? e.touches[0] : e;
        updateJoystick(touch.clientX, touch.clientY);
        sendMovement();
    }, [updateJoystick, sendMovement]);

    const handleJoystickMove = useCallback((e) => {
        if (!isJoystickActiveRef.current) return;
        e.preventDefault();

        const touch = e.touches ? e.touches[0] : e;
        updateJoystick(touch.clientX, touch.clientY);
        sendMovement();
    }, [updateJoystick, sendMovement]);

    const handleJoystickEnd = useCallback((e) => {
        if (e) e.preventDefault();
        isJoystickActiveRef.current = false;

        // Reset knob position
        if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
        }
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

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const minimap = minimapRef.current;
        if (!canvas || !minimap) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        const minimapCtx = minimap.getContext('2d');

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const render = (currentTime) => {
            const state = serverStateRef.current;
            if (!state) {
                animationRef.current = requestAnimationFrame(render);
                return;
            }

            // Interpolation
            const timeSinceUpdate = currentTime - lastServerUpdateRef.current;
            const t = Math.min(timeSinceUpdate / 16.67, 1);

            const interpolatedSnakes = [];
            for (let i = 0; i < state.snakes.length; i++) {
                const snake = state.snakes[i];
                if (!snake.isAlive || snake.segments.length === 0) {
                    interpolatedSnakes.push(snake);
                    continue;
                }

                let prevSnake = prevServerStateRef.current?.snakes?.find(s => s.id === snake.id);

                if (prevSnake && prevSnake.segments.length > 0) {
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
                    interpolatedSnakes.push({ ...snake, segments: interpolatedSegments });
                } else {
                    interpolatedSnakes.push(snake);
                }
            }

            // Camera follow
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

            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(worldX, worldY, worldWidth, worldHeight);

            // Simple grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            const gridSize = 80;
            ctx.beginPath();
            for (let gx = 0; gx <= worldWidth; gx += gridSize) {
                const sx = gx + worldX;
                if (sx > 0 && sx < canvas.width) {
                    ctx.moveTo(sx, Math.max(0, worldY));
                    ctx.lineTo(sx, Math.min(canvas.height, worldY + worldHeight));
                }
            }
            for (let gy = 0; gy <= worldHeight; gy += gridSize) {
                const sy = gy + worldY;
                if (sy > 0 && sy < canvas.height) {
                    ctx.moveTo(Math.max(0, worldX), sy);
                    ctx.lineTo(Math.min(canvas.width, worldX + worldWidth), sy);
                }
            }
            ctx.stroke();

            ctx.translate(worldX, worldY);

            // Draw orbs
            for (let i = 0; i < state.orbs.length; i++) {
                const orb = state.orbs[i];
                const sx = orb.x - camera.x + canvas.width / 2;
                const sy = orb.y - camera.y + canvas.height / 2;
                if (sx < -15 || sx > canvas.width + 15 || sy < -15 || sy > canvas.height + 15) continue;

                ctx.fillStyle = orb.color;
                ctx.beginPath();
                ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw snakes - UNIFORM diameter
            const SNAKE_RADIUS = 8; // Same for all segments

            for (let i = 0; i < interpolatedSnakes.length; i++) {
                const snake = interpolatedSnakes[i];
                if (!snake.isAlive || snake.segments.length === 0) continue;

                const segments = snake.segments;
                const head = segments[0];

                const hsx = head.x - camera.x + canvas.width / 2;
                const hsy = head.y - camera.y + canvas.height / 2;
                if (hsx < -200 || hsx > canvas.width + 200 || hsy < -200 || hsy > canvas.height + 200) continue;

                // Draw body with uniform radius
                ctx.fillStyle = snake.color;
                for (let j = segments.length - 1; j >= 0; j--) {
                    const seg = segments[j];
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, SNAKE_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Head outline
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(head.x, head.y, SNAKE_RADIUS, 0, Math.PI * 2);
                ctx.stroke();

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
                ctx.fillText(snake.name, head.x, head.y - 14);
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

                const shead = snake.segments[0];
                const isMe = snake.id === state.mySnakeId;

                minimapCtx.fillStyle = snake.color;
                minimapCtx.beginPath();
                minimapCtx.arc(shead.x * scale, shead.y * scale, isMe ? 4 : 2, 0, Math.PI * 2);
                minimapCtx.fill();
            }

            if (isJoystickActiveRef.current) sendMovement();

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
        <div className="yilan-container">
            <canvas ref={canvasRef} className="game-canvas" />

            {/* Right Panel: Leaderboard + Minimap */}
            <div className="right-panel">
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
                <canvas ref={minimapRef} className="minimap" width={100} height={100} />
            </div>

            {/* My Score */}
            {isAlive && myLength > 0 && (
                <div className="my-score">Uzunluk: {myLength}</div>
            )}

            {/* Boost Button - Left */}
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

            {/* Joystick - Right */}
            <div
                ref={joystickRef}
                className="joystick"
                onMouseDown={handleJoystickStart}
                onMouseMove={handleJoystickMove}
                onMouseUp={handleJoystickEnd}
                onMouseLeave={handleJoystickEnd}
                onTouchStart={handleJoystickStart}
                onTouchMove={handleJoystickMove}
                onTouchEnd={handleJoystickEnd}
            >
                <div ref={joystickKnobRef} className="joystick-knob"></div>
            </div>

            {/* Death Overlay */}
            {!isAlive && respawnIn > 0 && (
                <div className="death-overlay">
                    <h2>💀</h2>
                    <p>{Math.ceil(respawnIn / 1000)}s</p>
                </div>
            )}
        </div>
    );
}

export default Yilan;
