class MonopolyDeal {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players; // [{id, name, ...}]
        this.state = {
            phase: 'SETUP', // SETUP, TURN, DISCARD, END
            turnPlayerId: null,
            actionsRemaining: 0,
            deck: [],
            discardPile: [],
            players: {}, // playerId -> { hand: [], bank: [], properties: { color: [] } }
            logs: []
        };

        this.CONSTANTS = {
            MAX_HAND: 7,
            ACTIONS_PER_TURN: 3,
            WIN_SETS: 3
        };

        this.initGame();
    }

    initGame() {
        // Initialize Player State
        this.players.forEach(p => {
            this.state.players[p.id] = {
                hand: [],
                bank: [], // Cards played as money
                properties: {}, // color -> [cards]
                id: p.id,
                name: p.name
            };
        });

        this.createDeck();
        this.shuffleDeck();
        this.dealInitialCards();

        this.state.turnPlayerId = this.players[0].id;
        this.state.phase = 'TURN';
        this.startTurn();

        this.broadcastState();
        this.log('Oyun Başladı! Sıra: ' + this.getPlayerName(this.state.turnPlayerId));
    }

    createDeck() {
        const cards = [];
        const add = (type, subType, value, count, color1 = null, color2 = null) => {
            for (let i = 0; i < count; i++) {
                cards.push({
                    id: \`card_\${cards.length}\`,
                    type, // PROPERTY, MONEY, ACTION, RENT
                    subType, // NAME (e.g., "Deal Breaker", "Blue Property")
                    value, // Monetary value
                    color1, // Primary color (for properties/rents)
                    color2, // Secondary color (for wilds/rents)
                    isWild: !!color2 || subType === 'WILD_PROPERTY'
                });
            }
        };

        // --- MONEY (20) ---
        add('MONEY', '1M', 1, 6);
        add('MONEY', '2M', 2, 5);
        add('MONEY', '3M', 3, 3);
        add('MONEY', '4M', 4, 3);
        add('MONEY', '5M', 5, 2);
        add('MONEY', '10M', 10, 1);

        // --- PROPERTIES (28 Solid + 11 Wild = 39) ---
        // Brown (2 to complete)
        add('PROPERTY', 'Brown', 1, 2, 'brown');
        // Dark Blue (2 to complete)
        add('PROPERTY', 'DarkBlue', 4, 2, 'darkBlue');
        // Green (3 to complete)
        add('PROPERTY', 'Green', 4, 3, 'green');
        // Light Blue (3 to complete)
        add('PROPERTY', 'LightBlue', 1, 3, 'lightBlue');
        // Orange (3 to complete)
        add('PROPERTY', 'Orange', 2, 3, 'orange');
        // Pink (3 to complete)
        add('PROPERTY', 'Pink', 2, 3, 'pink');
        // Black/Railroad (4 to complete)
        add('PROPERTY', 'Railroad', 2, 4, 'black');
        // Red (3 to complete)
        add('PROPERTY', 'Red', 3, 3, 'red');
        // Light Green/Utility (2 to complete)
        add('PROPERTY', 'Utility', 2, 2, 'lightGreen');
        // Yellow (3 to complete)
        add('PROPERTY', 'Yellow', 3, 3, 'yellow');

        // Wild Properties
        add('PROPERTY', 'Wild', 1, 1, 'darkBlue', 'green');
        add('PROPERTY', 'Wild', 1, 1, 'lightBlue', 'brown');
        add('PROPERTY', 'Wild', 4, 1, 'green', 'black'); // Railroad
        add('PROPERTY', 'Wild', 2, 1, 'lightBlue', 'black'); // Railroad
        add('PROPERTY', 'Wild', 2, 1, 'utility', 'black'); // Railroad
        add('PROPERTY', 'Wild', 4, 2, 'pink', 'orange');
        add('PROPERTY', 'Wild', 3, 2, 'red', 'yellow');
        add('PROPERTY', 'Wild', 0, 2, 'ANY', 'ANY'); // Multicolor Wild (Value 0, no rent value usually, but serves as any color)

        // --- ACTIONS (34) ---
        add('ACTION', 'Deal Breaker', 5, 2); // Steal full set
        add('ACTION', 'Just Say No', 4, 3); // Cancel action
        add('ACTION', 'Pass Go', 1, 10); // Draw 2
        add('ACTION', 'Forced Deal', 3, 3); // Swap
        add('ACTION', 'Sly Deal', 3, 3); // Steal single
        add('ACTION', 'Debt Collector', 3, 3); // Force 5M
        add('ACTION', 'Birthday', 2, 3); // All pay 2M
        add('ACTION', 'Double Rent', 1, 2); // Double rent
        add('ACTION', 'House', 3, 3); // +3M on full set
        add('ACTION', 'Hotel', 4, 2); // +4M on full set (with house)

        // --- RENT (13) ---
        add('RENT', 'Rent', 1, 2, 'darkBlue', 'green');
        add('RENT', 'Rent', 1, 2, 'red', 'yellow');
        add('RENT', 'Rent', 1, 2, 'pink', 'orange');
        add('RENT', 'Rent', 1, 2, 'lightBlue', 'brown');
        add('RENT', 'Rent', 1, 2, 'black', 'lightGreen'); // Railroad/Utility
        add('RENT', 'Rent', 3, 3, 'ANY', 'ANY'); // Wild Rent

        this.state.deck = cards;
    }

    shuffleDeck() {
        this.state.deck.sort(() => 0.5 - Math.random());
    }

    dealInitialCards() {
        const playerIds = Object.keys(this.state.players);
        for (let i = 0; i < 5; i++) {
            playerIds.forEach(pid => {
                if (this.state.deck.length > 0) {
                    this.state.players[pid].hand.push(this.state.deck.shift());
                }
            });
        }
    }

    startTurn() {
        this.state.actionsRemaining = this.CONSTANTS.ACTIONS_PER_TURN;
        
        // Draw 2 cards (or 5 if hand empty)
        const player = this.state.players[this.state.turnPlayerId];
        const drawCount = player.hand.length === 0 ? 5 : 2;
        
        for (let i = 0; i < drawCount; i++) {
            if (this.state.deck.length === 0) {
                this.reshuffleDiscard();
            }
            if (this.state.deck.length > 0) {
                player.hand.push(this.state.deck.shift());
            }
        }
    }

    reshuffleDiscard() {
        if (this.state.discardPile.length === 0) return;
        this.state.deck = [...this.state.discardPile];
        this.state.discardPile = [];
        this.shuffleDeck();
        this.log('Deste bitti, ıskarta karıştırıldı.');
    }

    handleAction(socket, action) {
        const pid = socket.id;
        if (pid !== this.state.turnPlayerId) return;

        if (this.state.phase === 'TURN') {
            if (action.type === 'PLAY_CARD') {
                this.playCard(pid, action.cardIndex, action.target, action.opts);
            } else if (action.type === 'END_TURN') {
                this.endTurn(pid);
            }
        } else if (this.state.phase === 'DISCARD') {
            if (action.type === 'DISCARD_CARD') {
                this.discardCard(pid, action.cardIndex);
            }
        }
    }

    playCard(pid, cardIndex, target, opts) {
        if (this.state.actionsRemaining <= 0) return;

        const player = this.state.players[pid];
        const card = player.hand[cardIndex];
        if (!card) return;

        // Remove from hand temporarily (will add back if invalid, or move to dest)
        player.hand.splice(cardIndex, 1);
        let actionSuccessful = true;

        if (target === 'BANK') {
            // Money, Action, Rent, House/Hotel can be banked
            if (card.type !== 'PROPERTY') {
                player.bank.push(card);
                this.log(`${ player.name } bankaya ${ card.value }M yatırdı.`);
            } else {
                actionSuccessful = false;
            }
        } else if (target === 'PROPERTY') {
            // Property or House/Hotel (if valid)
            if (card.type === 'PROPERTY') {
                // Logic to add to property set
                // For now simple: add to color group
                const color = opts.color || card.color1; // For wilds, user chooses
                if (!player.properties[color]) player.properties[color] = [];
                player.properties[color].push(card);
                this.log(`${ player.name } ${ color } setine kart ekledi.`);
            } else {
                actionSuccessful = false;
            }
        } else if (target === 'ACTION') {
            // Play Action Card
            if (card.type === 'ACTION' || card.type === 'RENT') {
                this.resolveActionEffect(pid, card, opts);
                this.state.discardPile.push(card); // Actions go to discard after use
                this.log(`${ player.name } ${ card.subType } oynadı!`);
            } else {
                actionSuccessful = false;
            }
        }

        if (actionSuccessful) {
            this.state.actionsRemaining--;
            this.checkWinCondition(pid);
        } else {
            player.hand.splice(cardIndex, 0, card); // Put back
        }

        this.broadcastState();
    }

    resolveActionEffect(pid, card, opts) {
        // TODO: Implement specific action logic (Stealing, Rent, etc.)
        // For MVP, just logging.
        if (card.subType === 'Pass Go') {
            const player = this.state.players[pid];
            for(let i=0; i<2; i++) {
                if (this.state.deck.length === 0) this.reshuffleDiscard();
                if (this.state.deck.length > 0) player.hand.push(this.state.deck.shift());
            }
        }
    }

    endTurn(pid) {
        const player = this.state.players[pid];
        if (player.hand.length > this.CONSTANTS.MAX_HAND) {
            this.state.phase = 'DISCARD';
            this.broadcastState();
            return;
        }

        // Next player
        const currentIdx = this.players.findIndex(p => p.id === pid);
        const nextIdx = (currentIdx + 1) % this.players.length;
        this.state.turnPlayerId = this.players[nextIdx].id;
        this.state.phase = 'TURN';
        this.startTurn();
        this.broadcastState();
    }

    discardCard(pid, cardIndex) {
        const player = this.state.players[pid];
        const card = player.hand.splice(cardIndex, 1)[0];
        this.state.discardPile.push(card);

        if (player.hand.length <= this.CONSTANTS.MAX_HAND) {
            this.endTurn(pid); // Retry ending turn
        } else {
            this.broadcastState();
        }
    }

    checkWinCondition(pid) {
        // TODO: Check for 3 full sets
    }

    log(msg) {
        this.state.logs.push({ message: msg, timestamp: Date.now() });
        this.io.to(this.roomId).emit('gameLog', { message: msg });
    }

    getPlayerName(id) {
        return this.players.find(p => p.id === id)?.name || 'Unknown';
    }

    sendStateTo(playerId) {
        const p = this.players.find(pl => pl.id === playerId);
        if (!p) return;

        // Hide other players' hands
        const publicPlayers = {};
        Object.keys(this.state.players).forEach(key => {
            const player = this.state.players[key];
            publicPlayers[key] = {
                ...player,
                hand: key === playerId ? player.hand : player.hand.length // Only show count for others
            };
        });

        this.io.to(playerId).emit('gameState', {
            ...this.state,
            players: publicPlayers,
            deck: this.state.deck.length // Only show count
        });
    }

    broadcastState() {
        this.players.forEach(p => this.sendStateTo(p.id));
    }
    
    updatePlayerId(oldId, newId) {
        if (this.state.players[oldId]) {
            this.state.players[newId] = this.state.players[oldId];
            this.state.players[newId].id = newId;
            delete this.state.players[oldId];
        }
        if (this.state.turnPlayerId === oldId) this.state.turnPlayerId = newId;
        this.broadcastState();
    }
}

module.exports = MonopolyDeal;
