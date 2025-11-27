const { v4: uuidv4 } = require('uuid');

class UnoGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.state = {
            phase: 'PLAYING', // PLAYING, END
            deck: [],
            discardPile: [],
            hands: {}, // playerId -> [cards]
            turnIndex: 0,
            direction: 1, // 1 for clockwise, -1 for counter-clockwise
            currentColor: null, // Current active color (important for Wild cards)
            currentType: null, // Current active type/number
            winner: null,
            logs: [],
            unoCalls: {}, // playerId -> boolean (true if called Uno)
            drawStack: 0, // For stacking draw cards (optional rule, but good to track pending draws)
            pendingColorChoice: false // If true, waiting for current player to pick color (Wild)
        };

        this.initGame();
    }

    initGame() {
        this.state.deck = this.createDeck();
        this.shuffleDeck();
        this.dealCards();

        // Flip first card
        let firstCard = this.state.deck.pop();
        while (firstCard.color === 'black') {
            // If first card is Wild, put it back and reshuffle (simple rule to avoid complexity at start)
            this.state.deck.unshift(firstCard);
            this.shuffleDeck();
            firstCard = this.state.deck.pop();
        }

        this.state.discardPile.push(firstCard);
        this.state.currentColor = firstCard.color;
        this.state.currentType = firstCard.type;
        this.state.currentValue = firstCard.value;

        // Apply first card effect if it's special (Skip, Reverse, Draw 2)
        // For simplicity in this version, we treat the first card as just a starter, 
        // but strictly speaking Reverse/Skip should apply. Let's keep it simple for now.

        this.addLog('Oyun başladı! İlk kart: ' + this.formatCard(firstCard));
        this.broadcastState();
    }

    createDeck() {
        const colors = ['red', 'blue', 'green', 'yellow'];
        const deck = [];

        colors.forEach(color => {
            // 0 card (1 per color)
            deck.push({ id: uuidv4(), color, type: 'number', value: 0 });

            // 1-9 cards (2 per color)
            for (let i = 1; i <= 9; i++) {
                deck.push({ id: uuidv4(), color, type: 'number', value: i });
                deck.push({ id: uuidv4(), color, type: 'number', value: i });
            }

            // Special cards (2 per color)
            ['skip', 'reverse', 'draw2'].forEach(type => {
                deck.push({ id: uuidv4(), color, type, value: null });
                deck.push({ id: uuidv4(), color, type, value: null });
            });
        });

        // Wild cards (4 each)
        for (let i = 0; i < 4; i++) {
            deck.push({ id: uuidv4(), color: 'black', type: 'wild', value: null });
            deck.push({ id: uuidv4(), color: 'black', type: 'wild4', value: null });
        }

        return deck;
    }

    shuffleDeck() {
        for (let i = this.state.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.state.deck[i], this.state.deck[j]] = [this.state.deck[j], this.state.deck[i]];
        }
    }

    dealCards() {
        this.room.players.forEach(player => {
            this.state.hands[player.id] = [];
            for (let i = 0; i < 7; i++) {
                if (this.state.deck.length === 0) this.reshuffleDiscard();
                this.state.hands[player.id].push(this.state.deck.pop());
            }
        });
    }

    reshuffleDiscard() {
        if (this.state.discardPile.length <= 1) return;

        const topCard = this.state.discardPile.pop();
        const newDeck = this.state.discardPile;
        this.state.discardPile = [topCard];
        this.state.deck = newDeck;
        this.shuffleDeck();
        this.addLog('Deste karıştırıldı.');
    }

    handleAction(socket, action) {
        try {
            const player = this.room.players.find(p => p.id === socket.id);
            if (!player) return;

            const currentPlayer = this.room.players[this.state.turnIndex];

            // Validate turn
            if (currentPlayer.id !== player.id) {
                // Allow calling UNO out of turn? Usually you call it for yourself before playing.
                // For simplicity, strict turn enforcement for plays.
                return;
            }

            switch (action.type) {
                case 'PLAY_CARD':
                    this.playCard(player, action.cardId, action.chosenColor);
                    break;
                case 'DRAW_CARD':
                    this.drawCard(player);
                    break;
                case 'SAY_UNO':
                    this.sayUno(player);
                    break;
            }
        } catch (error) {
            console.error('[Uno] Error in handleAction:', error);
        }
    }

    playCard(player, cardId, chosenColor) {
        if (this.state.pendingColorChoice) return; // Must choose color first if pending? No, usually sent with play.

        const hand = this.state.hands[player.id];
        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const card = hand[cardIndex];

        // Validation
        if (!this.isValidMove(card)) {
            // Invalid move
            return;
        }

        // Remove card from hand
        hand.splice(cardIndex, 1);
        this.state.discardPile.push(card);

        // Handle Effects
        this.state.currentColor = card.color;
        this.state.currentType = card.type;
        this.state.currentValue = card.value;

        let nextTurnDelay = 1000; // Delay before next turn logic

        if (card.color === 'black') {
            if (!chosenColor || !['red', 'blue', 'green', 'yellow'].includes(chosenColor)) {
                // Should have chosen a color. In a real app, we'd ask for it.
                // Assuming frontend sends it. If not, default to red (fallback).
                chosenColor = 'red';
            }
            this.state.currentColor = chosenColor;
            this.addLog(`${player.name} rengi ${this.translateColor(chosenColor)} olarak değiştirdi.`);
        }

        this.addLog(`${player.name} oynadı: ${this.formatCard(card)}`);

        // Check Win
        if (hand.length === 0) {
            this.state.winner = player.id;
            this.state.phase = 'END';
            this.addLog(`OYUN BİTTİ! Kazanan: ${player.name}`);
            this.broadcastState();
            return;
        }

        // Check Uno Failure (Did they say Uno if they have 1 card left?)
        if (hand.length === 1 && !this.state.unoCalls[player.id]) {
            // Forgot to say Uno! Penalty.
            // In strict rules, you must be caught. Here, auto-penalty for simplicity or strict enforcement?
            // Let's make it auto-penalty for now to teach them.
            this.addLog(`${player.name} UNO demeyi unuttu! +2 Ceza.`);
            this.drawCards(player.id, 2);
        }

        // Reset Uno call for next turn
        this.state.unoCalls[player.id] = false;

        // Apply Special Effects
        if (card.type === 'skip') {
            this.addLog('Sıradaki oyuncu atlandı!');
            this.advanceTurn(); // Skip one
        } else if (card.type === 'reverse') {
            this.state.direction *= -1;
            this.addLog('Yön değişti!');
            if (this.room.players.length === 2) {
                // In 2 player game, Reverse acts like Skip
                this.advanceTurn();
            }
        } else if (card.type === 'draw2') {
            const nextPlayer = this.getNextPlayer();
            this.addLog(`${nextPlayer.name} 2 kart çekti ve sırası geçti.`);
            this.drawCards(nextPlayer.id, 2);
            this.advanceTurn(); // Skip them
        } else if (card.type === 'wild4') {
            const nextPlayer = this.getNextPlayer();
            this.addLog(`${nextPlayer.name} 4 kart çekti ve sırası geçti.`);
            this.drawCards(nextPlayer.id, 4);
            this.advanceTurn(); // Skip them
        }

        this.advanceTurn();
        this.broadcastState();
    }

    isValidMove(card) {
        // Wilds are always playable
        if (card.color === 'black') return true;

        // Match color
        if (card.color === this.state.currentColor) return true;

        // Match type/value
        if (card.type === 'number' && card.value === this.state.currentValue) return true;
        if (['skip', 'reverse', 'draw2'].includes(card.type) && card.type === this.state.currentType) return true;

        return false;
    }

    drawCard(player) {
        // Player draws 1 card
        const card = this.drawCards(player.id, 1)[0];
        this.addLog(`${player.name} kart çekti.`);

        // If playable, they can play it immediately (Optionally auto-play or user choice. User choice is better UI but complex.
        // For MVP: Just draw and pass turn. Or allow play if valid.
        // Let's allow play if valid, otherwise pass.

        if (this.isValidMove(card)) {
            // Client should prompt "Play this card?". 
            // For now, we just update state and let them play it in a separate action if they want?
            // Or we enforce "Draw-Pass" or "Draw-Play".
            // Simplest: Draw adds to hand. Turn does NOT end automatically. Player must explicitly "Pass" or "Play".
            // But to keep it simple: If you draw, your turn ends unless you play that specific card.
            // Let's just end turn for now to speed up game flow.
            this.advanceTurn();
        } else {
            this.advanceTurn();
        }

        this.broadcastState();
    }

    drawCards(playerId, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.state.deck.length === 0) this.reshuffleDiscard();
            if (this.state.deck.length > 0) {
                const card = this.state.deck.pop();
                this.state.hands[playerId].push(card);
                drawn.push(card);
            }
        }
        return drawn;
    }

    sayUno(player) {
        const hand = this.state.hands[player.id];
        if (hand.length <= 2) { // Can say it when you have 2 cards (about to play 1) or 1 card
            this.state.unoCalls[player.id] = true;
            this.addLog(`${player.name}: "UNO!"`);
            this.broadcastState();
        }
    }

    advanceTurn() {
        const numPlayers = this.room.players.length;
        this.state.turnIndex = (this.state.turnIndex + this.state.direction + numPlayers) % numPlayers;
    }

    getNextPlayer() {
        const numPlayers = this.room.players.length;
        const nextIndex = (this.state.turnIndex + this.state.direction + numPlayers) % numPlayers;
        return this.room.players[nextIndex];
    }

    addLog(message) {
        this.state.logs.push({ message, timestamp: Date.now() });
        if (this.state.logs.length > 50) this.state.logs.shift();
    }

    translateColor(color) {
        const map = { 'red': 'Kırmızı', 'blue': 'Mavi', 'green': 'Yeşil', 'yellow': 'Sarı' };
        return map[color] || color;
    }

    formatCard(card) {
        if (card.color === 'black') {
            return card.type === 'wild4' ? 'Valiz (4 Çek)' : 'Renk Değiştirici';
        }
        const colorName = this.translateColor(card.color);
        if (card.type === 'number') return `${colorName} ${card.value}`;
        if (card.type === 'skip') return `${colorName} Atla`;
        if (card.type === 'reverse') return `${colorName} Yön`;
        if (card.type === 'draw2') return `${colorName} 2 Çek`;
        return 'Kart';
    }

    broadcastState() {
        this.room.players.forEach(player => {
            // Hide other players' hands
            const opponentHands = {};
            this.room.players.forEach(p => {
                if (p.id !== player.id) {
                    opponentHands[p.id] = this.state.hands[p.id] ? this.state.hands[p.id].length : 0; // Only send count
                }
            });

            const playerState = {
                phase: this.state.phase,
                myHand: this.state.hands[player.id] || [],
                opponentHands: opponentHands,
                discardTop: this.state.discardPile[this.state.discardPile.length - 1],
                turnPlayerId: this.room.players[this.state.turnIndex].id,
                direction: this.state.direction,
                currentColor: this.state.currentColor,
                logs: this.state.logs,
                winner: this.state.winner
            };

            this.io.to(player.id).emit('gameState', playerState);
        });
    }

    updatePlayerId(oldPlayerId, newPlayerId) {
        // Migrate hands
        if (this.state.hands[oldPlayerId]) {
            this.state.hands[newPlayerId] = this.state.hands[oldPlayerId];
            delete this.state.hands[oldPlayerId];
        }

        // Migrate Uno calls
        if (this.state.unoCalls[oldPlayerId] !== undefined) {
            this.state.unoCalls[newPlayerId] = this.state.unoCalls[oldPlayerId];
            delete this.state.unoCalls[oldPlayerId];
        }

        // Winner check
        if (this.state.winner === oldPlayerId) {
            this.state.winner = newPlayerId;
        }

        // Note: turnIndex relies on room.players array order, which RoomManager updates.
        // So we don't need to update turnIndex, just the ID references in state.

        // Re-broadcast to ensure client gets new state with correct ID
        this.broadcastState();
    }
}

module.exports = UnoGame;
