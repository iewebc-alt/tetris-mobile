const WIDTH = 80;
const HEIGHT = 25;
const GAME_COLS = 10;
const GAME_ROWS = 20;

const SHAPES = {
    'I': [[1, 1, 1, 1]],
    'J': [[1, 1, 1], [0, 0, 1]],
    'L': [[1, 1, 1], [1, 0, 0]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0]],
    'T': [[1, 1, 1], [0, 1, 0]],
    'Z': [[1, 1, 0], [0, 1, 1]]
};

const PIECE_MAP = {
    'I': ' [][][]',
    'J': '[]  [] ',
    'L': '  [][] ',
    'O': ' [][]  ',
    'S': '  [][] ',
    'T': ' [][][]',
    'Z': '[][]   '
};

class TerminalTetris {
    constructor() {
        this.board = Array(GAME_ROWS).fill().map(() => Array(GAME_COLS).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 0;
        this.highScore = parseInt(localStorage.getItem('tetris_high_score')) || 0;
        this.playerName = localStorage.getItem('tetris_player_name') || "";
        this.state = 'START';
        this.leaderboardData = null;
        this.inputBuffer = "";
        this.currentPiece = null;
        this.nextPiece = null;
        this.showNext = true;
        this.showInstructions = true;
        this.clearingLineIndices = [];
        this.stats = { 'I': 0, 'J': 0, 'L': 0, 'O': 0, 'S': 0, 'T': 0, 'Z': 0 };
        this.terminal = document.getElementById('terminal');
        this.buffer = Array(HEIGHT).fill().map(() => Array(WIDTH).fill(' '));
        this.dropTimer = null;

        this.init();
    }

    init() {
        this.nextPiece = this.randomPiece();
        this.render();
        document.addEventListener('keydown', (e) => this.handleInput(e));
        this.bindTouchControls();
        this.resetTimer();
        this.render();

        const hiddenInput = document.getElementById('name-input');
        if (hiddenInput) {
            hiddenInput.addEventListener('input', (e) => {
                if (this.state === 'INPUT_NAME') {
                    this.inputBuffer = e.target.value.toUpperCase().slice(0, 12);
                    this.render();
                    this.centerBoardOnMobile();
                }
            });
            hiddenInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleInput({ key: 'Enter' });
                }
            });
        }
        this.centerBoardOnMobile();
        window.addEventListener('resize', () => {
            this.centerBoardOnMobile();
            // Повторный вызов для надежности при смене ориентации или открытии клавиатуры
            setTimeout(() => this.centerBoardOnMobile(), 500);
        });
        this.resetTimer();
    }

    centerBoardOnMobile() {
        if (window.innerWidth < 800) {
            const container = document.querySelector('.screen-container');
            const terminal = document.getElementById('terminal');
            if (container && terminal) {
                // Approximate center for the game board
                // Total width is 80 chars. Board is at ox=26, width is around 22 chars (<! + 10*2 + !>)
                // Centering around column 37
                const charWidth = terminal.scrollWidth / 80;
                const scrollPos = (charWidth * 37) - (window.innerWidth / 2);
                container.scrollLeft = Math.max(0, scrollPos);
            }
        }
    }

    bindTouchControls() {
        const controls = {
            'btn-left': 'L',
            'btn-right': 'R',
            'btn-rot': 'ROT',
            'btn-soft': 'SOFT',
            'btn-hard': 'HARD',
            'btn-start': 'START'
        };

        Object.entries(controls).forEach(([id, act]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            
            const handler = (e) => {
                e.preventDefault();
                if (act === 'START') {
                    if (this.state === 'START') {
                        this.level = 0;
                        this.spawnPiece();
                        this.state = 'PLAYING';
                    } else {
                        // In other states, START button acts as Enter for convenience
                        this.handleInput({ key: 'Enter' });
                    }
                } else if (this.state === 'PLAYING') {
                    this.executeAction(act);
                }
                this.render();
            };

            btn.addEventListener('touchstart', handler, { passive: false });
            btn.addEventListener('click', handler);
        });
    }

    resetTimer() {
        if (this.dropTimer) clearInterval(this.dropTimer);
        const speed = Math.max(100, 800 - (this.level * 70));
        this.dropTimer = setInterval(() => {
            if (this.state === 'PLAYING' && this.clearingLineIndices.length === 0) this.drop();
            this.render();
        }, speed);
    }

    randomPiece() {
        const keys = Object.keys(SHAPES);
        const type = keys[Math.floor(Math.random() * keys.length)];
        return { type, shape: SHAPES[type], x: Math.floor(GAME_COLS / 2) - Math.floor(SHAPES[type][0].length / 2), y: 0 };
    }

    handleInput(e) {
        if (this.state === 'START') {
            if (e.key >= '0' && e.key <= '9') {
                this.level = parseInt(e.key);
                this.spawnPiece();
                this.state = 'PLAYING';
            }
            return;
        }
        if (this.state === 'INPUT_NAME') {
            const hiddenInput = document.getElementById('name-input');
            if (e.key === 'Enter' && this.inputBuffer.trim().length > 0) {
                this.playerName = this.inputBuffer.trim();
                localStorage.setItem('tetris_player_name', this.playerName);
                if (hiddenInput) hiddenInput.blur();
                this.submitScore();
            } else if (e.key === 'Backspace') {
                this.inputBuffer = this.inputBuffer.slice(0, -1);
                if (hiddenInput) hiddenInput.value = this.inputBuffer;
            } else if (e.key.length === 1 && this.inputBuffer.length < 12) {
                this.inputBuffer += e.key.toUpperCase();
                if (hiddenInput) hiddenInput.value = this.inputBuffer;
            }
            this.render();
            this.centerBoardOnMobile();
            return;
        }

        if (this.state === 'LEADERBOARD') {
            if (e.key === 'Enter' || e.key === ' ') location.reload();
            return;
        }

        if (this.state === 'GAMEOVER') {
            if (e.key === 'Enter') {
                if (this.playerName) {
                    this.submitScore();
                } else {
                    this.state = 'INPUT_NAME';
                    this.inputBuffer = "";
                    const hiddenInput = document.getElementById('name-input');
                    if (hiddenInput) {
                        hiddenInput.value = "";
                        // Используем preventScroll, чтобы избежать резкого скачка экрана
                        hiddenInput.focus({ preventScroll: true });
                        // Дополнительное центрирование через небольшую задержку (для учета анимации клавиатуры)
                        setTimeout(() => this.centerBoardOnMobile(), 300);
                    }
                }
            }
            this.render();
            return;
        }

        if (this.clearingLineIndices.length > 0) return;

        const keyMap = {
            '7': 'L', 'j': 'L', 'ArrowLeft': 'L',
            '9': 'R', 'l': 'R', 'ArrowRight': 'R',
            '8': 'ROT', 'k': 'ROT', 'ArrowUp': 'ROT',
            '5': 'HARD', ' ': 'HARD',
            '4': 'SOFT', 'ArrowDown': 'SOFT',
            '1': 'TOGGLE_NEXT',
            '0': 'TOGGLE_INST'
        };

        const act = keyMap[e.key] || keyMap[e.key.toLowerCase()];
        if (!act) return;

        this.executeAction(act);
        this.render();
    }

    executeAction(act) {
        if (this.clearingLineIndices.length > 0) return;

        if (act === 'L') this.move(-1, 0);
        if (act === 'R') this.move(1, 0);
        if (act === 'ROT') this.rotate();
        if (act === 'SOFT') this.drop();
        if (act === 'HARD') this.hardDrop();
        if (act === 'TOGGLE_NEXT') this.showNext = !this.showNext;
        if (act === 'TOGGLE_INST') this.showInstructions = !this.showInstructions;
    }

    move(dx, dy) {
        this.currentPiece.x += dx; this.currentPiece.y += dy;
        if (this.checkCollision()) { this.currentPiece.x -= dx; this.currentPiece.y -= dy; return false; }
        return true;
    }

    rotate() {
        const s = this.currentPiece.shape;
        const rotated = s[0].map((_, i) => s.map(row => row[i]).reverse());
        const old = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        if (this.checkCollision()) this.currentPiece.shape = old;
    }

    drop() {
        if (!this.move(0, 1)) {
            this.lock();
            this.startClearAnimation();
        }
    }

    hardDrop() {
        while (this.move(0, 1)) { /* keep moving */ }
        this.lock();
        this.startClearAnimation();
    }

    checkCollision() {
        const p = this.currentPiece;
        for (let y = 0; y < p.shape.length; y++) {
            for (let x = 0; x < p.shape[0].length; x++) {
                if (p.shape[y][x]) {
                    const bx = p.x + x; const by = p.y + y;
                    if (bx < 0 || bx >= GAME_COLS || by >= GAME_ROWS || (by >= 0 && this.board[by][bx])) return true;
                }
            }
        }
        return false;
    }

    lock() {
        const p = this.currentPiece;
        p.shape.forEach((row, y) => {
            row.forEach((v, x) => { if (v && p.y + y >= 0) this.board[p.y + y][p.x + x] = 1; });
        });
    }

    startClearAnimation() {
        this.clearingLineIndices = [];
        for (let y = 0; y < GAME_ROWS; y++) {
            if (this.board[y].every(v => v)) this.clearingLineIndices.push(y);
        }

        if (this.clearingLineIndices.length > 0) {
            this.flickerCount = 0;
            this.flickerInterval = setInterval(() => {
                this.flickerCount++;
                if (this.flickerCount >= 6) {
                    clearInterval(this.flickerInterval);
                    this.clearLines();
                    this.clearingLineIndices = [];
                    if (this.state !== 'GAMEOVER') this.spawnPiece();
                }
                this.render();
            }, 80);
        } else {
            if (this.state !== 'GAMEOVER') this.spawnPiece();
        }
    }

    clearLines() {
        let cnt = 0;
        for (let y = GAME_ROWS - 1; y >= 0; y--) {
            if (this.board[y].every(v => v)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(GAME_COLS).fill(0));
                cnt++;
                y++;
            }
        }
        if (cnt) {
            this.lines += cnt;
            this.score += [0, 10, 30, 70, 150][cnt] * (this.level + 1);
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('tetris_high_score', this.highScore);
            }
            const newLevel = Math.floor(this.lines / 10);
            if (newLevel > this.level) {
                this.level = newLevel;
                this.resetTimer();
            }
        }
    }

    spawnPiece() {
        this.currentPiece = this.nextPiece;
        this.stats[this.currentPiece.type]++;
        this.nextPiece = this.randomPiece();
        if (this.checkCollision()) {
            this.state = 'GAMEOVER';
            if (this.dropTimer) clearInterval(this.dropTimer);
        }
    }

    async submitScore() {
        this.state = 'LOADING';
        this.render();
        try {
            const data = await window.Leaderboard.submitScore(this.playerName, String(this.score));
            if (data && data.top3 && data.group) {
                this.leaderboardData = data;
                this.state = 'LEADERBOARD';
            } else {
                console.error("Leaderboard Error:", data);
                this.state = 'GAMEOVER';
                const errorMsg = data && data.message ? `Ошибка: ${data.message}` : "Неизвестная ошибка сервера";
                const debugInfo = data && data.debug ? `\nОтладка: ${data.debug}` : "";
                alert(`${errorMsg}${debugInfo}\nПроверьте настройки App Script.`);
            }
        } catch (e) {
            console.error("Leaderboard Fetch Error:", e);
            this.state = 'GAMEOVER';
        }
        this.render();
    }

    write(text, x, y) {
        for (let i = 0; i < text.length; i++) {
            if (y >= 0 && y < HEIGHT && x + i >= 0 && x + i < WIDTH) this.buffer[y][x + i] = text[i];
        }
    }

    render() {
        this.buffer = Array(HEIGHT).fill().map(() => Array(WIDTH).fill(' '));
        this.write("9 6 0 0  0 0 0 0  0 0 1 0  0 0 0 0  0 0 0 0  0 0 0 0 39", 15, 0);

        if (this.state === 'START') {
            this.write("[ ]", 38, 5);
            this.write("Т Е Т Р И С", 34, 6);
            this.write("[ ]", 38, 7);
            this.write("ВАШ УРОВЕНЬ? (0-9) - _", 28, 15);
            this.write(`РЕКОРД: ${this.highScore}`, 33, 17);
        } else {
            this.write(`ПОЛНЫХ СТРОК: ${this.lines}`, 2, 2);
            this.write(`УРОВЕНЬ: ${this.level + 1}`, 2, 3);
            this.write(`СЧЕТ: ${this.score}`, 2, 4);
            this.write(`РЕКОРД: ${this.highScore}`, 2, 5);

            if (this.showNext) {
                this.write(".----------.", 2, 7);
                this.write("|СЛЕДУЮЩАЯ:|", 2, 8);
                if (this.nextPiece) {
                    this.nextPiece.shape.forEach((row, y) => {
                        row.forEach((v, x) => { if (v) this.write("[]", 4 + x * 2, 9 + y); });
                    });
                }
                this.write("'----------'", 2, 12);
            }

            const sy = 14;
            this.write(".----------.", 2, sy);
            this.write("|СТАТИСТИКА|", 2, sy + 1);
            this.write("|----------|", 2, sy + 2);
            let si = 0;
            const pieceTypes = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
            pieceTypes.forEach(type => {
                const y = sy + 3 + si;
                this.write(`|${PIECE_MAP[type]}${String(this.stats[type]).padStart(3, '0')}|`, 2, y);
                si++;
            });
            this.write("'----------'", 2, sy + 3 + si);

            if (this.showInstructions) {
                this.write("7:НАЛЕВО 9:НАПРАВО", 58, 4);
                this.write("    8:ПОВОРОТ", 58, 5);
                this.write("4:УСКОРИТЬ 5:СБРОСИТЬ", 58, 6);
                this.write("1:ПОКАЗАТЬ СЛЕДУЮЩУЮ", 58, 7);
                this.write("0:СТЕРЕТЬ ЭТОТ ТЕКСТ", 58, 8);
            }

            const ox = 26, oy = 2;
            for (let y = 0; y < GAME_ROWS; y++) {
                let left = "<!", right = "!>";
                this.write(left, ox, oy + y);

                const isClearing = this.clearingLineIndices.includes(y);
                const showEmpty = isClearing && (this.flickerCount % 2 === 0);

                for (let x = 0; x < GAME_COLS; x++) {
                    let char = " .";
                    if (isClearing) {
                        char = showEmpty ? "  " : "==";
                    } else {
                        if (this.board[y][x]) char = "[]";
                        if (this.currentPiece && this.state === 'PLAYING' && this.clearingLineIndices.length === 0) {
                            const py = y - this.currentPiece.y, px = x - this.currentPiece.x;
                            if (py >= 0 && py < this.currentPiece.shape.length && px >= 0 && px < this.currentPiece.shape[0].length && this.currentPiece.shape[py][px]) char = "[]";
                        }
                    }
                    this.write(char, ox + 2 + x * 2, oy + y);
                }
                this.write(right, ox + 2 + GAME_COLS * 2, oy + y);
            }
            this.write("  " + "==".repeat(GAME_COLS) + "  ", ox, oy + 20);
            this.write("  " + "\\/".repeat(GAME_COLS) + "  ", ox, oy + 21);

            if (this.state === 'GAMEOVER') {
                const msg = ["! ! ! ИГРА ОКОНЧЕНА ! ! !", " ", this.playerName ? " НАЖМИТЕ ENTER ДЛЯ " : " НАЖМИТЕ ENTER ЧТОБЫ ", this.playerName ? " ОТПРАВКИ РЕКОРДА " : " ВВЕСТИ СВОЕ ИМЯ "];
                msg.forEach((text, i) => {
                    const y = 10 + i;
                    const x = Math.floor((WIDTH - text.length) / 2);
                    this.write(text, x, y);
                });
            }

            if (this.state === 'INPUT_NAME') {
                this.write("! ! ! НОВЫЙ РЕКОРД ! ! !", 28, 10);
                this.write("ВВЕДИТЕ ВАШЕ ИМЯ:", 31, 12);
                this.write(`> ${this.inputBuffer}_`, 34, 14);
                this.write("НАЖМИТЕ ENTER ДЛЯ СОХРАНЕНИЯ", 26, 16);
            }

            if (this.state === 'LOADING') {
                this.write("ОТПРАВКА ДАННЫХ...", 31, 12);
            }

            if (this.state === 'LEADERBOARD') {
                const drawTable = (data, startY, label) => {
                    const header = `== ${label} ==`;
                    this.write(header, Math.floor((WIDTH - header.length) / 2), startY);
                    this.write("-----------------------------", 25, startY + 1);
                    this.write(" МЕСТО   ИМЯ          ОЧКИ   ", 25, startY + 2);
                    this.write("-----------------------------", 25, startY + 3);
                    
                    data.forEach((r, i) => {
                        const rank = String(r.rank).padStart(2, '0');
                        const name = r.name.toUpperCase().padEnd(12, ' ');
                        const score = String(r.score).padStart(6, '0');
                        const isCurrent = r.isCurrent;
                        
                        let line = `  ${rank}.    ${name}  ${score}  `;
                        if (isCurrent) {
                            line = `> ${rank}.    ${name}  ${score} <`;
                        }
                        this.write(line, 25, startY + 4 + i);
                    });
                    return startY + 4 + data.length + 1;
                };

                if (this.leaderboardData) {
                    let nextY = drawTable(this.leaderboardData.top3, 2, "ТОП РЕКОРДОВ");
                    drawTable(this.leaderboardData.group, nextY + 1, "ВАША ПОЗИЦИЯ");
                }
                
                const restartMsg = "--- НАЖМИТЕ ENTER ДЛЯ РЕСТАРТА ---";
                this.write(restartMsg, Math.floor((WIDTH - restartMsg.length) / 2), 23);
            }
        }
        this.terminal.textContent = this.buffer.map(row => row.join('')).join('\n');
        
        // Pulse START button when input is needed
        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            const shouldPulse = ['START', 'GAMEOVER', 'LEADERBOARD', 'INPUT_NAME'].includes(this.state);
            btnStart.classList.toggle('pulse-btn', shouldPulse);
        }
    }
}
new TerminalTetris();
