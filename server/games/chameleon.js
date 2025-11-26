const { v4: uuidv4 } = require('uuid');

class ChameleonGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.state = {
            phase: 'SETUP', // SETUP, ROLE_REVEAL, DISCUSSION, VOTING, CHAMELEON_GUESS, END
            chameleonId: null,
            topic: '',
            secretWord: '',
            votes: {}, // playerId -> targetId
            logs: [],
            timer: 0,
            winner: null,
            wordList: [], // Words for the current topic (for chameleon to guess)
            scores: {}, // playerId -> score
            firstSpeakerIndex: 0,
            firstSpeakerId: null
        };

        // Initialize scores safely
        if (this.room.players) {
            this.room.players.forEach(p => {
                this.state.scores[p.id] = 0;
            });
        }

        this.topics = {
            'Hayvanlar': ['Kedi', 'Köpek', 'Fil', 'Zürafa', 'Aslan', 'Penguen', 'Yunus', 'Kartal', 'Ayı', 'Tavşan'],
            'Yiyecekler': ['Pizza', 'Hamburger', 'Döner', 'Kebap', 'Sushi', 'Makarna', 'Salata', 'Çorba', 'Dondurma', 'Baklava'],
            'Ülkeler': ['Türkiye', 'Almanya', 'Japonya', 'Brezilya', 'İtalya', 'Fransa', 'Rusya', 'Çin', 'Mısır', 'Kanada'],
            'Meslekler': ['Doktor', 'Mühendis', 'Öğretmen', 'Polis', 'İtfaiyeci', 'Aşçı', 'Pilot', 'Avukat', 'Ressam', 'Müzisyen'],
            'Eşyalar': ['Bilgisayar', 'Telefon', 'Masa', 'Sandalye', 'Kalem', 'Kitap', 'Gözlük', 'Saat', 'Çanta', 'Ayakkabı']
        };

        console.log(`[Chameleon] Game initialized for room ${room.id}`);
        this.startNewRound();
    }

    startNewRound() {
        try {
            console.log('[Chameleon] Starting new round...');
            // Clear logs and reset round state
            this.state.logs = [];
            this.state.votes = {};
            this.state.winner = null;
            this.state.phase = 'ROLE_REVEAL';

            // 1. Assign Chameleon
            const players = this.room.players;
            if (!players || players.length === 0) {
                console.error('[Chameleon] No players found!');
                return;
            }

            const chameleonIndex = Math.floor(Math.random() * players.length);
            this.state.chameleonId = players[chameleonIndex].id;

            // 2. Determine First Speaker
            const speakerIdx = this.state.firstSpeakerIndex % players.length;
            this.state.firstSpeakerId = players[speakerIdx].id;
            this.state.firstSpeakerIndex++; // Increment for next round

            // 3. Pick Topic and Word
            const topicKeys = Object.keys(this.topics);
            const randomTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
            const words = this.topics[randomTopic];
            const randomWord = words[Math.floor(Math.random() * words.length)];

            this.state.topic = randomTopic;
            this.state.secretWord = randomWord;
            this.state.wordList = words;

            this.addLog(`YENİ TUR BAŞLADI! Konu: ${randomTopic}`);
            this.addLog(`İlk konuşmacı: ${players[speakerIdx].name}`);
            this.addLog('Herkes rolünü ve kelimeyi kontrol etsin.');

            this.broadcastState();
        } catch (error) {
            console.error('[Chameleon] Error in startNewRound:', error);
        }
    }

    handleAction(socket, action) {
        try {
            const player = this.room.players.find(p => p.id === socket.id);
            if (!player) return;

            console.log(`[Chameleon] Action ${action.type} from ${player.name}`);

            switch (action.type) {
                case 'START_ROUND':
                    if (player.isHost && this.state.phase === 'ROLE_REVEAL') {
                        this.startDiscussion();
                    }
                    break;

                case 'VOTE':
                    if (this.state.phase === 'VOTING') {
                        this.handleVote(socket.id, action.targetId);
                    }
                    break;

                case 'GUESS_WORD':
                    if (this.state.phase === 'CHAMELEON_GUESS' && socket.id === this.state.chameleonId) {
                        this.handleChameleonGuess(action.word);
                    }
                    break;
            }
        } catch (error) {
            console.error('[Chameleon] Error in handleAction:', error);
        }
    }

    startDiscussion() {
        this.state.phase = 'DISCUSSION';
        this.state.logs = [];
        this.state.timer = 60;
        this.addLog('Tartışma başladı! Herkes sırayla kelimesini söylesin.');
        this.broadcastState();

        const interval = setInterval(() => {
            this.state.timer--;
            this.io.to(this.room.id).emit('timerUpdate', this.state.timer);

            if (this.state.timer <= 0) {
                clearInterval(interval);
                this.startVoting();
            }
        }, 1000);
    }

    startVoting() {
        this.state.phase = 'VOTING';
        this.state.logs = [];
        this.state.votes = {};
        this.addLog('Süre bitti! Şimdi Bukalemun olduğunu düşündüğünüz kişiyi oylayın.');
        this.broadcastState();
    }

    handleVote(voterId, targetId) {
        this.state.votes[voterId] = targetId;
        this.broadcastState();

        if (Object.keys(this.state.votes).length === this.room.players.length) {
            this.resolveVoting();
        }
    }

    resolveVoting() {
        const voteCounts = {};
        Object.values(this.state.votes).forEach(targetId => {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        });

        let maxVotes = 0;
        let mostVotedId = null;
        let isTie = false;

        Object.entries(voteCounts).forEach(([id, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = id;
                isTie = false;
            } else if (count === maxVotes) {
                isTie = true;
            }
        });

        const mostVotedPlayer = this.room.players.find(p => p.id === mostVotedId);

        if (isTie || !mostVotedPlayer) {
            this.addLog('Oylama berabere bitti! Bukalemun kaçtı.');
            this.endGame('CHAMELEON');
            return;
        }

        this.addLog(`${mostVotedPlayer.name} en çok oyu aldı.`);

        if (mostVotedId === this.state.chameleonId) {
            this.addLog('Tebrikler! Bukalemunu yakaladınız.');
            this.addLog('Ancak Bukalemun\'un hala bir şansı var: Gizli kelimeyi tahmin etmek.');
            this.state.phase = 'CHAMELEON_GUESS';
            this.broadcastState();
        } else {
            this.addLog(`Yanlış kişi! ${mostVotedPlayer.name} Bukalemun değildi.`);
            this.endGame('CHAMELEON');
        }
    }

    handleChameleonGuess(guessedWord) {
        try {
            console.log(`[Chameleon] Guess received: ${guessedWord}. Secret: ${this.state.secretWord}`);
            if (guessedWord === this.state.secretWord) {
                this.addLog(`Bukalemun doğru bildi! Gizli kelime: ${this.state.secretWord}`);
                this.endGame('CHAMELEON');
            } else {
                this.addLog(`Bukalemun bilemedi! Tahmini: ${guessedWord}. Doğru kelime: ${this.state.secretWord}`);
                this.endGame('CITIZENS');
            }
        } catch (error) {
            console.error('[Chameleon] Error in handleChameleonGuess:', error);
        }
    }

    endGame(winner) {
        try {
            console.log(`[Chameleon] Ending game. Winner: ${winner}`);
            this.state.phase = 'END';
            this.state.winner = winner;
            const winnerText = winner === 'CHAMELEON' ? 'BUKALEMUN' : 'VATANDAŞLAR';

            // Update Scores safely
            if (winner === 'CHAMELEON') {
                const currentScore = this.state.scores[this.state.chameleonId] || 0;
                this.state.scores[this.state.chameleonId] = currentScore + 2;
            } else {
                this.room.players.forEach(p => {
                    if (p.id !== this.state.chameleonId) {
                        const currentScore = this.state.scores[p.id] || 0;
                        this.state.scores[p.id] = currentScore + 1;
                    }
                });
            }

            this.addLog(`TUR BİTTİ! Kazanan: ${winnerText}`);
            this.addLog('5 saniye içinde yeni tur başlayacak...');
            this.broadcastState();

            // Auto-restart after 5 seconds
            setTimeout(() => {
                this.startNewRound();
            }, 5000);
        } catch (error) {
            console.error('[Chameleon] Error in endGame:', error);
        }
    }

    addLog(message) {
        this.state.logs.push({ message, timestamp: Date.now() });
    }

    broadcastState() {
        this.room.players.forEach(player => {
            const isChameleon = player.id === this.state.chameleonId;

            const playerState = {
                ...this.state,
                myRole: isChameleon ? 'CHAMELEON' : 'CITIZEN',
                secretWord: isChameleon ? '???' : this.state.secretWord,
                scores: this.state.scores,
                firstSpeakerId: this.state.firstSpeakerId
            };

            this.io.to(player.id).emit('gameState', playerState);
        });
    }
}

module.exports = ChameleonGame;
