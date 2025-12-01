class MonopolyDeal {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players;
        this.state = {
            phase: 'TURN', // TURN, PAYMENT, DISCARD, END
            turnPlayerId: null,
            actionsRemaining: 0,
            deck: [],
            discardPile: [],
            players: {},
            paymentRequest: null, // { targetIds: [], amount: 0, creditorId: null }
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
        this.players.forEach(p => {
            this.state.players[p.id] = {
                hand: [],
                bank: [],
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
                    id: `card_${cards.length}`,
                    type, subType, value, color1, color2,
                    isWild: !!color2 || subType === 'WILD_PROPERTY'
                });
            }
        };

        // MONEY
        add('MONEY', '1M', 1, 6); add('MONEY', '2M', 2, 5); add('MONEY', '3M', 3, 3);
        add('MONEY', '4M', 4, 3); add('MONEY', '5M', 5, 2); add('MONEY', '10M', 10, 1);

        // PROPERTIES
        add('PROPERTY', 'Brown', 1, 2, 'brown'); add('PROPERTY', 'DarkBlue', 4, 2, 'darkBlue');
        add('PROPERTY', 'Green', 4, 3, 'green'); add('PROPERTY', 'LightBlue', 1, 3, 'lightBlue');
        add('PROPERTY', 'Orange', 2, 3, 'orange'); add('PROPERTY', 'Pink', 2, 3, 'pink');
        add('PROPERTY', 'Railroad', 2, 4, 'black'); add('PROPERTY', 'Red', 3, 3, 'red');
        add('PROPERTY', 'Utility', 2, 2, 'lightGreen'); add('PROPERTY', 'Yellow', 3, 3, 'yellow');

        // WILD PROPERTIES
        add('PROPERTY', 'Wild', 1, 1, 'darkBlue', 'green'); add('PROPERTY', 'Wild', 1, 1, 'lightBlue', 'brown');
        add('PROPERTY', 'Wild', 4, 1, 'green', 'black'); add('PROPERTY', 'Wild', 2, 1, 'lightBlue', 'black');
        add('PROPERTY', 'Wild', 2, 1, 'utility', 'black'); add('PROPERTY', 'Wild', 4, 2, 'pink', 'orange');
        add('PROPERTY', 'Wild', 3, 2, 'red', 'yellow'); add('PROPERTY', 'Wild', 0, 2, 'ANY', 'ANY');

        // ACTIONS
        add('ACTION', 'Deal Breaker', 5, 2); add('ACTION', 'Just Say No', 4, 3);
        add('ACTION', 'Pass Go', 1, 10); add('ACTION', 'Forced Deal', 3, 3);
        add('ACTION', 'Sly Deal', 3, 3); add('ACTION', 'Debt Collector', 3, 3);
        add('ACTION', 'Birthday', 2, 3); add('ACTION', 'Double Rent', 1, 2);
        add('ACTION', 'House', 3, 3); add('ACTION', 'Hotel', 4, 2);

        // RENT
        add('RENT', 'Rent', 1, 2, 'darkBlue', 'green'); add('RENT', 'Rent', 1, 2, 'red', 'yellow');
        add('RENT', 'Rent', 1, 2, 'pink', 'orange'); add('RENT', 'Rent', 1, 2, 'lightBlue', 'brown');
        add('RENT', 'Rent', 1, 2, 'black', 'lightGreen'); add('RENT', 'Rent', 3, 3, 'ANY', 'ANY');

        this.state.deck = cards;
    }

    shuffleDeck() { this.state.deck.sort(() => 0.5 - Math.random()); }

    dealInitialCards() {
        const playerIds = Object.keys(this.state.players);
        for (let i = 0; i < 5; i++) {
            playerIds.forEach(pid => {
                if (this.state.deck.length > 0) this.state.players[pid].hand.push(this.state.deck.shift());
            });
        }
    }

    startTurn() {
        this.state.actionsRemaining = this.CONSTANTS.ACTIONS_PER_TURN;
        const player = this.state.players[this.state.turnPlayerId];
        const drawCount = player.hand.length === 0 ? 5 : 2;
        for (let i = 0; i < drawCount; i++) {
            if (this.state.deck.length === 0) this.reshuffleDiscard();
            if (this.state.deck.length > 0) player.hand.push(this.state.deck.shift());
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

        if (this.state.phase === 'PAYMENT') {
            if (this.state.paymentRequest.targetIds.includes(pid)) {
                if (action.type === 'PAY_DEBT') {
                    this.handlePayment(pid, action.cards);
                }
            }
            return;
        }

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

        player.hand.splice(cardIndex, 1);
        let success = true;

        if (target === 'BANK') {
            if (card.type !== 'PROPERTY') {
                player.bank.push(card);
                this.log(`${player.name} bankaya ${card.value}M yatırdı.`);
            } else success = false;
        } else if (target === 'PROPERTY') {
            if (card.type === 'PROPERTY') {
                const color = opts.color || card.color1;
                if (!player.properties[color]) player.properties[color] = [];
                player.properties[color].push(card);
                this.log(`${player.name} ${color} setine kart ekledi.`);
            } else success = false;
        } else if (target === 'ACTION') {
            if (card.type === 'ACTION' || card.type === 'RENT') {
                this.resolveActionEffect(pid, card, opts);
                this.state.discardPile.push(card);
                this.log(`${player.name} ${card.subType} oynadı!`);
            } else success = false;
        }

        if (success) {
            this.state.actionsRemaining--;
            this.checkWinCondition(pid);
        } else {
            player.hand.splice(cardIndex, 0, card);
        }
        this.broadcastState();
    }

    resolveActionEffect(pid, card, opts) {
        const player = this.state.players[pid];

        if (card.subType === 'Pass Go') {
            for (let i = 0; i < 2; i++) {
                if (this.state.deck.length === 0) this.reshuffleDiscard();
                if (this.state.deck.length > 0) player.hand.push(this.state.deck.shift());
            }
        } else if (card.subType === 'Birthday') {
            const targets = Object.keys(this.state.players).filter(id => id !== pid);
            this.requestPayment(targets, 2, pid);
        } else if (card.subType === 'Debt Collector') {
            if (opts.targetId) this.requestPayment([opts.targetId], 5, pid);
        } else if (card.type === 'RENT') {
            // Rent logic simplified for MVP
            const rentAmount = this.calculateRent(opts.color, player);
            const targets = Object.keys(this.state.players).filter(id => id !== pid);
            this.requestPayment(targets, rentAmount, pid);
        }
        // TODO: Sly Deal, Forced Deal, Deal Breaker implementation
    }

    calculateRent(color, player) {
        // Simplified rent calc
        const count = player.properties[color]?.length || 0;
        return count; // Placeholder: needs real rent values
    }

    requestPayment(targetIds, amount, creditorId) {
        this.state.phase = 'PAYMENT';
        this.state.paymentRequest = { targetIds, amount, creditorId };
        this.log(`${this.getPlayerName(creditorId)} ${amount}M ödeme istedi!`);
    }

    handlePayment(payerId, paymentCards) { // paymentCards: [{source: 'BANK'|'PROPERTY', index: 0, color: 'red'}]
        const payer = this.state.players[payerId];
        const creditor = this.state.players[this.state.paymentRequest.creditorId];

        // Move cards
        paymentCards.forEach(pc => {
            let card;
            if (pc.source === 'BANK') {
                card = payer.bank.splice(pc.index, 1)[0];
                creditor.bank.push(card);
            } else {
                card = payer.properties[pc.color].splice(pc.index, 1)[0];
                if (!creditor.properties[pc.color]) creditor.properties[pc.color] = [];
                creditor.properties[pc.color].push(card);
            }
        });

        // Remove payer from request
        this.state.paymentRequest.targetIds = this.state.paymentRequest.targetIds.filter(id => id !== payerId);

        if (this.state.paymentRequest.targetIds.length === 0) {
            this.state.phase = 'TURN';
            this.state.paymentRequest = null;
        }
        this.broadcastState();
    }

    endTurn(pid) {
        const player = this.state.players[pid];
        if (player.hand.length > this.CONSTANTS.MAX_HAND) {
            this.state.phase = 'DISCARD';
            this.broadcastState();
            return;
        }
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
        if (player.hand.length <= this.CONSTANTS.MAX_HAND) this.endTurn(pid);
        else this.broadcastState();
    }

    checkWinCondition(pid) {
        const player = this.state.players[pid];
        let fullSets = 0;
        // Simplified check - needs real set sizes
        Object.keys(player.properties).forEach(color => {
            if (player.properties[color].length >= 3) fullSets++;
        });
        if (fullSets >= 3) {
            this.state.phase = 'END';
            this.log(`${player.name} OYUNU KAZANDI!`);
        }
    }

    log(msg) {
        this.state.logs.push({ message: msg, timestamp: Date.now() });
        this.io.to(this.roomId).emit('gameLog', { message: msg });
    }

    getPlayerName(id) { return this.players.find(p => p.id === id)?.name || 'Unknown'; }

    sendStateTo(playerId) {
        const p = this.players.find(pl => pl.id === playerId);
        if (!p) return;
        const publicPlayers = {};
        Object.keys(this.state.players).forEach(key => {
            const player = this.state.players[key];
            publicPlayers[key] = {
                ...player,
                hand: key === playerId ? player.hand : player.hand.length
            };
        });
        this.io.to(playerId).emit('gameState', {
            ...this.state,
            players: publicPlayers,
            deck: this.state.deck.length
        });
    }

    broadcastState() { this.players.forEach(p => this.sendStateTo(p.id)); }

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
