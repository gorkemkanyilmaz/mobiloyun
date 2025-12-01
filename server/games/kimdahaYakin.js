class KimDahaYakin {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players;
        this.state = {
            phase: 'QUESTION',
            currentRound: 1,
            totalRounds: 10,
            currentQuestion: null,
            timeRemaining: 30,
            players: {},
            roundResults: null,
            logs: []
        };

        this.questions = this.createQuestions();
    });
        this.nextQuestion();
    }

nextQuestion() {
    const available = this.questions.filter(q => !this.usedQuestions.includes(q));
    if (available.length === 0 || this.state.currentRound > this.state.totalRounds) {
        this.endGame();
        return;
    }
    const q = available[Math.floor(Math.random() * available.length)];
    this.usedQuestions.push(q);
    this.state.currentQuestion = q;
    this.state.phase = 'QUESTION';
    this.state.timeRemaining = 30;
    Object.values(this.state.players).forEach(p => { p.currentGuess = null; p.hasAnswered = false; });
    this.broadcastState();
    this.startTimer();
}

startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
        this.state.timeRemaining--;
        if (this.state.timeRemaining <= 0) {
            clearInterval(this.timer);
            this.revealAnswers();
        }
        this.broadcastState();
    }, 1000);
}

handleAction(socket, action) {
    const pid = socket.id;
    if (action.type === 'SUBMIT_GUESS' && this.state.phase === 'QUESTION') {
        this.state.players[pid].currentGuess = action.guess;
        this.state.players[pid].hasAnswered = true;
        if (Object.values(this.state.players).every(p => p.hasAnswered)) {
            clearInterval(this.timer);
            this.revealAnswers();
        }
        this.broadcastState();
    }
}

revealAnswers() {
    this.state.phase = 'REVEAL';
    const correct = this.state.currentQuestion.a;
    const guesses = Object.entries(this.state.players).map(([id, p]) => ({
        player: p.name, guess: p.currentGuess || 0, diff: Math.abs((p.currentGuess || 0) - correct)
    })).sort((a, b) => a.diff - b.diff);

    const minDiff = guesses[0].diff;
    guesses.filter(g => g.diff === minDiff).forEach(g => {
        const p = Object.values(this.state.players).find(pl => pl.name === g.player);
        if (p) p.score++;
    });

    this.state.roundResults = { correct, guesses };
    this.broadcastState();

    setTimeout(() => {
        this.state.currentRound++;
        this.nextQuestion();
    }, 5000);
}

endGame() {
    this.state.phase = 'END';
    this.broadcastState();
}

sendStateTo(playerId) {
    this.io.to(playerId).emit('gameState', this.state);
}

broadcastState() {
    this.players.forEach(p => this.sendStateTo(p.id));
}

updatePlayerId(oldId, newId) {
    if (this.state.players[oldId]) {
        this.state.players[newId] = this.state.players[oldId];
        delete this.state.players[oldId];
    }
    this.broadcastState();
}
}

module.exports = KimDahaYakin;
