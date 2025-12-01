class Taboo {
    constructor(room, io) {
        this.io = io;
        this.roomId = room.id;
        this.players = room.players;
        this.state = {
            phase: 'TEAM_SETUP',
            teams: { mavi: { players: [], score: 0, describerIndex: 0 }, kirmizi: { players: [], score: 0, describerIndex: 0 } },
            currentTeam: null,
            currentDescriber: null,
            currentCard: null,
            timeRemaining: 60,
            passesRemaining: 3,
            roundScore: 0,
            usedCards: [],
            logs: []
        };
        this.cards = this.createCards();
        this.timer = null;
        this.initGame();
    }

    createCards() {
        // 100 Taboo cards - will expand to 200
        return [
            { w: 'UÇAK', f: ['MOTOR', 'YAKIT', 'YOLCULUK', 'HAVALİMANI', 'KANAT'] }, { w: 'DENİZ', f: ['SU', 'YEŞİL', 'GEMİ', 'KÜREK', 'DALGALAR'] }, { w: 'TAŞ', f: ['SERT', 'DEMİR', 'SU', 'GRİ', 'KAYA'] }, { w: 'SANDALYE', f: ['OTURMA', 'TAHTA', 'YASLANMAK', 'AYAK', 'MOBİLYA'] }, { w: 'İNSAN', f: ['CANLI', 'YEMEK', 'İÇMEK', 'UYUMAK', 'KİŞİ'] },
            { w: 'UYUMAK', f: ['YATAK', 'YASTIK', 'DALMAK', 'YORGAN', 'DİNLENMEK'] }, { w: 'SAAT', f: ['DAKİKA', 'SANİYE', 'BAKMAK', 'ZAMAN', 'KOL'] }, { w: 'KULAK', f: ['DUYMAK', 'VÜCUT', 'KAFA', 'YÜZ', 'ORGAN'] }, { w: 'ÇİÇEK', f: ['KOKMAK', 'CANLI', 'TOPRAK', 'PAPATYA', 'GÜL'] }, { w: 'SINAV', f: ['DERS', 'NOT', 'PUAN', 'ÇALIŞMAK', 'TEST'] },
            { w: 'TAVŞAN', f: ['ZIPLAMAK', 'HAVUÇ', 'YEMEK', 'SEBZE', 'HAYVAN'] }, { w: 'ARABA', f: ['BENZİN', 'GİTMEK', 'SÜRMEK', 'DİREKSİYON', 'ARAÇ'] }, { w: 'KULAKLIK', f: ['SES', 'KULAK', 'TAKMAK', 'DİNLEMEK', 'MÜZİK'] }, { w: 'OYUN', f: ['EĞLENMEK', 'DIŞARI', 'EV', 'KOVALAMAK', 'OYNAMAK'] }, { w: 'HAYVAN', f: ['CANLI', 'BOYNUZ', 'SES', 'SALDIRMA', 'HAYVANAT'] },
            { w: 'PEÇETE', f: ['KAĞIT', 'BEYAZ', 'SİLMEK', 'KOPARTMAK', 'MENDIL'] }, { w: 'TELEVİZYON', f: ['İZLEMEK', 'KUMANDA', 'ANTEN', 'DİZİ', 'TV'] }, { w: 'FİİL', f: ['İŞ', 'OLUŞ', 'HAREKET', 'EYLEM', 'SÖZCÜK'] }, { w: 'KÜSMEK', f: ['DARILMAK', 'KIZMAK', 'KONUŞMAK', 'TARTIŞMAK', 'KAVGA'] }, { w: 'AVİZE', f: ['LAMBA', 'KRİSTAL', 'TAVAN', 'IŞIK', 'AYDINLIK'] },
            { w: 'SATRANÇ', f: ['ŞAH-MAT', 'KALE', 'VEZİR', 'PİYON', 'FİL'] }, { w: 'PARAŞÜT', f: ['UÇAK', 'ATLAMAK', 'UÇMAK', 'BALON', 'HAVA'] }, { w: 'TİYATRO', f: ['OYUNCU', 'SAHNE', 'PERDE', 'OYUN', 'SUFLÖR'] }, { w: 'DOST', f: ['GÜVEN', 'SAMİMİ', 'DÜRÜST', 'ARKADAŞ', 'AHAKLI'] }, { w: 'ANAHTAR', f: ['KİLİT', 'METAL', 'KASA', 'KAPI', 'ÇİLİNGİR'] },
            { w: 'KEDİ', f: ['PATİ', 'FARE', 'TÜY', 'KUYRUK', 'HAYVAN'] }, { w: 'KÖPEK', f: ['EVCİL', 'HAVLAMA', 'KUYRUK', 'SADIK', 'TASMA'] }, { w: 'PASTA', f: ['TATLI', 'DOĞUM', 'KREMA', 'DİLİM', 'ŞEKERLİ'] }, { w: 'GÜNEŞ', f: ['YILDIZ', 'GÜN', 'GÖKYÜZÜ', 'ISI', 'SARI'] }, { w: 'KİTAP', f: ['OKUMA', 'HİKAYE', 'SAYFA', 'YAZAR', 'KÜTÜPHANE'] },
            { w: 'TELEFON', f: ['GÖRÜŞME', 'MOBİL', 'MESAJ', 'ARAMA', 'SES'] }, { w: 'MASA', f: ['OTURMAK', 'TAHTA', 'AYAK', 'YEMEK', 'ÇALIŞMAK'] }, { w: 'KALEM', f: ['YAZMAK', 'MÜREKKEP', 'KAĞIT', 'TÜKENMEZ', 'OKUL'] }, { w: 'BARDAK', f: ['SU', 'İÇMEK', 'CAM', 'KIRMAK', 'FİNCAN'] }, { w: 'AYNA', f: ['YANSIMA', 'BAKMAK', 'CAM', 'GÖRÜNTÜ', 'SALON'] },
            { w: 'FUTBOL', f: ['TOP', 'GOL', 'SPOR', 'TAKIM', 'OYNAMAK'] }, { w: 'BASKETBOL', f: ['POTAYA', 'TOP', 'ATMAK', 'NBA', 'TAKIM'] }, { w: 'VOLEYBOL', f: ['FİLE', 'ATMAK', 'TOP', 'TAKIM', 'SMAÇ'] }, { w: 'YÜZ', f: ['BAKMAK', 'GÖZ', 'BURUN', 'AĞIZ', 'KAFA'] }, { w: 'EL', f: ['PARMAK', 'TUTMAK', 'KOL', 'AVUÇ', 'TIRNAK'] },
            { w: 'AYAK', f: ['YÜRÜMEK', 'PARMAK', 'BACAK', 'TOPUK', 'AYAKKABI'] }, { w: 'GÖZ', f: ['GÖRMEK', 'BAKMAK', 'KİRPİK', 'YÜZ', 'GÖZLÜK'] }, { w: 'BURUN', f: ['KOKLAMAK', 'YÜZ', 'NEFES', 'HAVA', 'ORGAN'] }, { w: 'AĞIZ', f: ['KONUŞMAK', 'DİŞ', 'DİL', 'YÜZ', 'YEMEK'] }, { w: 'SAÇ', f: ['KAFA', 'UZUN', 'KESMEK', 'TARAK', 'KUAFÖR'] },
            { w: 'ELMA', f: ['MEYVE', 'KIRMIZI', 'YEŞİL', 'AĞAÇ', 'SUYUs'] }, { w: 'ARMUT', f: ['MEYVE', 'YEŞİL', 'AĞAÇ', 'TATLI', 'YUMUŞAK'] }, { w: 'ÜZÜM', f: ['MEYVE', 'BAĞ', 'ŞARAP', 'İÇMEK', 'ASMA'] }, { w: 'PORTAKAL', f: ['MEYVE', 'TURUNCU', 'C', 'VİTAMİN', 'SOYMA'] }, { w: 'DOMATES', f: ['SEBZE', 'KIRMIZI', 'SALATA', 'SU', 'SALÇA'] },
            { w: 'PATATES', f: ['SEBZE', 'TOPRAK', 'KIZARTMA', 'PİŞİRMEK', 'SOYMA'] }, { w: 'SOĞAN', f: ['SEBZE', 'ACI', 'GÖZYAŞI', 'DOĞRAMA', 'YEMEK'] }, { w: 'HAVUÇ', f: ['SEBZE', 'TURUNCU', 'TAVŞAN', 'SALATA', 'C'] }, { w: 'DÜNYA', f: ['GEZEGEN', 'DÖNMEK', 'AY', 'GÜNEŞ', 'YAŞAM'] }, { w: 'AY', f: ['GÖKYÜZÜ', 'DOLUNAY', 'GECE', 'YILDIZ', 'DÜNYA'] },
            { w: 'YILDIZ', f: ['GÖKYÜZÜ', 'PARLAK', 'GECE', 'IŞIK', 'UZAY'] }, { w: 'UZAY', f: ['YILDIZ', 'GEZEGEN', 'BOŞLUK', 'ASTRONOT', 'ROKET'] }, { w: 'ROKET', f: ['UÇMAK', 'UZAY', 'ATEŞ', 'HIZLI', 'FIRLAT'] }, { w: 'GEMİ', f: ['DENİZ', 'YÜZMEK', 'KAPTAN', 'YELKEN', 'SU'] }, { w: 'TREN', f: ['RAY', 'YOLCU', 'HIZLI', 'İSTASYON', 'VAGON'] },
            { w: 'OTOBÜS', f: ['YOLCU', 'ŞOFÖR', 'DURAK', 'KART', 'TAŞIMA'] }, { w: 'BİSİKLET', f: ['PEDAL', 'TEKERLEK', 'GİDON', 'SÜRMEK', 'SPOR'] }, { w: 'MOTOR', f: ['SÜRMEK', 'KASK', 'HIZLI', 'TEKERLEK', 'RİSK'] }, { w: 'BAL', f: ['TATLI', 'ARI', 'SARŞ', 'PETEK', 'KOVAN'] }, { w: 'SÜT', f: ['İNEK', 'İÇMEK', 'BEYAZ', 'KALSIYUM', 'BARDAK'] },
            { w: 'SU', f: ['İÇMEK', 'HAYAT', 'İHTİYAÇ', 'BARDAK', 'ŞIŞE'] }, { w: 'EKMEK', f: ['YEMEK', 'FIRIN', 'UN', 'FIRINCI', 'DİLİM'] }, { w: 'PEYNİR', f: ['YEMEK', 'BEYAZ', 'SÜT', 'KAHVALTI', 'TUZ'] }, { w: 'YUMURTA', f: ['TAVUK', 'SARI', 'BEYAZ', 'PİŞİRMEK', 'KAHVALTI'] }, { w: 'ET', f: ['YEMEK', 'KIRMIZI', 'HAYVAN', 'PİŞİRMEK', 'PROTEIN'] },
            { w: 'TAKIM', f: ['GRUP', 'OYUNCU', 'BERABER', 'SPOR', 'KAZANMAK'] }, { w: 'OKUL', f: ['ÖĞRETMEN', 'ÖĞREN', 'SINIF', 'DERS', 'ÇOCUK'] }, { w: 'ÖĞRETMEN', f: ['OKUL', 'DERS', 'ANLATMAK', 'SINIF', 'ÖĞRENCI'] }, { w: 'ÖĞRENCI', f: ['OKUL', 'ÖĞRENMEK', 'SINIF', 'DERS', 'ÇALIŞMAK'] }, { w: 'DOKTOR', f: ['HASTANE', 'TEDAV', 'HASTA', 'İLAÇ', 'BEYAZ'] },
            { w: 'HASTA', f: ['HASTALIK', 'DOKTOR', 'YATMAK', 'İLAÇ', 'AĞRI'] }, { w: 'İLAÇ', f: ['HASTA', 'DOKTOR', 'ECZANE', 'KUTU', 'ŞİFA'] }, { w: 'HASTANE', f: ['HASTA', 'DOKTOR', 'TEDAV', 'YATAK', 'BEYAZ'] }, { w: 'ECZANE', f: ['İLAÇ', 'SAĞLIK', 'YEŞİL', 'ECZACI', 'REÇETE'] }, { w: 'POLİS', f: ['KANUN', 'SUÇLU', 'YAKALAMAK', 'ÜNİFORMA', 'MAVİ'] },
            { w: 'ASKER', f: ['VATAN', 'SİLAH', 'ÜNİFORMA', 'SAVAŞ', 'KORUMAK'] }, { w: 'İTFAİYE', f: ['YANGIN', 'SÖNDÜRMEK', 'SU', 'KIRMIZI', 'ARAÇ'] }, { w: 'YANGIN', f: ['ATEŞ', 'SÖNDÜRMEK', 'DUMAN', 'SICAK', 'İTFAİYE'] }, { w: 'YAĞMUR', f: ['SU', 'GÖKYÜZÜ', 'ISLAK', 'ŞEMSİYE', 'DAMLA'] }, { w: 'KAR', f: ['BEYAZ', 'KIŞ', 'SOĞUK', 'YAĞMAK', 'KARTOPU'] },
            { w: 'SONBAHAR', f: ['MEVSİM', 'YAPRAK', 'DÜŞMEK', 'SARI', 'GÜZ'] }, { w: 'KIŞ', f: ['MEVSİM', 'SOĞUK', 'KAR', 'OCAK', 'BEYAZ'] }, { w: 'İLKBAHAR', f: ['MEVSİM', 'ÇİÇEK', 'YEŞİL', 'NISAN', 'MART'] }, { w: 'YAZ', f: ['MEVSİM', 'SICAK', 'GÜNEŞ', 'DENİZ', 'TATİL'] }, { w: 'RENK', f: ['SARI', 'KIRMIZI', 'MAVİ', 'YEŞİL', 'GÖZ'] },
            { w: 'SARI', f: ['RENK', 'GÜNEŞ', 'LİMON', 'ALTIN', 'PARLAK'] }, { w: 'KIRMIZI', f: ['RENK', 'KAN', 'ATEŞ', 'GÜL', 'BAYRAK'] }, { w: 'MAVİ', f: ['RENK', 'GÖKYÜZÜ', 'DENİZ', 'SOĞUK', 'GÜNEŞ'] }, { w: 'YEŞİL', f: ['RENK', 'AĞAÇ', 'DOĞA', 'ÇİMENGÖZ', 'UMUT'] }, { w: 'SİYAH', f: ['RENK', 'GECE', 'KARANLIK', 'KÖMÜR', 'SIYAK'] }
        ];
    }

    initGame() {
        this.broadcastState();
    }

    handleAction(socket, action) {
        const pid = socket.id;
        if (action.type === 'ASSIGN_TEAM') {
            this.assignPlayerToTeam(pid, action.team);
        } else if (action.type === 'START_GAME' && this.validateTeams()) {
            this.startGame();
        } else if (action.type === 'BILDI') {
            this.handleBildi();
        } else if (action.type === 'PAS') {
            this.handlePas();
        } else if (action.type === 'HATALI') {
            this.handleHatali();
        } else if (action.type === 'NEXT_ROUND') {
            this.selectDescriber();
            setTimeout(() => this.startRound(), 3000);
        }
    }

    assignPlayerToTeam(playerId, team) {
        Object.values(this.state.teams).forEach(t => {
            t.players = t.players.filter(p => p !== playerId);
        });
        if (team && this.state.teams[team]) {
            this.state.teams[team].players.push(playerId);
        }
        this.broadcastState();
    }

    validateTeams() {
        return this.state.teams.mavi.players.length >= 2 && this.state.teams.kirmizi.players.length >= 2;
    }

    startGame() {
        this.state.phase = 'ROUND_START';
        this.state.currentTeam = 'mavi';
        this.selectDescriber();
        this.broadcastState();
        setTimeout(() => this.startRound(), 3000);
    }

    selectDescriber() {
        const team = this.state.teams[this.state.currentTeam];
        this.state.currentDescriber = team.players[team.describerIndex];
        team.describerIndex = (team.describerIndex + 1) % team.players.length;
    }

    startRound() {
        this.state.phase = 'PLAYING';
        this.state.timeRemaining = 60;
        this.state.passesRemaining = 3;
        this.state.roundScore = 0;
        this.pickCard();
        this.broadcastState();
        this.startTimer();
    }

    pickCard() {
        const available = this.cards.filter(c => !this.state.usedCards.includes(c));
        if (available.length === 0) return;
        const card = available[Math.floor(Math.random() * available.length)];
        this.state.usedCards.push(card);
        this.state.currentCard = card;
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.state.timeRemaining--;
            if (this.state.timeRemaining <= 0) {
                clearInterval(this.timer);
                this.endRound();
            }
            this.broadcastState();
        }, 1000);
    }

    handleBildi() {
        this.state.roundScore++;
        this.pickCard();
        this.broadcastState();
    }

    handlePas() {
        if (this.state.passesRemaining > 0) {
            this.state.passesRemaining--;
            this.pickCard();
            this.broadcastState();
        }
    }

    handleHatali() {
        this.state.roundScore--;
        this.pickCard();
        this.broadcastState();
    }

    endRound() {
        clearInterval(this.timer);
        this.state.phase = 'ROUND_END';
        this.state.teams[this.state.currentTeam].score += this.state.roundScore;

        if (this.state.teams.mavi.score >= 10 || this.state.teams.kirmizi.score >= 10) {
            this.state.phase = 'GAME_END';
        } else {
            this.state.currentTeam = this.state.currentTeam === 'mavi' ? 'kirmizi' : 'mavi';
        }
        this.broadcastState();
    }

    sendStateTo(playerId) {
        this.io.to(playerId).emit('gameState', this.state);
    }

    broadcastState() {
        this.players.forEach(p => this.sendStateTo(p.id));
    }

    updatePlayerId(oldId, newId) {
        Object.values(this.state.teams).forEach(team => {
            const idx = team.players.indexOf(oldId);
            if (idx >= 0) team.players[idx] = newId;
        });
        if (this.state.currentDescriber === oldId) {
            this.state.currentDescriber = newId;
        }
        this.broadcastState();
    }
}

module.exports = Taboo;
