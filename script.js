// --- 初始化主畫布 ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20); // 遊戲邏輯單位為 1, 渲染時放大為 20px

// --- 初始化接下來方塊畫布 ---
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20); // 同樣放大

// --- 遊戲定義 ---
const ARENA_WIDTH = 12;
const ARENA_HEIGHT = 20;

// 方塊顏色定義 (使用更飽和的實心顏色)
const colors = [
    null,
    '#FF0D72', // T (紫紅)
    '#0DC2FF', // O (青藍)
    '#0DFF72', // L (綠)
    '#F538FF', // J (紫)
    '#FF8E0D', // I (橘)
    '#FFE138', // S (黃)
    '#3877FF', // Z (藍)
];

// 遊戲狀態
const arena = Array.from({length: ARENA_HEIGHT}, () => Array(ARENA_WIDTH).fill(0));
const player = { pos: {x: 0, y: 0}, matrix: null, score: 0 };
let nextPieces = []; // 接下來三個方塊的佇列
let bag = [];       // 7-Bag 系統的袋子

// 專業參數 (可由 UI 更新)
let config = { das: 170, arr: 30, sdf: 20 };

// 按鍵狀態追蹤
const keys = {
    left: { pressed: false, startTime: 0, lastRepeat: 0 },
    right: { pressed: false, startTime: 0, lastRepeat: 0 },
    down: { pressed: false }
};

// --- 1. 方塊生成與 7-Bag 系統 ---
function createPiece(type) {
    if (type === 'T') return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 0, 3], [3, 3, 3], [0, 0, 0]];
    if (type === 'J') return [[4, 0, 0], [4, 4, 4], [0, 0, 0]];
    if (type === 'I') return [[0,0,0,0], [5,5,5,5], [0,0,0,0], [0,0,0,0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

function fillBag() {
    bag = 'ILJOTSZ'.split('');
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
}

function updateNextPieces() {
    while (nextPieces.length < 4) { // 保持佇列中有 4 個 (1 個當前, 3 個預覽)
        if (bag.length === 0) fillBag();
        nextPieces.push(createPiece(bag.pop()));
    }
}

// --- 2. 核心遊戲邏輯 ---
function collide(arena, piece, pos) {
    const m = piece;
    const o = pos;
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
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) if (arena[y][x] === 0) continue outer;
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        y++;
        rowCount++;
    }
    // 分數系統 (消除越多列分數越高)
    if (rowCount > 0) {
        const lineScores = [0, 100, 300, 500, 800];
        player.score += lineScores[rowCount];
        document.getElementById('score').innerText = player.score;
    }
}

function playerReset() {
    updateNextPieces();
    player.matrix = nextPieces.shift(); // 從佇列拿一個當前的
    player.pos.y = 0;
    player.pos.x = Math.floor(arena[0].length / 2) - Math.floor(player.matrix[0].length / 2);
    
    if (collide(arena, player.matrix, player.pos)) {
        // Game Over
        arena.forEach(row => row.fill(0));
        player.score = 0;
        document.getElementById('score').innerText = '0';
        bag = [];
        nextPieces = [];
        updateNextPieces();
    }
}

// --- 3. 移動與旋轉 ---
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player.matrix, player.pos)) player.pos.x -= dir;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player.matrix, player.pos)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        playerReset();
    }
    dropCounter = 0;
}

function hardDrop() {
    player.pos = getGhostPosition(); // 直接移動到預覽位置
    merge(arena, player);
    arenaSweep();
    playerReset();
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    dir > 0 ? matrix.forEach(row => row.reverse()) : matrix.reverse();
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player.matrix, player.pos)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) { // 旋轉失敗
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

// --- 4. 預覽落下 (Ghost Block) 核心邏輯 ---
function getGhostPosition() {
    const ghostPos = {x: player.pos.x, y: player.pos.y};
    while (!collide(arena, player.matrix, ghostPos)) {
        ghostPos.y++;
    }
    ghostPos.y--; // 回退一步，因為最後一步碰到了
    return ghostPos;
}

// --- 5. 渲染 (Drawing) ---
function drawBlock(ctx, x, y, colorIndex, opacity = 1) {
    const color = colors[colorIndex];
    ctx.globalAlpha = opacity;
    
    // 實心填充
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    
    // 加一點 3D 邊框效果
    ctx.globalAlpha = opacity * 0.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // 亮邊
    ctx.fillRect(x, y, 1, 0.1);
    ctx.fillRect(x, y, 0.1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';     // 暗邊
    ctx.fillRect(x, y+0.9, 1, 0.1);
    ctx.fillRect(x+0.9, y, 0.1, 1);
    
    ctx.globalAlpha = 1.0; // 重置透明度
}

function drawMatrix(ctx, matrix, offset, opacity = 1) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + offset.x, y + offset.y, value, opacity);
            }
        });
    });
}

function draw() {
    // A. 清空主畫布
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width / 20, canvas.height / 20); // 這裡要除以 scale
    
    // B. 繪製固定的方塊
    drawMatrix(context, arena, {x: 0, y: 0});
    
    // C. 繪製預覽落下 (Ghost) - 半透明
    if (player.matrix) {
        const ghostPos = getGhostPosition();
        drawMatrix(context, player.matrix, ghostPos, 0.3); // 30% 透明度
        
        // D. 繪製當前方塊 - 實心
        drawMatrix(context, player.matrix, player.pos, 1.0);
    }
    
    // E. 繪製接下來的方塊 (側邊面板)
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width/20, nextCanvas.height/20);
    
    nextPieces.slice(0, 3).forEach((piece, index) => {
        // 將不同形狀的方塊置中顯示
        const offsetX = piece[0].length === 4 ? 0.5 : (piece[0].length === 2 ? 1.5 : 1);
        drawMatrix(nextContext, piece, {x: offsetX, y: 1 + index * 4}, 1);
    });
}

// --- 6. 輸入處理 (DAS/ARR/SDF 同前版) ---
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

// --- 7. 遊戲循環與設定 ---
let dropCounter = 0;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    // 處理 DAS/ARR
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

    draw();
    requestAnimationFrame(update);
}

document.getElementById('start-btn').addEventListener('click', () => {
    // 從 UI 更新設定
    config.das = parseInt(document.getElementById('das').value);
    config.arr = parseInt(document.getElementById('arr').value);
    config.sdf = parseInt(document.getElementById('sdf').value);
    
    // 初始化遊戲
    arena.forEach(row => row.fill(0));
    player.score = 0;
    document.getElementById('score').innerText = '0';
    bag = [];
    nextPieces = [];
    
    playerReset();
    update(); // 開始循環
});
