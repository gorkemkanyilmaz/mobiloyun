class VampirKoylu {
    constructor(io, roomId, players) {
        this.io = io;
        this.roomId = roomId;
        this.players = players;
        this.state = {
            phase: 'ROLE_REVEAL', // ROLE_REVEAL, DAY, VOTING, NIGHT, END
            dayCount: 1,
            timer: 0,
            roles: {}, // playerId -> KOYLU, VAMPIR, DOKTOR
            alive: {}, // playerId -> boolean
            readyPlayers: [], // List of playerIds who clicked Ready (for Role Reveal)
            nightReadyPlayers: [], // List of playerIds who clicked Ready (for Night - Villagers)
            votes: {}, // playerId -> targetId (for lynch)
            nightActions: {}, // playerId -> targetId
            doctorLastSaved: null, // targetId
            logs: []
        };

        this.ROLES = {
            VAMPIR: 'VAMPIR',
            KOYLU: 'KOYLU',
            DOKTOR: 'DOKTOR'
        };

        this.timerInterval = null;
        this.initGame();
    }

    initGame() {
        // Role Distribution
        // Formula: Doctor=1, Vampires = floor(N/3), Rest = Villagers
        // 4 players: 1 V, 1 D, 2 K
        // 6 players: 2 V, 1 D, 3 K

        const count = this.players.length;
        let vampireCount = Math.floor(count / 3);
        if (vampireCount < 1) vampireCount = 1; // Minimum 1 vampire

        const doctorCount = 1;

        const shuffledPlayers = [...this.players].sort(() => 0.5 - Math.random());

        shuffledPlayers.forEach((p, i) => {
            this.state.alive[p.id] = true;
            if (i < vampireCount) {
                this.state.roles[p.id] = this.ROLES.VAMPIR;
            } else if (i < vampireCount + doctorCount) {
                this.state.roles[p.id] = this.ROLES.DOKTOR;
            } else {
                this.state.roles[p.id] = this.ROLES.KOYLU;
            }
        });

        this.broadcastState();
        this.log('Roller dağıtıldı. Herkes rolünü kontrol edip "Hazırım" desin.');
    }

    handleAction(socket, action) {
        const pid = socket.id;
        if (!this.state.alive[pid] && action.type !== 'READY') return;

        if (this.state.phase === 'ROLE_REVEAL') {
            if (action.type === 'READY') {
                if (!this.state.readyPlayers.includes(pid)) {
                    this.state.readyPlayers.push(pid);
                    this.broadcastState();

                    if (this.state.readyPlayers.length === this.players.length) {
                        this.startDayPhase();
                    }
                }
            }
        } else if (this.state.phase === 'DAY') {
            // Chat is handled by socket.io rooms
        } else if (this.state.phase === 'VOTING') {
            if (action.type === 'VOTE') {
                this.state.votes[pid] = action.targetId;
                this.broadcastState();

                // Check if everyone voted
                const aliveCount = Object.values(this.state.alive).filter(a => a).length;
                if (Object.keys(this.state.votes).length === aliveCount) {
                    this.resolveDayVoting();
                }
            }
        } else if (this.state.phase === 'NIGHT') {
            if (action.type === 'NIGHT_ACTION') {
                const role = this.state.roles[pid];

                // Doctor constraint
                if (role === this.ROLES.DOKTOR && action.targetId === this.state.doctorLastSaved) {
                    this.io.to(pid).emit('gameLog', { message: 'Bir önceki tur kurtardığın kişiyi tekrar kurtaramazsın!' });
                    return;
                }

                this.state.nightActions[pid] = action.targetId;

                // If Vampire, broadcast to other vampires
                if (role === this.ROLES.VAMPIR) {
                    this.broadcastVampireActions();
                } else {
                    this.sendStateTo(pid);
                }

                this.checkNightResolution();
            } else if (action.type === 'NIGHT_READY') {
                // For Villagers (or anyone else who just needs to wait)
                if (!this.state.nightReadyPlayers.includes(pid)) {
                    this.state.nightReadyPlayers.push(pid);
                    this.sendStateTo(pid);
                    this.checkNightResolution();
                }
            }
        }
    }

    startDayPhase(diedPlayerName = null) {
        this.state.phase = 'DAY';
        this.state.votes = {};
        this.state.nightActions = {};
        this.state.nightReadyPlayers = [];
        this.state.logs = []; // Strict log clearing

        const duration = this.state.dayCount === 1 ? 60 : 120;
        this.state.timer = duration;

        this.broadcastState();

        if (this.state.dayCount === 1) {
            this.log('Roller dağıtıldı. Tartışma başlasın..');
        } else {
            if (diedPlayerName) {
                this.log(`Gece büyük bir katliam oldu ve ${diedPlayerName} öldürüldü!`);
            } else {
                this.log('Gece kimse ölmedi.');
            }
            this.log(`${this.state.dayCount}. Gün başladı. Konuşma süresi: ${duration} saniye.`);
        }

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.state.timer--;
            if (this.state.timer <= 0) {
                clearInterval(this.timerInterval);
                if (this.state.dayCount === 1) {
                    this.startNightPhase();
                } else {
                    this.startVotingPhase();
                }
            } else {
                if (this.state.timer % 5 === 0 || this.state.timer <= 10) {
                    this.io.to(this.roomId).emit('timerUpdate', this.state.timer);
                }
            }
        }, 1000);
    }

    startVotingPhase() {
        this.state.phase = 'VOTING';
        this.state.timer = 0;
        this.state.logs = []; // Strict log clearing
        this.broadcastState();
        this.log('Konuşma süresi bitti! Şimdi oylama zamanı. Şüphelendiğiniz kişiyi seçin.');
    }

    resolveDayVoting() {
        const votes = {};
        Object.values(this.state.votes).forEach(target => {
            votes[target] = (votes[target] || 0) + 1;
        });

        let maxVotes = 0;
        let victimId = null;

        Object.entries(votes).forEach(([target, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                victimId = target;
            } else if (count === maxVotes) {
                victimId = null; // Tie
            }
        });

        let resultMsg = '';
        if (victimId) {
            this.state.alive[victimId] = false;
            const victimName = this.getPlayerName(victimId);
            resultMsg = `${victimName} köy halkı tarafından asıldı!`;
            this.checkWinCondition();
            if (this.state.phase === 'END') {
                this.state.logs = [];
                this.log(resultMsg);
                return;
            }
        } else {
            resultMsg = 'Oylar eşit çıktı, kimse asılmadı.';
        }

        this.startNightPhase(resultMsg);
    }

    startNightPhase(prevResultMsg = null) {
        this.state.phase = 'NIGHT';
        this.state.votes = {};
        this.state.nightReadyPlayers = [];
        this.state.logs = []; // Strict log clearing

        this.broadcastState();

        // Show voting result first if exists
        if (prevResultMsg) {
            this.log(prevResultMsg);
        }
        this.log('Gece oldu. Herkes uyusun...');
    }

    checkNightResolution() {
        const alivePlayers = this.players.filter(p => this.state.alive[p.id]);

        const vampires = alivePlayers.filter(p => this.state.roles[p.id] === this.ROLES.VAMPIR);
        const doctors = alivePlayers.filter(p => this.state.roles[p.id] === this.ROLES.DOKTOR);
        const villagers = alivePlayers.filter(p => this.state.roles[p.id] === this.ROLES.KOYLU);

        const vampiresActed = vampires.every(p => this.state.nightActions[p.id]);
        const doctorsActed = doctors.every(p => this.state.nightActions[p.id]);
        const villagersReady = villagers.every(p => this.state.nightReadyPlayers.includes(p.id));

        if (vampiresActed && doctorsActed && villagersReady) {
            this.resolveNight();
        }
    }

    resolveNight() {
        // Calculate Vampire Kill
        const vampireVotes = {};
        Object.entries(this.state.nightActions).forEach(([pid, target]) => {
            if (this.state.roles[pid] === this.ROLES.VAMPIR) {
                vampireVotes[target] = (vampireVotes[target] || 0) + 1;
            }
        });

        let killTarget = null;
        let maxVotes = 0;
        Object.entries(vampireVotes).forEach(([target, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                killTarget = target;
            }
        });

        // Doctor Save
        const doctorId = this.players.find(p => this.state.roles[p.id] === this.ROLES.DOKTOR && this.state.alive[p.id])?.id;
        const savedTarget = doctorId ? this.state.nightActions[doctorId] : null;

        if (doctorId) {
            this.state.doctorLastSaved = savedTarget;
        }

        let diedPlayerName = null;
        if (killTarget && killTarget !== savedTarget) {
            this.state.alive[killTarget] = false;
            diedPlayerName = this.getPlayerName(killTarget);
        }

        this.state.dayCount++;
        this.checkWinCondition();

        if (this.state.phase !== 'END') {
            this.startDayPhase(diedPlayerName);
        }
    }

    checkWinCondition() {
        const aliveVampires = this.players.filter(p => this.state.alive[p.id] && this.state.roles[p.id] === this.ROLES.VAMPIR).length;
        const aliveVillagers = this.players.filter(p => this.state.alive[p.id] && this.state.roles[p.id] !== this.ROLES.VAMPIR).length;

        if (aliveVampires === 0) {
            this.endGame('VILLAGERS');
        } else if (aliveVampires >= aliveVillagers) {
            this.endGame('VAMPIRES');
        }
    }

    endGame(winner) {
        this.state.phase = 'END';
        this.state.logs = [];
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.log(`Oyun Bitti! Kazanan: ${winner === 'VILLAGERS' ? 'KÖYLÜLER' : 'VAMPİRLER'}`);
        this.broadcastState();
    }

    log(msg) {
        this.state.logs.push({ message: msg });
        this.io.to(this.roomId).emit('gameLog', { message: msg });
    }

    getPlayerName(id) {
        return this.players.find(p => p.id === id)?.name || 'Bilinmeyen';
    }

    sendStateTo(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        const playerState = {
            ...this.state,
            myRole: this.state.roles[player.id],
            roles: undefined, // Hide all roles
            timerInterval: undefined
        };
        this.io.to(player.id).emit('gameState', playerState);
    }

    broadcastState() {
        this.players.forEach(player => this.sendStateTo(player.id));
    }

    broadcastVampireActions() {
        this.players.forEach(player => {
            if (this.state.roles[player.id] === this.ROLES.VAMPIR) {
                this.sendStateTo(player.id);
            }
        });
    }
}

module.exports = VampirKoylu;
