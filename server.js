const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ (только один раз!)
// ============================================
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'expert_service',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Функции для работы с БД
async function query(sql, params = []) {
    const [rows] = await promisePool.execute(sql, params);
    return rows;
}

async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

async function run(sql, params = []) {
    const [result] = await promisePool.execute(sql, params);
    return { lastID: result.insertId };
}

async function all(sql, params = []) {
    return await query(sql, params);
}

// ============================================
// НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ
// ============================================
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Только изображения'));
    }
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Сессии (хранилище в памяти для Render)
const sessionStore = new session.MemoryStore();
app.use(session({
    secret: process.env.SESSION_SECRET || 'expert-service-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Middleware для проверки авторизации
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Не авторизован' });
}

function isAdmin(req, res, next) {
    if (req.session.userId && req.session.role === 'admin') return next();
    res.status(403).json({ error: 'Доступ запрещён' });
}

function isMaster(req, res, next) {
    if (req.session.userId && (req.session.role === 'master' || req.session.role === 'admin')) return next();
    res.status(403).json({ error: 'Доступ запрещён' });
}

// ============================================
// GigaChat AI
// ============================================

let gigachatToken = null;
let tokenExpiresAt = null;

async function getGigaChatToken() {
    if (gigachatToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
        return gigachatToken;
    }
    
    try {
        const authKey = process.env.GIGACHAT_AUTH_KEY;
        
        if (!authKey) {
            console.log('⚠️ Нет Authorization Key, используем fallback');
            return null;
        }
        
        const response = await axios.post('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', 
            'scope=GIGACHAT_API_PERS', {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'RqUID': crypto.randomUUID(),
                    'Authorization': `Basic ${authKey}`
                },
                timeout: 10000
            }
        );
        
        gigachatToken = response.data.access_token;
        tokenExpiresAt = Date.now() + 25 * 60 * 1000;
        console.log('✅ GigaChat токен получен');
        return gigachatToken;
    } catch (error) {
        console.error('❌ GigaChat token error:', error.message);
        return null;
    }
}

async function askGigaChat(message) {
    try {
        const token = await getGigaChatToken();
        if (!token) return null;
        
        const response = await axios.post('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            model: "GigaChat",
            messages: [
                {
                    role: "system",
                    content: `Ты - дружелюбный AI помощник сервисного центра "Эксперт Сервис" в Оренбурге.
Отвечай на вопросы пользователя вежливо, развернуто и с эмодзи.
Цены: ремонт холодильников от 1500₽, стиральных машин от 1800₽, телевизоров от 1200₽.
Контакты: +7 (3532) 61-11-38, +7 (3532) 22-06-66
Режим работы: ПН-ПТ 10:00-19:00, СБ 10:00-15:00`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            timeout: 15000
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ GigaChat error:', error.message);
        return null;
    }
}

function getFallbackResponse(message) {
    const m = message.toLowerCase();
    
    if (m.match(/привет|здравствуй|добрый день|hi|hello/i)) {
        return '👋 Здравствуйте! Я AI помощник сервисного центра "Эксперт Сервис". Чем могу помочь? 😊';
    }
    
    if (m.includes('цен') || m.includes('стоит') || m.includes('сколько')) {
        if (m.includes('холодильник')) return '💰 Ремонт холодильников от 1500₽. Бесплатная диагностика!';
        if (m.includes('стиральн')) return '💰 Ремонт стиральных машин от 1800₽. Бесплатная диагностика!';
        if (m.includes('телевизор')) return '💰 Ремонт телевизоров от 1200₽. Выезд мастера бесплатно!';
        return '💰 Позвоните для точной цены: +7 (3532) 61-11-38';
    }
    
    if (m.includes('телефон') || m.includes('позвонить')) {
        return '📞 Наши телефоны: +7 (3532) 61-11-38, +7 (3532) 22-06-66';
    }
    
    if (m.includes('адрес')) {
        return '📍 г. Оренбург, ул. Терешкова, 134а. Выезжаем по всему городу!';
    }
    
    if (m.includes('работ') || m.includes('график')) {
        return '🕒 ПН-ПТ 10:00-19:00, СБ 10:00-15:00, ВС выходной';
    }
    
    return '🤔 Задайте вопрос про ремонт техники, цены или контакты, и я помогу! 😊';
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    console.log('📨 Вопрос:', message.substring(0, 100));
    
    let aiResponse = await askGigaChat(message);
    if (!aiResponse) {
        aiResponse = getFallbackResponse(message);
    }
    
    res.json({ response: aiResponse });
});

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/register', async (req, res) => {
    const { name, email, password, role = 'user' } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    try {
        const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Email уже существует' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await run(
            'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, null]
        );
        res.json({ id: result.lastID, message: 'Регистрация успешна' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.userName = user.name;
        
        res.json({
            role: user.role,
            name: user.name,
            avatar: user.avatar || '/uploads/default-avatar.png'
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Выход выполнен' });
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    
    try {
        const user = await get('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [req.session.userId]);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({
            ...user,
            avatar: user.avatar || '/uploads/default-avatar.png'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// PROFILE UPDATE
// ============================================
app.put('/api/profile', isAuthenticated, upload.single('avatar'), async (req, res) => {
    const { name, currentPassword, newPassword } = req.body;
    const userId = req.session.userId;
    
    try {
        const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
        
        let updateFields = [];
        let updateValues = [];
        
        if (name && name !== user.name) {
            updateFields.push('name = ?');
            updateValues.push(name);
            req.session.userName = name;
        }
        
        if (currentPassword && newPassword) {
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                return res.status(400).json({ error: 'Текущий пароль неверен' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateFields.push('password = ?');
            updateValues.push(hashedPassword);
        }
        
        if (req.file) {
            updateFields.push('avatar = ?');
            updateValues.push('/uploads/' + req.file.filename);
        }
        
        if (updateFields.length > 0) {
            updateValues.push(userId);
            await run(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
        
        const updatedUser = await get('SELECT id, name, email, role, avatar FROM users WHERE id = ?', [userId]);
        
        res.json({
            ...updatedUser,
            avatar: updatedUser.avatar || '/uploads/default-avatar.png'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// REQUESTS
// ============================================
app.post('/api/requests', isAuthenticated, async (req, res) => {
    const { name, phone, service, description, address, date } = req.body;
    const userId = req.session.userId;
    
    if (!name || !phone || !service) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
    }
    
    try {
        const result = await run(
            `INSERT INTO requests (user_id, name, phone, service, description, address, preferred_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, phone, service, description || '', address || '', date || '', 'new']
        );
        res.json({ id: result.lastID, message: 'Заявка успешно отправлена!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/requests', isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    const role = req.session.role;
    
    let sql = `
        SELECT r.*, u.name as user_name 
        FROM requests r
        LEFT JOIN users u ON r.user_id = u.id
    `;
    let params = [];
    
    if (role === 'user') {
        sql += ' WHERE r.user_id = ?';
        params.push(userId);
    }
    
    sql += ' ORDER BY r.created_at DESC';
    
    try {
        const rows = await all(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/requests/:id/status', isMaster, async (req, res) => {
    const { status } = req.body;
    const requestId = req.params.id;
    
    const validStatuses = ['new', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Неверный статус' });
    }
    
    try {
        await run('UPDATE requests SET status = ? WHERE id = ?', [status, requestId]);
        res.json({ message: 'Статус обновлён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// REVIEWS
// ============================================
app.get('/api/reviews', async (req, res) => {
    try {
        const rows = await all('SELECT * FROM reviews ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reviews', isAuthenticated, async (req, res) => {
    const { rating, comment } = req.body;
    const userId = req.session.userId;
    const userName = req.session.userName;
    
    if (!comment) {
        return res.status(400).json({ error: 'Напишите отзыв' });
    }
    
    try {
        const result = await run(
            'INSERT INTO reviews (user_id, user_name, rating, comment) VALUES (?, ?, ?, ?)',
            [userId, userName, rating || 5, comment]
        );
        res.json({ id: result.lastID, message: 'Спасибо за отзыв!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/reviews/:id/response', isMaster, async (req, res) => {
    const { response } = req.body;
    const reviewId = req.params.id;
    
    try {
        await run('UPDATE reviews SET master_response = ? WHERE id = ?', [response, reviewId]);
        res.json({ message: 'Ответ добавлен' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// SERVICES, NEWS, VACANCIES, PHOTOS
// ============================================
app.get('/api/services', async (req, res) => {
    try {
        const rows = await all('SELECT * FROM services ORDER BY id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/news', async (req, res) => {
    try {
        const rows = await all('SELECT * FROM news ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vacancies', async (req, res) => {
    try {
        const rows = await all('SELECT * FROM vacancies ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/photos', async (req, res) => {
    try {
        const rows = await all('SELECT * FROM photos ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const rows = await all('SELECT id, name, email, role, avatar, created_at FROM users');
        const usersWithAvatar = rows.map(user => ({
            ...user,
            avatar: user.avatar || '/uploads/default-avatar.png'
        }));
        res.json(usersWithAvatar);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/role', isAdmin, async (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;
    
    if (!['admin', 'master', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Неверная роль' });
    }
    
    try {
        await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        res.json({ message: 'Роль обновлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    const userId = req.params.id;
    
    if (userId == req.session.userId) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    
    try {
        await run('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/services', isAdmin, upload.single('image'), async (req, res) => {
    const { name, description, price } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    
    try {
        const result = await run(
            'INSERT INTO services (name, description, price, image) VALUES (?, ?, ?, ?)',
            [name, description || '', price || 0, image]
        );
        res.json({ id: result.lastID, message: 'Услуга добавлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/services/:id', isAdmin, upload.single('image'), async (req, res) => {
    const { name, description, price } = req.body;
    const id = req.params.id;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    
    let sql = 'UPDATE services SET name = ?, description = ?, price = ?';
    let params = [name, description || '', price || 0];
    
    if (image) {
        sql += ', image = ?';
        params.push(image);
    }
    
    sql += ' WHERE id = ?';
    params.push(id);
    
    try {
        await run(sql, params);
        res.json({ message: 'Услуга обновлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/services/:id', isAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        await run('DELETE FROM services WHERE id = ?', [id]);
        res.json({ message: 'Услуга удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/news', isAdmin, async (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Заголовок и содержание обязательны' });
    }
    
    try {
        const result = await run('INSERT INTO news (title, content) VALUES (?, ?)', [title, content]);
        res.json({ id: result.lastID, message: 'Новость добавлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/news/:id', isAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        await run('DELETE FROM news WHERE id = ?', [id]);
        res.json({ message: 'Новость удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/vacancies', isAdmin, async (req, res) => {
    const { title, description, requirements, salary } = req.body;
    
    if (!title || !description) {
        return res.status(400).json({ error: 'Название и описание обязательны' });
    }
    
    try {
        const result = await run(
            'INSERT INTO vacancies (title, description, requirements, salary) VALUES (?, ?, ?, ?)',
            [title, description, requirements || '', salary || 'договорная']
        );
        res.json({ id: result.lastID, message: 'Вакансия добавлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/vacancies/:id', isAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        await run('DELETE FROM vacancies WHERE id = ?', [id]);
        res.json({ message: 'Вакансия удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/photos', isAdmin, upload.single('image'), async (req, res) => {
    const { title } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    
    if (!image) {
        return res.status(400).json({ error: 'Изображение обязательно' });
    }
    
    try {
        const result = await run('INSERT INTO photos (title, image) VALUES (?, ?)', [title || '', image]);
        res.json({ id: result.lastID, message: 'Фото добавлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/photos/:id', isAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        await run('DELETE FROM photos WHERE id = ?', [id]);
        res.json({ message: 'Фото удалено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/photos/:id', isAdmin, async (req, res) => {
    const { title } = req.body;
    const id = req.params.id;
    try {
        await run('UPDATE photos SET title = ? WHERE id = ?', [title, id]);
        res.json({ message: 'Название обновлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DASHBOARDS
// ============================================
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public/admin-dashboard.html'));
});

app.get('/master/dashboard', (req, res) => {
    if (!req.session.userId || (req.session.role !== 'master' && req.session.role !== 'admin')) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public/master-dashboard.html'));
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ И ЗАПУСК
// ============================================

async function initDb() {
    console.log('🔄 Инициализация базы данных...');
    
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('user', 'master', 'admin') DEFAULT 'user',
            avatar VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS services (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) DEFAULT 0,
            image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS requests (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            service VARCHAR(100) NOT NULL,
            description TEXT,
            address VARCHAR(255),
            preferred_date VARCHAR(50),
            status ENUM('new', 'in_progress', 'completed', 'cancelled') DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS reviews (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT,
            user_name VARCHAR(100) NOT NULL,
            rating INT DEFAULT 5,
            comment TEXT NOT NULL,
            master_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS news (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            image VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS vacancies (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            requirements TEXT,
            salary VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS photos (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(200),
            image VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS chat_logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT,
            user_message TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            intent VARCHAR(50),
            rating INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];
    
    for (const sql of tables) {
        try {
            await query(sql);
        } catch (err) {
            console.error('Ошибка создания таблицы:', err.message);
        }
    }
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await query(
        `INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
         VALUES (1, 'Администратор', 'admin@example.com', ?, 'admin', '/uploads/default-avatar.png')`,
        [hashedPassword]
    );
    
    const hashedMasterPassword = await bcrypt.hash('master123', 10);
    await query(
        `INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
         VALUES (2, 'Иван Мастеров', 'master@example.com', ?, 'master', '/uploads/default-avatar.png')`,
        [hashedMasterPassword]
    );
    
    const hashedUserPassword = await bcrypt.hash('user123', 10);
    await query(
        `INSERT IGNORE INTO users (id, name, email, password, role, avatar) 
         VALUES (3, 'Тестовый Пользователь', 'user@example.com', ?, 'user', '/uploads/default-avatar.png')`,
        [hashedUserPassword]
    );
    
    console.log('✅ База данных готова!');
}

// Запуск
initDb().catch(console.error);

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
    console.log('\n📝 Учётные данные:');
    console.log('   👑 Администратор: admin@example.com / admin123');
    console.log('   🔧 Мастер: master@example.com / master123');
    console.log('   👤 Пользователь: user@example.com / user123');
});