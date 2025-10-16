// Основные переменные
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 50; // Размер клетки карты (10x10 grid)
const mapWidth = canvas.width / gridSize; // 10
const mapHeight = canvas.height / gridSize; // 10

let resources = { metal: 0, food: 0 }; // Ресурсы
let level = 1; // Текущий уровень
let progress = 0; // Уничтоженные города (0/19)
let units = []; // Массив юнитов

// Класс Юнита (базовый, расширь для разных ролей)
class Unit {
    constructor(type, x, y) {
        this.type = type; // 'miner', 'farmer', etc.
        this.x = x; // Позиция в grid
        this.y = y;
        this.health = 100;
        this.energy = 100;
    }

    // Метод для действия (например, добыча)
    act() {
        if (this.type === 'miner') {
            resources.metal += 10;
            this.energy -= 5;
            if (this.energy < 0) this.energy = 0;
        }
        // Добавь для других: farmer добавляет food, etc.
    }

    draw() {
        ctx.fillStyle = this.type === 'miner' ? '#FFD700' : '#00FF00'; // Цвет по типу
        ctx.fillRect(this.x * gridSize, this.y * gridSize, gridSize, gridSize);
    }
}

// Инициализация игры
function init() {
    // Добавь первого юнита
    units.push(new Unit('miner', 5, 5)); // Шахтёр в центре

    // Загрузи сохранение, если есть
    loadProgress();

    // Рендер
    draw();
    updateInfo();
}

// Рисование карты и юнитов
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Рисуй grid
    for (let i = 0; i <= mapWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j <= mapHeight; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * gridSize);
        ctx.lineTo(canvas.width, j * gridSize);
        ctx.stroke();
    }
    // Рисуй юнитов
    units.forEach(unit => unit.draw());
}

// Обновление инфо
function updateInfo() {
    document.getElementById('info').innerText = `Ресурсы: Металл ${resources.metal}, Еда ${resources.food} | Уровень: ${level} | Прогресс: ${progress}/19 городов`;
}

// События: Клик по canvas для действия юнита
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.floor((e.clientX - rect.left) / gridSize);
    const clickY = Math.floor((e.clientY - rect.top) / gridSize);
    
    // Найди юнита и заставь действовать (просто для примера)
    units.forEach(unit => {
        if (unit.x === clickX && unit.y === clickY) {
            unit.act();
        }
    });
    
    draw();
    updateInfo();
});

// Сохранение прогресса в localStorage
function saveProgress() {
    const saveData = {
        resources,
        level,
        progress,
        units: units.map(u => ({ type: u.type, x: u.x, y: u.y, health: u.health, energy: u.energy }))
    };
    localStorage.setItem('mensDayGame', JSON.stringify(saveData));
    alert('Прогресс сохранён!');
}

// Загрузка
function loadProgress() {
    const saved = localStorage.getItem('mensDayGame');
    if (saved) {
        const data = JSON.parse(saved);
        resources = data.resources;
        level = data.level;
        progress = data.progress;
        units = data.units.map(u => new Unit(u.type, u.x, u.y));
        units.forEach((u, i) => {
            u.health = data.units[i].health;
            u.energy = data.units[i].energy;
        });
        alert('Прогресс загружен!');
    }
}

// Кнопки
document.getElementById('saveBtn').addEventListener('click', saveProgress);
document.getElementById('loadBtn').addEventListener('click', loadProgress);

// Старт
init();

// Далее: Добавь таймер для реал-тайм, AI для роботов, уровни
// Для PVE: Когда resources.metal > 100, level++, progress++ если "уничтожен город" (симулируй бой)
// Расширь Unit для других типов, добавь здания (в массиве buildings)
