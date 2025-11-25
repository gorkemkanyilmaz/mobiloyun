class SecretHitler {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players;
        this.state = {
            phase: 'SETUP', // SETUP, ELECTION, LEGISLATIVE, EXECUTIVE, END
            roles: {}, // playerId -> LIBERAL, FASCIST, HITLER
            presidentId: null,
            chancellorId: null,
            chancellorNomineeId: null,
            liberalPolicies: 0,
            fascistPolicies: 0,
            electionTracker: 0,
            deck: [],
            discardPile: [],
            hand: [], // Cards currently being looked at
            votes: {}, // playerId -> true/false (Ja/Nein)
            lastPresidentId: null,
            lastChancellorId: null,
            logs: []
        };

        this.ROLES = {
            LIBERAL: 'LIBERAL',
            FASCIST: 'FASCIST',
            HITLER: 'HITLER'
        };

        this.initGame();
    }

    initGame() {
        // Role Distribution (Simplified for 5-6 players: 3L+2F(inc H) / 4L+2F)
        const shuffledPlayers = [...this.players].sort(() => 0.5 - Math.random());
        const count = this.players.length;
        let fascistCount = Math.ceil(count / 2) - 1; // Approx
        if (count === 5 || count === 6) fascistCount = 2; // 1F + 1H

        shuffledPlayers.forEach((p, i) => {
            if (i === 0) this.state.roles[p.id] = this.ROLES.HITLER;
            else if (i < fascistCount) this.state.roles[p.id] = this.ROLES.FASCIST;
            else this.state.roles[p.id] = this.ROLES.LIBERAL;
        });

        // Initialize Deck (11 Fascist, 6 Liberal)
        this.state.deck = Array(11).fill('FASCIST').concat(Array(6).fill('LIBERAL'));
        this.shuffleDeck();

        this.state.presidentId = this.players[0].id; // Random start
        this.state.phase = 'ELECTION';

        this.broadcastState();
        this.log('Oyun Başladı! Başkan adayı: ' + this.getPlayerName(this.state.presidentId));
    }

    shuffleDeck() {
        this.state.deck.sort(() => 0.5 - Math.random());
    }

    handleAction(socket, action) {
        const pid = socket.id;

        if (this.state.phase === 'ELECTION') {
            if (action.type === 'NOMINATE' && pid === this.state.presidentId) {
                this.state.chancellorNomineeId = action.targetId;
                this.state.phase = 'VOTING';
                this.state.votes = {};
                this.broadcastState();
                this.log(`Şansölye adayı: ${this.getPlayerName(action.targetId)}. Oylama başladı!`);
            }
        } else if (this.state.phase === 'VOTING') {
            if (action.type === 'VOTE') {
                this.state.votes[pid] = action.vote; // true/false
                if (Object.keys(this.state.votes).length === this.players.length) {
                    this.resolveVote();
                } else {
                    this.broadcastState();
                }
            }
        } else if (this.state.phase === 'LEGISLATIVE') {
            if (action.type === 'DISCARD' && this.state.hand.length > 0) {
                // President discards 1, then Chancellor discards 1
                if (pid === this.state.presidentId && this.state.hand.length === 3) {
                    this.state.discardPile.push(this.state.hand.splice(action.index, 1)[0]);
                    this.broadcastState(); // Notify chancellor
                } else if (pid === this.state.chancellorId && this.state.hand.length === 2) {
                    this.state.discardPile.push(this.state.hand.splice(action.index, 1)[0]);
                    this.enactPolicy(this.state.hand[0]);
                }
            }
        }
    }

    resolveVote() {
        const jaVotes = Object.values(this.state.votes).filter(v => v).length;
        const neinVotes = this.players.length - jaVotes;

        this.log(`Oylama Sonucu: ${jaVotes} JA - ${neinVotes} NEIN`);

        if (jaVotes > neinVotes) {
            this.state.chancellorId = this.state.chancellorNomineeId;

            // Check Hitler Win
            if (this.state.fascistPolicies >= 3 && this.state.roles[this.state.chancellorId] === this.ROLES.HITLER) {
                this.endGame('FASCIST');
                return;
            }

            this.state.electionTracker = 0;
            this.startLegislativeSession();
        } else {
            this.state.electionTracker++;
            if (this.state.electionTracker >= 3) {
                this.log('Seçim çıkmazı! En üstteki yasa uygulanıyor.');
                this.enactTopPolicy();
                this.state.electionTracker = 0;
            }
            this.advancePresident();
        }
    }

    startLegislativeSession() {
        this.state.phase = 'LEGISLATIVE';
        if (this.state.deck.length < 3) {
            this.state.deck = [...this.state.deck, ...this.state.discardPile];
            this.state.discardPile = [];
            this.shuffleDeck();
        }
        this.state.hand = this.state.deck.splice(0, 3);
        this.broadcastState();
    }

    enactPolicy(policy) {
        if (policy === 'LIBERAL') {
            this.state.liberalPolicies++;
            this.log('Liberal yasa kabul edildi!');
        } else {
            this.state.fascistPolicies++;
            this.log('Faşist yasa kabul edildi!');
            // TODO: Handle Executive Actions (Investigate, Kill, etc.)
        }

        if (this.state.liberalPolicies >= 5) this.endGame('LIBERAL');
        else if (this.state.fascistPolicies >= 6) this.endGame('FASCIST');
        else {
            this.state.hand = [];
            this.advancePresident();
        }
    }

    enactTopPolicy() {
        if (this.state.deck.length < 1) {
            this.state.deck = [...this.state.deck, ...this.state.discardPile];
            this.state.discardPile = [];
            this.shuffleDeck();
        }
        const policy = this.state.deck.shift();
        this.enactPolicy(policy);
    }

    advancePresident() {
        this.state.lastPresidentId = this.state.presidentId;
        this.state.lastChancellorId = this.state.chancellorId;
        this.state.chancellorId = null;
        this.state.chancellorNomineeId = null;

        const currentIdx = this.players.findIndex(p => p.id === this.state.presidentId);
        const nextIdx = (currentIdx + 1) % this.players.length;
        this.state.presidentId = this.players[nextIdx].id;

        this.state.phase = 'ELECTION';
        this.broadcastState();
    }

    endGame(winner) {
        this.state.phase = 'END';
        this.log(`Oyun Bitti! Kazanan: ${winner}`);
        this.broadcastState();
    }

    log(msg) {
        this.state.logs.push({ message: msg });
        this.io.to(this.roomId).emit('gameLog', { message: msg });
    }

    getPlayerName(id) {
        return this.players.find(p => p.id === id)?.name || 'Unknown';
    }

    sendStateTo(playerId) {
        const p = this.players.find(pl => pl.id === playerId);
        if (!p) return;

        const myRole = this.state.roles[p.id];
        let knownRoles = {};
        if (myRole === this.ROLES.FASCIST || (myRole === this.ROLES.HITLER && this.players.length <= 6)) {
            knownRoles = this.state.roles;
        } else {
            knownRoles = { [p.id]: myRole };
        }

        this.io.to(p.id).emit('gameState', {
            ...this.state,
            myRole,
            knownRoles,
            roles: undefined, // Hide global roles
            deck: undefined, // Hide deck
            hand: (this.state.phase === 'LEGISLATIVE' && (p.id === this.state.presidentId || p.id === this.state.chancellorId)) ? this.state.hand : []
        });
    }

    broadcastState() {
        this.players.forEach(p => this.sendStateTo(p.id));
    }
}

module.exports = SecretHitler;
