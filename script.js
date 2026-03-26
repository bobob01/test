const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

// --- 遊戲常數與狀態 ---
const arena = Array.from({length: 20}, () => Array(12).fill(0));
const player = { pos: {x: 0, y: 0}, matrix: null, score: 0 };
let bag = [];

// 專業參數 (可由 UI 更新)
let config = {
    das: 170, // Delayed Auto Shift
    arr: 30,  // Auto Repeat Rate
    sdf: 20,  // Soft Drop Factor (1=正常, 20=快20倍)
};

// 按鍵狀態追蹤
const keys = {
    left: { pressed: false, startTime: 0, lastRepeat: 0 },
    right: { pressed: false, startTime: 0, lastRepeat: 0 },
    down: { pressed: false }
};

// --- 7-Bag 系統 ---
function getNextPiece() {
    if (bag.length === 0) {
        bag = 'ILJOTSZ'.split('');
        for (let i = bag.length - 1; i > 0; i--) { // Shuffle
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return createPiece(bag.pop());
}

function createPiece(type) {
    if (type === 'T') return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 0, 3], [3, 3, 3], [0, 0, 0]];
    if (type === 'J') return [[4, 0, 0], [4, 4, 4], [0, 0, 0]];
    if (type === 'I') return [[0,0,0,0],[5,5,5,5],[0,0,0,0],[0,0,0,0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

// --- 核心動作 ---
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

// --- 輔助邏輯 (旋轉、碰撞、渲染同前版) ---
function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    dir > 0 ? matrix.forEach(row => row.reverse()) : matrix.reverse();
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function arenaSweep() {
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) if (arena[y][x] === 0) continue outer;
        arena.unshift(arena.splice(y, 1)[0].fill(0));
        player.score += 100;
        y++;
    }
    document.getElementById('score').innerText = player.score;
}

function playerReset() {
    player.matrix = getNextPiece();
    player.pos.y = 0;
    player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
    }
}

// --- 輸入處理 (DAS/ARR 邏輯) ---
window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'z', 'x'].includes(e.key)) e.preventDefault();
    
    if (e.key === 'ArrowLeft' && !keys.left.pressed) {
        playerMove(-1);
        keys.left.pressed = true;
        keys.left.startTime = performance.now();
        keys.left.lastRepeat = 0;
    }
    if (e.key === 'ArrowRight' && !keys.right.pressed) {
        playerMove(1);
        keys.right.pressed = true;
        keys.right.startTime = performance.now();
        keys.right.lastRepeat = 0;
    }
    if (e.key === 'ArrowDown') keys.down.pressed = true;
    if (e.key === ' ') hardDrop();
    if (e.key.toLowerCase() === 'z') playerRotate(-1);
    if (e.key.toLowerCase() === 'x') playerRotate(1);
});

window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft') keys.left.pressed = false;
    if (e.key === 'ArrowRight') keys.right.pressed = false;
    if (e.key === 'ArrowDown') keys.down.pressed = false;
});

// --- 遊戲循環與參數更新 ---
let dropCounter = 0;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    // 處理 DAS/ARR 移動
    const now = performance.now();
    ['left', 'right'].forEach(dir => {
        const k = keys[dir];
        if (k.pressed) {
            const elapsed = now - k.startTime;
            if (elapsed > config.das) {
                const repeatElapsed = elapsed - config.das;
                const step = Math.floor(repeatElapsed / config.arr);
                if (step > k.lastRepeat) {
                    playerMove(dir === 'left' ? -1 : 1);
                    k.lastRepeat = step;
                }
            }
        }
    });

    // 處理下落 (含 Soft Drop)
    let currentDropInterval = 1000 / (keys.down.pressed ? config.sdf : 1);
    dropCounter += deltaTime;
    if (dropCounter > currentDropInterval) playerDrop();

    // 繪製
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
    
    requestAnimationFrame(update);
}

function drawMatrix(matrix, offset) {
    const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

document.getElementById('start-btn').addEventListener('click', () => {
    config.das = parseInt(document.getElementById('das').value);
    config.arr = parseInt(document.getElementById('arr').value);
    config.sdf = parseInt(document.getElementById('sdf').value);
    playerReset();
    update();
});