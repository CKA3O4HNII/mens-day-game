// Константы
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 10;  // Размер клетки (zoom меняет)
const WORLD_WIDTH = 100;  // Мир 100x100
const WORLD_HEIGHT = 100;
const VIEW_WIDTH = canvas.width / GRID_SIZE;  // Видимые клетки по X
const VIEW_HEIGHT = canvas.height / GRID_SIZE;

let cameraX = 0;  // Позиция камеры
let cameraY = 0;
let zoom = 1;  // Масштаб (1 = норм)
let grid = Array.from({length: WORLD_HEIGHT}, () => Array(WORLD_WIDTH).fill(null));  // Grid: null = пусто, объект = здание
let population = 0;
let maxPopulation = 100;
let resources = { wood: 100, stone: 100, iron: 100 };
let buildingData = {};  // Из JSON
let armyStorage = [];  // Для казарм (до 20 юнитов)

// Загрузка JSON
async function loadBuildings() {
    const response = await fetch('buildings.json');
    buildingData = await response.json();
}

// Инициализация
async function init() {
    await loadBuildings();
    loadProgress();
    draw();
    updateInfo();

    // События
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel);
    document.addEventListener('keydown', handleKeydown);
}

// Рисование
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellSize = GRID_SIZE * zoom;

    // Рисуй только видимую часть
    for (let y = Math.max(0, cameraY); y < Math.min(WORLD_HEIGHT, cameraY + VIEW_HEIGHT / zoom + 1); y++) {
        for (let x = Math.max(0, cameraX); x < Math.min(WORLD_WIDTH, cameraX + VIEW_WIDTH / zoom + 1); x++) {
            const drawX = (x - cameraX) * cellSize;
            const drawY = (y - cameraY) * cellSize;
            ctx.strokeRect(drawX, drawY, cellSize, cellSize);  // Grid

            if (grid[y][x]) {
                ctx.fillStyle = '#A52A2A';  // Цвет здания
                ctx.fillRect(drawX, drawY, cellSize, cellSize);
            }
        }
    }
}

// Обновление инфо
function updateInfo() {
    document.getElementById('info').innerText = `Население: ${population}/${maxPopulation} | Дерево: ${resources.wood} | Камень: ${resources.stone} | Железо: ${resources.iron}`;
}

// Клик: ЛКМ
function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.floor((e.clientX - rect.left) / (GRID_SIZE * zoom) + cameraX);
    const clickY = Math.floor((e.clientY - rect.top) / (GRID_SIZE * zoom) + cameraY);

    if (clickX < 0 || clickX >= WORLD_WIDTH || clickY < 0 || clickY >= WORLD_HEIGHT) return;

    const cell = grid[clickY][clickX];
    if (cell) {
        // Здание: Статы + снос
        let stats = `Здание: ${cell.name}\nБонусы: ${JSON.stringify(cell.bonuses)}`;
        if (confirm(`${stats}\nСнести?`)) {
            removeBuilding(clickX, clickY);
        } else if (cell.name === 'Академия') {
            alert('Меню исследований: Unlock новые постройки/юниты (TODO)');
        }
    } else {
        // Пусто: Меню построек
        let options = buildingData.buildings.map(b => b.name).join('\n');
        let choice = prompt(`Доступные постройки:\n${options}\nВведи имя для постройки:`);
        if (choice) buildBuilding(choice, clickX, clickY);
    }
    draw();
}

// Строительство
function buildBuilding(name, baseX, baseY) {
    const building = buildingData.buildings.find(b => b.name === name);
    if (!building) return alert('Нет такой постройки!');

    // Проверка стоимости
    for (let res in building.cost) {
        if (resources[res] < building.cost[res]) return alert(`Недостаточно ${res}!`);
    }

    // Проверка формы (3x3, позиции относительные)
    for (let pos of building.shape) {
        const dx = Math.floor(pos % 3);
        const dy = Math.floor(pos / 3);
        const tx = baseX + dx;
        const ty = baseY + dy;
        if (tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT || grid[ty][tx]) return alert('Место занято!');
    }

    // Строй: Помести объект на все клетки формы
    const buildingInstance = { name: building.name, bonuses: building.bonuses, baseX, baseY, shape: building.shape };
    for (let pos of building.shape) {
        const dx = Math.floor(pos % 3);
        const dy = Math.floor(pos / 3);
        grid[baseY + dy][baseX + dx] = buildingInstance;
    }

    // Вычти стоимость
    for (let res in building.cost) resources[res] -= building.cost[res];

    // Примени бонусы
    if (building.bonuses.maxPopulation) maxPopulation += building.bonuses.maxPopulation;
    if (building.bonuses.armyStorage) {
        // TODO: Хранение армии по HP
        alert('Казарма: Хранит до 20 юнитов (TODO: добавить юниты)');
    }
}

// Снос
function removeBuilding(x, y) {
    const building = grid[y][x];
    if (!building) return;

    // Удали с всех клеток
    for (let pos of building.shape) {
        const dx = Math.floor(pos % 3);
        const dy = Math.floor(pos / 3);
        grid[building.baseY + dy][building.baseX + dx] = null;
    }

    // Верни бонусы (обратно)
    if (building.bonuses.maxPopulation) maxPopulation -= building.bonuses.maxPopulation;
}

// Zoom (wheel)
function handleWheel(e) {
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoom = Math.max(0.5, Math.min(2, zoom + delta));
    draw();
}

// Движение (WASD/стрелки)
function handleKeydown(e) {
    const speed = 1 / zoom;  // Быстрее при зуме out
    if (e.key === 'w' || e.key === 'ArrowUp') cameraY = Math.max(0, cameraY - speed);
    if (e.key === 's' || e.key === 'ArrowDown') cameraY = Math.min(WORLD_HEIGHT - VIEW_HEIGHT / zoom, cameraY + speed);
    if (e.key === 'a' || e.key === 'ArrowLeft') cameraX = Math.max(0, cameraX - speed);
    if (e.key === 'd' || e.key === 'ArrowRight') cameraX = Math.min(WORLD_WIDTH - VIEW_WIDTH / zoom, cameraX + speed);
    draw();
}

// Сохранение/Загрузка (grid сериализуем)
function saveProgress() {
    const saveData = {
        population, maxPopulation, resources,
        grid: grid.map(row => row.map(cell => cell ? {name: cell.name, baseX: cell.baseX, baseY: cell.baseY, shape: cell.shape} : null))
    };
    localStorage.setItem('mensDayGame', JSON.stringify(saveData));
    alert('Сохранено!');
}

function loadProgress() {
    const saved = localStorage.getItem('mensDayGame');
    if (saved) {
        const data = JSON.parse(saved);
        population = data.population;
        maxPopulation = data.maxPopulation;
        resources = data.resources;
        grid = data.grid.map(row => row.map(cell => {
            if (cell) {
                const building = buildingData.buildings.find(b => b.name === cell.name);
                return { name: cell.name, bonuses: building.bonuses, baseX: cell.baseX, baseY: cell.baseY, shape: cell.shape };
            }
            return null;
        }));
        alert('Загружено!');
    }
}

document.getElementById('saveBtn').addEventListener('click', saveProgress);
document.getElementById('loadBtn').addEventListener('click', loadProgress);

// Старт
init();