const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Подключение к PostgreSQL на Render.com
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Render сам добавит эту переменную
    ssl: {
        rejectUnauthorized: false
    }
});

async function query(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

async function run(sql, params = []) {
    const result = await pool.query(sql, params);
    return { lastID: result.insertId };
}

async function all(sql, params = []) {
    return await query(sql, params);
}

// Инициализация таблиц
async function initDb() {
    console.log('🔄 Подключение к PostgreSQL на Render...');
    
    // Таблица пользователей
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            avatar VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица услуг
    await pool.query(`
        CREATE TABLE IF NOT EXISTS services (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) DEFAULT 0,
            image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица заявок
    await pool.query(`
        CREATE TABLE IF NOT EXISTS requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            service VARCHAR(100) NOT NULL,
            description TEXT,
            address VARCHAR(255),
            preferred_date VARCHAR(50),
            status VARCHAR(20) DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица отзывов
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            user_name VARCHAR(100) NOT NULL,
            rating INTEGER DEFAULT 5,
            comment TEXT NOT NULL,
            master_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица новостей
    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица вакансий
    await pool.query(`
        CREATE TABLE IF NOT EXISTS vacancies (
            id SERIAL PRIMARY KEY,
            title VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            requirements TEXT,
            salary VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица фотографий
    await pool.query(`
        CREATE TABLE IF NOT EXISTS photos (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200),
            image VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица диалогов AI
    await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            user_message TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            intent VARCHAR(50),
            rating INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица настроек
    await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Добавление администратора
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
        `INSERT INTO users (id, name, email, password, role, avatar) 
         VALUES (1, 'Администратор', 'admin@example.com', $1, 'admin', '/uploads/default-avatar.png')
         ON CONFLICT (id) DO NOTHING`,
        [hashedPassword]
    );
    
    // Добавление мастера
    const hashedMasterPassword = await bcrypt.hash('master123', 10);
    await pool.query(
        `INSERT INTO users (id, name, email, password, role, avatar) 
         VALUES (2, 'Иван Мастеров', 'master@example.com', $1, 'master', '/uploads/default-avatar.png')
         ON CONFLICT (id) DO NOTHING`,
        [hashedMasterPassword]
    );
    
    // Добавление пользователя
    const hashedUserPassword = await bcrypt.hash('user123', 10);
    await pool.query(
        `INSERT INTO users (id, name, email, password, role, avatar) 
         VALUES (3, 'Тестовый Пользователь', 'user@example.com', $1, 'user', '/uploads/default-avatar.png')
         ON CONFLICT (id) DO NOTHING`,
        [hashedUserPassword]
    );
    
    console.log('✅ PostgreSQL база данных готова!');
}

module.exports = { query, get, run, all, initDb, pool };