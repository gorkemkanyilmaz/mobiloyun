class KimDahaYakin {
    constructor(room, io) {
        this.io = io;
        this.roomId = room.id;
        this.players = room.players;
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
        this.usedQuestions = [];
        this.initGame();
    }

    createQuestions() {
        try {
            const fs = require('fs');
            const path = require('path');
            const dataPath = path.join(__dirname, '../data/questions.json');

            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath);
                const jsonData = JSON.parse(rawData);

                // Map JSON format to internal format
                // JSON: { question, answer, category }
                // Internal: { cat, q, a }
                return jsonData.questions.map(item => ({
                    cat: item.category,
                    q: item.question,
                    a: item.answer
                }));
            }
        } catch (error) {
            console.error('Error loading questions from JSON:', error);
        }

        // Fallback questions if file fails
        return [
            { cat: 'Coğrafya', q: 'Türkiye nüfusu kaç milyon?', a: 85 }, { cat: 'Coğrafya', q: 'Everest kaç metre?', a: 8849 }, { cat: 'Tarih', q: 'Boğaz Köprüsü hangi yıl?', a: 1973 }, { cat: 'Spor', q: 'Futbol sahası kaç metre?', a: 105 }, { cat: 'Bilim', q: 'Ay uzaklığı kaç bin km?', a: 384 },
            { cat: 'Coğrafya', q: 'İstanbul km²?', a: 5461 }, { cat: 'Tarih', q: 'Cumhuriyet yılı?', a: 1923 }, { cat: 'Bilim', q: 'İnsan kemik sayısı?', a: 206 }, { cat: 'Coğrafya', q: 'Dünya kaç ülke?', a: 195 }, { cat: 'Spor', q: 'Basket potası cm?', a: 305 }
        ];
    }

    initGame() {
        this.players.forEach(p => {
            this.state.players[p.id] = { name: p.name, score: 0, currentGuess: null, hasAnswered: false };
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
