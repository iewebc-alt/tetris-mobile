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
        this.state = 'START';
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
        this.centerBoardOnMobile();
        window.addEventListener('resize', () => this.centerBoardOnMobile());
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
                    } else if (this.state === 'GAMEOVER') {
                        location.reload();
                    }
                } else {
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
        if (this.state === 'GAMEOVER') {
            if (e.key === 'Enter') location.reload();
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
                const msg = ["! ! ! ИГРА ОКОНЧЕНА ! ! !", " ", " НАЖМИТЕ ENTER ", " ДЛЯ РЕСТАРТА "];
                msg.forEach((text, i) => {
                    const y = 10 + i;
                    const x = Math.floor((WIDTH - text.length) / 2);
                    this.write(text, x, y);
                });
            }
        }
        this.terminal.textContent = this.buffer.map(row => row.join('')).join('\n');
    }
}
new TerminalTetris();
