const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Настройки подключения к MySQL
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expert_service',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log('🔌 Подключение к MySQL с параметрами:');
console.log(`   Хост: ${mysqlConfig.host}`);
console.log(`   Пользователь: ${mysqlConfig.user}`);
console.log(`   Пароль: ${mysqlConfig.password ? '***' : '(пустой)'}`);
console.log(`   База данных: ${mysqlConfig.database}\n`);

// Подключение к SQLite
const sqliteDb = new sqlite3.Database(path.join(__dirname, 'service.db'));

// Подключение к MySQL
const mysqlPool = mysql.createPool(mysqlConfig);
const mysqlDb = mysqlPool.promise();

// Проверка подключения к MySQL
async function testConnection() {
    try {
        const connection = await mysqlDb.getConnection();
        console.log('✅ Подключение к MySQL установлено\n');
        connection.release();
        return true;
    } catch (err) {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
        console.log('\nВозможные решения:');
        console.log('1. Убедитесь, что MySQL сервер запущен');
        console.log('2. Проверьте пароль в файле .env');
        console.log('3. Для XAMPP пароль по умолчанию пустой');
        console.log('4. Создайте базу данных: CREATE DATABASE expert_service;\n');
        return false;
    }
}

// Функция для копирования данных
async function migrateData() {
    console.log('🚀 Начинаем миграцию данных из SQLite в MySQL...\n');
    
    // Проверяем подключение
    const connected = await testConnection();
    if (!connected) {
        process.exit(1);
    }
    
    try {
        // 1. Создаем базу данных если её нет
        try {
            await mysqlDb.execute(`CREATE DATABASE IF NOT EXISTS ${mysqlConfig.database}`);
            await mysqlDb.execute(`USE ${mysqlConfig.database}`);
            console.log(`✅ База данных ${mysqlConfig.database} создана или уже существует\n`);
        } catch (err) {
            console.log('База данных уже существует или ошибка:', err.message);
        }
        
        // 2. Создаем таблицы
        console.log('📋 Создание таблиц в MySQL...');
        
        await mysqlDb.execute(`
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
        
        await mysqlDb.execute(`
            CREATE TABLE IF NOT EXISTS services (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) DEFAULT 0,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await mysqlDb.execute(`
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
        
        await mysqlDb.execute(`
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
        
        await mysqlDb.execute(`
            CREATE TABLE IF NOT EXISTS news (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await mysqlDb.execute(`
            CREATE TABLE IF NOT EXISTS vacancies (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                requirements TEXT,
                salary VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await mysqlDb.execute(`
            CREATE TABLE IF NOT EXISTS photos (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(200),
                image VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await mysqlDb.execute(`
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
        
        await mysqlDb.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                \`key\` VARCHAR(100) UNIQUE NOT NULL,
                \`value\` TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Таблицы созданы\n');
        
        // 3. Перенос пользователей
        console.log('👥 Перенос пользователей...');
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const user of users) {
            let password = user.password;
            if (!password.startsWith('$2')) {
                password = await bcrypt.hash(password, 10);
            }
            
            await mysqlDb.execute(
                `INSERT IGNORE INTO users (id, name, email, password, role, avatar, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.name, user.email, password, user.role, user.avatar, user.created_at]
            );
        }
        console.log(`✅ Перенесено ${users.length} пользователей\n`);
        
        // 4. Перенос услуг
        console.log('🔧 Перенос услуг...');
        const services = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM services', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const service of services) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO services (id, name, description, price, image, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [service.id, service.name, service.description, service.price, service.image, service.created_at]
            );
        }
        console.log(`✅ Перенесено ${services.length} услуг\n`);
        
        // 5. Перенос заявок
        console.log('📋 Перенос заявок...');
        const requests = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM requests', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const request of requests) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO requests (id, user_id, name, phone, service, description, address, preferred_date, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [request.id, request.user_id, request.name, request.phone, request.service, 
                 request.description, request.address, request.preferred_date, request.status, request.created_at]
            );
        }
        console.log(`✅ Перенесено ${requests.length} заявок\n`);
        
        // 6. Перенос отзывов
        console.log('⭐ Перенос отзывов...');
        const reviews = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM reviews', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const review of reviews) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO reviews (id, user_id, user_name, rating, comment, master_response, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [review.id, review.user_id, review.user_name, review.rating, review.comment, review.master_response, review.created_at]
            );
        }
        console.log(`✅ Перенесено ${reviews.length} отзывов\n`);
        
        // 7. Перенос новостей
        console.log('📰 Перенос новостей...');
        const news = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM news', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const item of news) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO news (id, title, content, image, created_at) 
                 VALUES (?, ?, ?, ?, ?)`,
                [item.id, item.title, item.content, item.image, item.created_at]
            );
        }
        console.log(`✅ Перенесено ${news.length} новостей\n`);
        
        // 8. Перенос вакансий
        console.log('💼 Перенос вакансий...');
        const vacancies = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM vacancies', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const vacancy of vacancies) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO vacancies (id, title, description, requirements, salary, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [vacancy.id, vacancy.title, vacancy.description, vacancy.requirements, vacancy.salary, vacancy.created_at]
            );
        }
        console.log(`✅ Перенесено ${vacancies.length} вакансий\n`);
        
        // 9. Перенос фотографий
        console.log('🖼️ Перенос фотографий...');
        const photos = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM photos', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const photo of photos) {
            await mysqlDb.execute(
                `INSERT IGNORE INTO photos (id, title, image, created_at) 
                 VALUES (?, ?, ?, ?)`,
                [photo.id, photo.title, photo.image, photo.created_at]
            );
        }
        console.log(`✅ Перенесено ${photos.length} фотографий\n`);
        
        // 10. Перенос диалогов AI
        console.log('🤖 Перенос диалогов AI...');
        try {
            const chatLogs = await new Promise((resolve, reject) => {
                sqliteDb.all('SELECT * FROM chat_logs', (err, rows) => {
                    if (err) resolve([]);
                    else resolve(rows);
                });
            });
            
            for (const log of chatLogs) {
                await mysqlDb.execute(
                    `INSERT IGNORE INTO chat_logs (id, user_id, user_message, bot_response, intent, rating, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [log.id, log.user_id, log.user_message, log.bot_response, log.intent, log.rating, log.created_at]
                );
            }
            console.log(`✅ Перенесено ${chatLogs.length} диалогов AI\n`);
        } catch (err) {
            console.log('ℹ️ Таблица chat_logs не найдена или пуста\n');
        }
        
        // 11. Добавление настроек
        console.log('⚙️ Добавление настроек...');
        await mysqlDb.execute(
            `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('ai_enabled', 'true')`
        );
        await mysqlDb.execute(
            `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('ai_model', 'llama3.2')`
        );
        await mysqlDb.execute(
            `INSERT IGNORE INTO settings (\`key\`, \`value\') VALUES ('ai_endpoint', 'http://localhost:11434')`
        );
        console.log('✅ Настройки добавлены\n');
        
        console.log('\n✅ МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!');
        console.log('📊 Итоги:');
        console.log(`   👥 Пользователей: ${users.length}`);
        console.log(`   🔧 Услуг: ${services.length}`);
        console.log(`   📋 Заявок: ${requests.length}`);
        console.log(`   ⭐ Отзывов: ${reviews.length}`);
        console.log(`   📰 Новостей: ${news.length}`);
        console.log(`   💼 Вакансий: ${vacancies.length}`);
        console.log(`   🖼️ Фотографий: ${photos.length}`);
        
    } catch (err) {
        console.error('❌ Ошибка при миграции:', err);
    } finally {
        // Закрываем соединения
        sqliteDb.close();
        await mysqlDb.end();
        console.log('\n📌 Миграция завершена. Теперь можно запустить сервер командой: node server.js');
    }
}

// Запуск миграции
migrateData();