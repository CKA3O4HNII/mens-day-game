// Основные переменные
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 50;
const mapWidth = 10; // Город grid 10x10
const mapHeight = 10;
const battleGridSize = 30; // Арена 15x15 для боя
const battleWidth = 15;
const battleHeight = 15;

let mode = 'city'; // 'city' или 'battle'
let population = 100; // Население
let food = 0; // Еда
let metal = 0; // Металл
let level = 1; // Уровень города
let progress = 0; // Уничтоженные города (0/19)
let buildings = []; // Здания {type, x, y, workers}
let units = []; // Юниты в городе/бою
let enemies = []; // Роботы в бою
let unlocks = {}; // Чертежи, e.g. {tank: false}
let timers = []; // Таймеры для смертей/роста

// Класс Здания
class Building {
    constructor(type, x, y) {
        this.type = type; // 'farm', 'kitchen', etc.
        this.x = x;
        this.y = y;
        this.workers = 0; // Назначенные люди
    }
}

// Класс Юнита (для города и боя)
class Unit {
    constructor(type, x, y, faction = 'human') {
        this.type = type; // 'soldier', 'elite', 'tank', etc.
        this.x = x;
        this.y = y;
        this.faction = faction;
        this.arrivalTurn = 0; // Ходы до прибытия
        if (faction === 'human') {
            switch (type) {
                case 'soldier':
                    this.move = 2; this.range = 5; this.dmgMin = 0; this.dmgMax = 50; this.hp = Math.floor(Math.random() * 11) + 40; this.cost = 50; this.arrival = 1;
                    break;
                case 'elite':
                    this.move = 3; this.range = 7; this.dmgMin = 20; this.dmgMax = 50; this.hp = 50; this.cost = 50; this.arrival = 3;
                    break;
                case 'tank':
                    this.move = 7; this.range = 15; this.dmgMin = 250; this.dmgMax = 250; this.hp = 1000; this.cost = 500; this.metalCost = 150; this.arrival = 10;
                    break;
            }
        } else { // Роботы
            switch (type) {
                case 'robot_soldier':
                    this.move = 2; this.range = 5; this.dmgMin = 0; this.dmgMax = 50; this.hp = Math.floor(Math.random() * 11) + 40;
                    break;
                case 'drone':
                    this.move = 3; this.range = 7; this.dmgMin = 20; this.dmgMax = 50; this.hp = 50;
                    break;
                case 'mech':
                    this.move = 7; this.range = 15; this.dmgMin = 250; this.dmgMax = 250; this.hp = 1000;
                    break;
            }
        }
    }

    act(target) {
        // Атака: если в range
        if (this.inRange(target)) {
            const dmg = Math.floor(Math.random() * (this.dmgMax - this.dmgMin + 1)) + this.dmgMin;
            target.hp -= dmg;
            if (target.hp <= 0) {
                // Удалить цель
                enemies = enemies.filter(e => e !== target);
                units = units.filter(u => u !== target);
            }
        }
    }

    inRange(target) {
        const dist = Math.abs(this.x - target.x) + Math.abs(this.y - target.y); // Манхэттен для простоты
        return dist <= this.range;
    }

    draw() {
        ctx.fillStyle = this.faction === 'human' ? '#00FF00' : '#FF0000'; // Зеленый/Красный
        ctx.fillRect(this.x * (mode === 'city' ? gridSize : battleGridSize), this.y * (mode === 'city' ? gridSize : battleGridSize), (mode === 'city' ? gridSize : battleGridSize), (mode === 'city' ? gridSize : battleGridSize));
    }
}

// Инициализация
function init() {
    loadProgress();
    startCityTimers();
    draw();
    updateInfo();
}

// Таймеры для города
function startCityTimers() {
    setInterval(() => {
        // Производство еды
        buildings.forEach(b => {
            if (b.type === 'farm' && b.workers >= 3) food += b.workers; // +еда
            if (b.type === 'kitchen' && b.workers >= 4) food += b.workers * 2; // Переработка
        });

        // Рост/смерть
        if (food >= population) {
            population += Math.floor(population * 0.01); // +1%
        } else {
            // Запустить таймер смерти через 10 мин (600000 ms)
            if (!timers.length) {
                timers.push(setTimeout(() => { population = 0; alert('Игра over: Все умерли!'); }, 600000));
            }
        }
        food -= population; // Потребление
        if (food < 0) food = 0;

        // Уровни
        if (population > 1000 && level === 1) {
            level = 2;
            alert('Уровень 2: Нужна вода! Построй скважину.');
        }

        draw();
        updateInfo();
    }, 60000); // Каждую минуту
}

// Рисование
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const currentGrid = mode === 'city' ? gridSize : battleGridSize;
    const currentWidth = mode === 'city' ? mapWidth : battleWidth;
    const currentHeight = mode === 'city' ? mapHeight : battleHeight;
    canvas.width = currentWidth * currentGrid;
    canvas.height = currentHeight * currentGrid;

    // Grid
    for (let i = 0; i <= currentWidth; i++) {
        ctx.moveTo(i * currentGrid, 0); ctx.lineTo(i * currentGrid, canvas.height); ctx.stroke();
    }
    for (let j = 0; j <= currentHeight; j++) {
        ctx.moveTo(0, j * currentGrid); ctx.lineTo(canvas.width, j * currentGrid); ctx.stroke();
    }

    // Здания/Юниты
    if (mode === 'city') {
        buildings.forEach(b => {
            ctx.fillStyle = '#A52A2A'; ctx.fillRect(b.x * currentGrid, b.y * currentGrid, currentGrid, currentGrid);
        });
    }
    units.forEach(u => u.draw());
    enemies.forEach(e => e.draw());
}

// Обновление инфо
function updateInfo() {
    document.getElementById('info').innerText = `Население: ${population} | Еда: ${food} | Металл: ${metal} | Уровень: ${level} | Прогресс: ${progress}/19`;
}

// События: Клик
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.floor((e.clientX - rect.left) / (mode === 'city' ? gridSize : battleGridSize));
    const clickY = Math.floor((e.clientY - rect.top) / (mode === 'city' ? gridSize : battleGridSize));

    if (mode === 'city') {
        // Строительство или действие
    } else if (mode === 'battle') {
        // Выбор юнита, перемещение/атака (упрощённо: клик на юнита -> атакуй ближайшего)
        units.forEach(u => {
            if (u.x === clickX && u.y === clickY && enemies.length) {
                u.act(enemies[0]); // Атакуй первого врага
                // AI ход: enemies act on units
                enemies.forEach(e => e.act(units[0]));
                if (enemies.length === 0) {
                    progress++;
                    mode = 'city';
                    metal += 150;
                    if (Math.random() > 0.5) unlocks.tank = true; // Чертеж
                    alert('Победа! +Ресурсы и чертеж?');
                }
            }
        });
    }
    draw();
    updateInfo();
});

// Кнопки строительства
document.getElementById('buildFarm').addEventListener('click', () => {
    // Пример: строй на (0,0), если population >10
    if (population > 10) {
        buildings.push(new Building('farm', 0, 0));
        population -= 10; // Стоимость
        // Назначь workers кликом позже
    }
});
document.getElementById('buildKitchen').addEventListener('click', () => {
    if (population > 10) buildings.push(new Building('kitchen', 1, 0)); population -= 10;
});

// Старт миссии
document.getElementById('startMission').addEventListener('click', () => {
    mode = 'battle';
    units = [new Unit('soldier', 0, 7)]; // Твой юнит слева
    enemies = [new Unit('robot_soldier', 14, 7, 'robot')]; // Враг справа
    draw();
});

// Сохранение/Загрузка (расширь)
function saveProgress() {
    const saveData = { population, food, metal, level, progress, buildings: buildings.map(b => ({type: b.type, x: b.x, y: b.y, workers: b.workers})), unlocks };
    localStorage.setItem('mensDayGame', JSON.stringify(saveData));
}
function loadProgress() {
    const saved = localStorage.getItem('mensDayGame');
    if (saved) {
        const data = JSON.parse(saved);
        population = data.population; food = data.food; metal = data.metal; level = data.level; progress = data.progress;
        buildings = data.buildings.map(b => new Building(b.type, b.x, b.y)); buildings.forEach((b, i) => b.workers = data.buildings[i].workers);
        unlocks = data.unlocks;
    }
}

// Старт
init();
document.getElementById('saveBtn').addEventListener('click', saveProgress);
document.getElementById('loadBtn').addEventListener('click', loadProgress);