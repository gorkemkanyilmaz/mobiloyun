import { io } from 'socket.io-client';

// For development, assume localhost:3000. In production, use env var.
const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const socket = io(URL, {
    autoConnect: false,
    transports: ['websocket'] // Force websocket to avoid polling issues
});
