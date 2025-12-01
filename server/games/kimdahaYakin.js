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
        this.usedQuestions = [];
        this.initGame();
    }

    createQuestions() {
        return [
            { cat: 'Coğrafya', q: 'Türkiye nüfusu kaç milyon?', a: 85 }, { cat: 'Coğrafya', q: 'Everest kaç metre?', a: 8849 }, { cat: 'Tarih', q: 'Boğaz Köprüsü hangi yıl?', a: 1973 }, { cat: 'Spor', q: 'Futbol sahası kaç metre?', a: 105 }, { cat: 'Bilim', q: 'Ay uzaklığı kaç bin km?', a: 384 },
            { cat: 'Coğrafya', q: 'İstanbul km²?', a: 5461 }, { cat: 'Tarih', q: 'Cumhuriyet yılı?', a: 1923 }, { cat: 'Bilim', q: 'İnsan kemik sayısı?', a: 206 }, { cat: 'Coğrafya', q: 'Dünya kaç ülke?', a: 195 }, { cat: 'Spor', q: 'Basket potası cm?', a: 305 },
            { cat: 'Coğrafya', q: 'Ankara rakımı metre?', a: 890 }, { cat: 'Coğrafya', q: 'Akdeniz derinlik m?', a: 1500 }, { cat: 'Coğrafya', q: 'Çin nüfus milyon?', a: 1425 }, { cat: 'Coğrafya', q: 'Nil km?', a: 6650 }, { cat: 'Coğrafya', q: 'Sahara milyon km²?', a: 9 },
            { cat: 'Coğrafya', q: 'Amazon milyon km²?', a: 5 }, { cat: 'Coğrafya', q: 'Japonya milyon?', a: 125 }, { cat: 'Coğrafya', q: 'Fransa bin km²?', a: 643 }, { cat: 'Coğrafya', q: 'Rusya milyon km²?', a: 17 }, { cat: 'Coğrafya', q: 'Mariana m?', a: 11034 },
            { cat: 'Coğrafya', q: 'Karadeniz derinlik m?', a: 2212 }, { cat: 'Coğrafya', q: 'İzmir milyon?', a: 4 }, { cat: 'Coğrafya', q: 'Antalya milyon?', a: 2 }, { cat: 'Coğrafya', q: 'Van Gölü km²?', a: 3755 }, { cat: 'Coğrafya', q: 'Tuz Gölü km²?', a: 1665 },
            { cat: 'Tarih', q: 'İstanbul fethi?', a: 1453 }, { cat: 'Tarih', q: 'Amerika keşfi?', a: 1492 }, { cat: 'Tarih', q: '1.Dünya Savaşı?', a: 1914 }, { cat: 'Tarih', q: '2.Dünya Savaşı bitiş?', a: 1945 }, { cat: 'Tarih', q: 'Atatürk doğum?', a: 1881 },
            { cat: 'Tarih', q: 'Fatih doğum?', a: 1432 }, { cat: 'Tarih', q: 'TBMM açılış?', a: 1920 }, { cat: 'Tarih', q: 'Lozan?', a: 1923 }, { cat: 'Tarih', q: 'Ankara başkent?', a: 1923 }, { cat: 'Tarih', q: 'Harf devrimi?', a: 1928 },
            { cat: 'Tarih', q: 'Kadın seçme hakkı?', a: 1934 }, { cat: 'Tarih', q: 'Çanakkale?', a: 1915 }, { cat: 'Tarih', q: 'Malazgirt?', a: 1071 }, { cat: 'Tarih', q: 'Osmanlı kuruluş?', a: 1299 }, { cat: 'Tarih', q: 'Berlin Duvarı?', a: 1989 },
            { cat: 'Tarih', q: 'SSCB dağılma?', a: 1991 }, { cat: 'Tarih', q: 'İlk uçak?', a: 1903 }, { cat: 'Tarih', q: 'Titanic?', a: 1912 }, { cat: 'Tarih', q: 'Fransız İhtilali?', a: 1789 }, { cat: 'Tarih', q: 'Gutenberg?', a: 1440 },
            { cat: 'Bilim', q: 'Işık hızı bin km/s?', a: 300 }, { cat: 'Bilim', q: 'Diş sayısı?', a: 32 }, { cat: 'Bilim', q: 'Su kaynama°C?', a: 100 }, { cat: 'Bilim', q: 'Su donma°C?', a: 0 }, { cat: 'Bilim', q: 'Kas sayısı?', a: 639 },
            { cat: 'Bilim', q: 'Güneş yaş milyar?', a: 4 }, { cat: 'Bilim', q: 'Dünya yaş milyar?', a: 4 }, { cat: 'Bilim', q: 'Yıl kaç saat?', a: 8760 }, { cat: 'Bilim', q: 'Ses hızı m/s?', a: 343 }, { cat: 'Bilim', q: 'Kalp atış/dk?', a: 72 },
            { cat: 'Bilim', q: 'Periyodik element?', a: 118 }, { cat: 'Bilim', q: 'Mars milyon km?', a: 228 }, { cat: 'Bilim', q: 'Venüs milyon km?', a: 108 }, { cat: 'Bilim', q: 'Jüpiter bin km?', a: 143 }, { cat: 'Bilim', q: 'Beyin gram?', a: 1400 },
            { cat: 'Bilim', q: 'Vücut ısı°C?', a: 36 }, { cat: 'Bilim', q: 'Tansiyon üst?', a: 120 }, { cat: 'Bilim', q: 'Pi ilk 3?', a: 314 }, { cat: 'Bilim', q: 'Altın atom no?', a: 79 }, { cat: 'Bilim', q: 'Demir atom no?', a: 26 },
            { cat: 'Spor', q: 'Futbol dk?', a: 90 }, { cat: 'Spor', q: 'Basket dk NBA?', a: 48 }, { cat: 'Spor', q: 'Olimpiyat renk?', a: 5 }, { cat: 'Spor', q: 'Dünya Kupası yıl?', a: 4 }, { cat: 'Spor', q: 'Tenis m?', a: 23 },
            { cat: 'Spor', q: 'Maraton km?', a: 42 }, { cat: 'Spor', q: 'Voleybol kişi?', a: 6 }, { cat: 'Spor', q: 'Futbol kişi?', a: 11 }, { cat: 'Spor', q: 'Basket kişi?', a: 5 }, { cat: 'Spor', q: 'F1 takım?', a: 10 },
            { cat: 'Kültür', q: 'Türk harf?', a: 29 }, { cat: 'Kültür', q: 'Cm kaç mm?', a: 10 }, { cat: 'Kültür', q: 'Saat kaç dk?', a: 60 }, { cat: 'Kültür', q: 'Gün kaç saat?', a: 24 }, { cat: 'Kültür', q: 'Yıl kaç ay?', a: 12 },
            { cat: 'Kültür', q: 'Yıl kaç hafta?', a: 52 }, { cat: 'Kültür', q: 'TR kaç şehir?', a: 81 }, { cat: 'Kültür', q: 'BM Konsey üye?', a: 5 }, { cat: 'Kültür', q: 'AB ülke?', a: 27 }, { cat: 'Kültür', q: 'NATO üye?', a: 31 },
            { cat: 'Kültür', q: 'İskambil kart?', a: 52 }, { cat: 'Kültür', q: 'TL tedavül yıl?', a: 2005 }, { cat: 'Coğrafya', q: 'Kızılırmak km?', a: 1355 }, { cat: 'Coğrafya', q: 'Sakarya km?', a: 824 }, { cat: 'Coğrafya', q: 'Ağrı m?', a: 5137 },
            { cat: 'Coğrafya', q: 'Uludağ m?', a: 2543 }, { cat: 'Coğrafya', q: 'Kaçkar m?', a: 3937 }, { cat: 'Coğrafya', q: 'TR kıyı km?', a: 8333 }, { cat: 'Tarih', q: '93 Harbi?', a: 1877 }, { cat: 'Tarih', q: 'Kurtuluş Savaşı?', a: 1919 }
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
