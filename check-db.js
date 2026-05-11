const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expert_service'
});

connection.connect((err) => {
    if (err) {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
        console.log('\nВозможные решения:');
        console.log('1. Запустите MySQL сервер (через XAMPP или Services)');
        console.log('2. Проверьте пароль в файле .env');
        console.log('3. Создайте базу данных: CREATE DATABASE expert_service;');
    } else {
        console.log('✅ Подключение к MySQL успешно!');
        
        // Проверяем наличие таблиц
        connection.query('SHOW TABLES', (err, tables) => {
            if (err) console.error(err);
            else {
                console.log(`\n📊 Таблицы в базе данных (${tables.length} шт.):`);
                tables.forEach(table => {
                    console.log(`   - ${Object.values(table)[0]}`);
                });
            }
            connection.end();
        });
    }
});