const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Создание пула соединений с MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root123',     // ⚠️ ЗАМЕНИТЕ НА ВАШ ПАРОЛЬ
    database: 'expert_service',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Функция инициализации базы данных
async function initDb() {
    console.log('🔌 Подключение к MySQL...');
    
    try {
        // Создание таблицы пользователей
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'master', 'admin') DEFAULT 'user',
                avatar VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица users создана');

        // Создание таблицы услуг
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS services (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) DEFAULT 0,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица services создана');

        // Создание таблицы заявок
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS requests (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                service VARCHAR(100) NOT NULL,
                description TEXT,
                address VARCHAR(255),
                preferred_date VARCHAR(50),
                status ENUM('new', 'in_progress', 'completed', 'cancelled') DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Таблица requests создана');

        // Создание таблицы отзывов
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                user_name VARCHAR(100) NOT NULL,
                rating INT DEFAULT 5,
                comment TEXT NOT NULL,
                master_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Таблица reviews создана');

        // Создание таблицы новостей
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS news (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица news создана');

        // Создание таблицы вакансий
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS vacancies (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                salary VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица vacancies создана');

        // Создание таблицы фотографий
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS photos (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(200),
                image VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица photos создана');

        // Создание таблицы диалогов с AI
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS chat_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                user_message TEXT NOT NULL,
                bot_response TEXT NOT NULL,
                intent VARCHAR(50),
                rating INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Таблица chat_logs создана');

        // Создание таблицы настроек
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                \`key\` VARCHAR(100) UNIQUE NOT NULL,
                \`value\` TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица settings создана');

        // Добавление администратора по умолчанию
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await promisePool.execute(`
            INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
            VALUES (1, 'Администратор', 'admin@example.com', ?, 'admin', '/uploads/default-avatar.png')
        `, [hashedPassword]);

        // Добавление мастера по умолчанию
        const hashedMasterPassword = await bcrypt.hash('master123', 10);
        await promisePool.execute(`
            INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
            VALUES (2, 'Иван Мастеров', 'master@example.com', ?, 'master', '/uploads/default-avatar.png')
        `, [hashedMasterPassword]);

        // Добавление тестового пользователя
        const hashedUserPassword = await bcrypt.hash('user123', 10);
        await promisePool.execute(`
            INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
            VALUES (3, 'Тестовый Пользователь', 'user@example.com', ?, 'user', '/uploads/default-avatar.png')
        `, [hashedUserPassword]);

        // Добавление услуг по умолчанию
        const defaultServices = [
            { name: 'Ремонт холодильников', description: 'Диагностика и ремонт любых холодильников', price: 1500 },
            { name: 'Ремонт стиральных машин', description: 'Быстрый ремонт стиральных машин на дому', price: 1800 },
            { name: 'Ремонт телевизоров', description: 'Ремонт LED, LCD, OLED телевизоров', price: 1200 },
            { name: 'Ремонт кофемашин', description: 'Ремонт кофемашин любых брендов', price: 1000 }
        ];

        for (const service of defaultServices) {
            await promisePool.execute(
                'INSERT IGNORE INTO services (name, description, price) VALUES (?, ?, ?)',
                [service.name, service.description, service.price]
            );
        }

        console.log('✅ База данных MySQL инициализирована!');
        console.log('\n📝 Учётные данные:');
        console.log('   👑 Администратор: admin@example.com / admin123');
        console.log('   🔧 Мастер: master@example.com / master123');
        console.log('   👤 Пользователь: user@example.com / user123');

    } catch (err) {
        console.error('❌ Ошибка инициализации БД:', err);
    }
}

// Функция для выполнения запросов (аналог db.all)
async function query(sql, params = []) {
    const [rows] = await promisePool.execute(sql, params);
    return rows;
}

// Функция для получения одной записи (аналог db.get)
async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

// Функция для выполнения запросов (аналог db.run)
async function run(sql, params = []) {
    const [result] = await promisePool.execute(sql, params);
    return { lastID: result.insertId };
}

// Экспорт функций
module.exports = { query, get, run, initDb, pool };