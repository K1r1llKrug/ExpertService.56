// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (СНАЧАЛА)
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================
// АВТОРИЗАЦИЯ И ПРОФИЛЬ
// ============================================

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const user = await res.json();
            const userMenu = document.getElementById('userMenu');
            if (userMenu) {
                userMenu.innerHTML = `
                    <div class="user-menu">
                        <img src="${user.avatar || '/uploads/default-avatar.png'}" class="avatar-small" onerror="this.src='/uploads/default-avatar.png'">
                        <span>${escapeHtml(user.name)}</span>
                        <div class="user-dropdown">
                            <a href="/profile.html"><i class="fas fa-user"></i> Профиль</a>
                            ${user.role === 'admin' ? '<a href="/admin/dashboard"><i class="fas fa-cog"></i> Админ-панель</a>' : ''}
                            ${user.role === 'master' ? '<a href="/master/dashboard"><i class="fas fa-tools"></i> Панель мастера</a>' : ''}
                            <a href="#" onclick="event.preventDefault(); logout()"><i class="fas fa-sign-out-alt"></i> Выйти</a>
                        </div>
                    </div>
                `;
            }
        } else {
            const userMenu = document.getElementById('userMenu');
            if (userMenu) {
                userMenu.innerHTML = `<a href="/login.html" class="login-btn"><i class="fas fa-sign-in-alt"></i> Войти</a>`;
            }
        }
    } catch (err) {
        console.error('Auth error:', err);
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

// ============================================
// ЗАГРУЗКА УСЛУГ И ОТЗЫВОВ
// ============================================

async function loadServices() {
    try {
        const res = await fetch('/api/services');
        const services = await res.json();
        const container = document.getElementById('popularServices');
        if (container && services.length) {
            container.innerHTML = services.slice(0, 4).map(s => `
                <div class="service-card">
                    ${s.image ? `<img src="${s.image}" class="service-image" onerror="this.style.display='none'">` : '<div class="service-image" style="background:#e0e0e0;display:flex;align-items:center;justify-content:center"><i class="fas fa-tools" style="font-size:48px;color:#999"></i></div>'}
                    <h3>${escapeHtml(s.name)}</h3>
                    <p>${escapeHtml(s.description || '')}</p>
                    <div class="price">от ${s.price} ₽</div>
                    <button onclick="openRequestModal('${escapeHtml(s.name)}')" class="btn-secondary">Заказать</button>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load services:', err);
    }
}

async function loadReviews() {
    try {
        const res = await fetch('/api/reviews');
        const reviews = await res.json();
        const container = document.getElementById('reviewsList');
        if (container && reviews.length) {
            container.innerHTML = reviews.slice(0, 3).map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <strong>${escapeHtml(r.user_name)}</strong>
                        <div class="rating">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                    </div>
                    <p>${escapeHtml(r.comment)}</p>
                    <small>${new Date(r.created_at).toLocaleDateString()}</small>
                    ${r.master_response ? `<div class="master-response"><strong>Ответ мастера:</strong><p>${escapeHtml(r.master_response)}</p></div>` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

async function loadNews() {
    try {
        const res = await fetch('/api/news');
        const news = await res.json();
        const container = document.getElementById('newsList');
        if (container && news.length) {
            container.innerHTML = news.map(n => `
                <div class="news-card">
                    <h3>${escapeHtml(n.title)}</h3>
                    <p>${escapeHtml(n.content)}</p>
                    <small>${new Date(n.created_at).toLocaleDateString()}</small>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load news:', err);
    }
}

async function loadVacancies() {
    try {
        const res = await fetch('/api/vacancies');
        const vacancies = await res.json();
        const container = document.getElementById('vacanciesList');
        if (container && vacancies.length) {
            container.innerHTML = vacancies.map(v => `
                <div class="vacancy-card">
                    <h3>${escapeHtml(v.title)}</h3>
                    <p>${escapeHtml(v.description)}</p>
                    <p><strong>Зарплата:</strong> ${escapeHtml(v.salary || 'договорная')}</p>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load vacancies:', err);
    }
}

async function loadGallery() {
    try {
        const res = await fetch('/api/photos');
        const photos = await res.json();
        const container = document.getElementById('galleryList');
        if (container && photos.length) {
            container.innerHTML = photos.map(p => `
                <div class="gallery-item">
                    <img src="${p.image}" alt="${escapeHtml(p.title || 'Фото')}" onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    <div class="gallery-caption">${escapeHtml(p.title || '')}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load gallery:', err);
    }
}

async function loadServicesTable() {
    try {
        const res = await fetch('/api/services');
        const services = await res.json();
        const container = document.getElementById('servicesTable');
        if (container) {
            container.innerHTML = services.map(s => `
                <tr>
                    <td>${escapeHtml(s.name)}</td>
                    <td>${Math.round(s.price * 0.4)} ₽</td>
                    <td>${s.price} ₽</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load services table:', err);
    }
}

// ============================================
// ЗАЯВКИ
// ============================================

function openRequestModal(serviceName = '') {
    const modal = document.getElementById('requestModal');
    if (modal) {
        if (serviceName) {
            const select = document.getElementById('reqService');
            if (select) select.value = serviceName;
        }
        modal.style.display = 'block';
    }
}

async function submitRequest(e) {
    e.preventDefault();
    const name = document.getElementById('reqName').value;
    const phone = document.getElementById('reqPhone').value;
    const service = document.getElementById('reqService').value;
    const address = document.getElementById('reqAddress')?.value || '';
    const date = document.getElementById('reqDate')?.value || '';
    const description = document.getElementById('reqDesc')?.value || '';
    
    if (!name || !phone || !service) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    
    try {
        const res = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, service, address, date, description })
        });
        
        if (res.ok) {
            alert('Заявка успешно отправлена!');
            document.getElementById('requestModal').style.display = 'none';
            e.target.reset();
        } else {
            const err = await res.json();
            alert('Ошибка: ' + err.error);
        }
    } catch (err) {
        alert('Ошибка отправки');
    }
}

// ============================================
// ОТЗЫВЫ (ФОРМА)
// ============================================

async function submitReview(e) {
    e.preventDefault();
    const rating = document.querySelector('input[name="rating"]:checked');
    const comment = document.getElementById('reviewComment').value;
    
    if (!comment) {
        alert('Пожалуйста, напишите отзыв');
        return;
    }
    
    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: rating ? parseInt(rating.value) : 5, comment })
        });
        
        if (res.ok) {
            alert('Спасибо за отзыв!');
            location.reload();
        } else {
            const err = await res.json();
            alert('Ошибка: ' + err.error);
        }
    } catch (err) {
        alert('Ошибка отправки отзыва');
    }
}

// ============================================
// AI-ПОМОЩНИК (ЧАТ-БОТ)
// ============================================

let isWaiting = false;
let currentUserId = null;

async function getCurrentUserId() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const user = await res.json();
            return user.id;
        }
    } catch(e) {}
    return null;
}

async function saveChatLog(userMessage, botResponse, intent = 'general', rating = null) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    try {
        await fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_message: userMessage,
                bot_response: botResponse,
                intent: intent,
                rating: rating
            })
        });
        console.log('✅ Диалог сохранён');
    } catch(e) {
        console.error('Ошибка сохранения диалога:', e);
    }
}

function toggleChat() {
    const win = document.getElementById('chatWindow');
    if (win) {
        win.style.display = win.style.display === 'flex' ? 'none' : 'flex';
        if (win.style.display === 'flex') {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }
    }
}

function addMessage(text, isUser = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    div.innerHTML = text.replace(/\n/g, '<br>');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.id = 'typingIndicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

async function sendMessage() {
    if (isWaiting) return;
    
    const input = document.getElementById('chatInput');
    const message = input?.value.trim();
    if (!message) return;
    
    addMessage(message, true);
    if (input) input.value = '';
    isWaiting = true;
    showTyping();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        if (response.ok) {
            const data = await response.json();
            const botResponse = data.response;
            hideTyping();
            addMessage(botResponse);
            await saveChatLog(message, botResponse);
        } else {
            throw new Error('API error');
        }
    } catch (error) {
        console.error('Error:', error);
        hideTyping();
        
        const answers = {
            'цена': '💰 Ремонт стиральных машин от 1500₽, холодильников от 2000₽. Бесплатная диагностика!',
            'гарантия': '✅ Гарантия до 1 года на все работы!',
            'телефон': '📞 +7 (3532) 61-11-38 или +7 (3532) 22-06-66',
            'адрес': '📍 Выезжаем по всему Оренбургу, мастер приедет в день обращения',
            'работа': '🕒 ПН-ПТ 10:00-19:00, СБ 10:00-15:00, ВС выходной',
            'ремонт': '🔧 Ремонтируем холодильники, стиральные машины, телевизоры, кофемашины'
        };
        
        let fallbackResponse = '🤔 Позвоните нам для консультации: +7 (3532) 61-11-38';
        for (const [key, value] of Object.entries(answers)) {
            if (message.toLowerCase().includes(key)) {
                fallbackResponse = value;
                break;
            }
        }
        addMessage(fallbackResponse);
        await saveChatLog(message, fallbackResponse);
    } finally {
        isWaiting = false;
    }
}

function createChatWidget() {
    if (document.getElementById('chatWidgetContainer')) return;
    
    const chatHTML = `
        <div id="chatWidgetContainer" class="chat-widget">
            <div class="chat-button" onclick="toggleChat()">
                <i class="fas fa-robot"></i>
            </div>
            <div class="chat-window" id="chatWindow">
                <div class="chat-header">
                    <span>🤖 AI Помощник Эксперт Сервис</span>
                    <span style="cursor:pointer" onclick="toggleChat()">✕</span>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="message bot-message">
                        👋 Здравствуйте! Я AI-помощник сервиса "Эксперт Сервис".<br>
                        Задавайте любые вопросы! 😊
                    </div>
                </div>
                <div class="chat-input-container">
                    <input type="text" id="chatInput" placeholder="Напишите сообщение..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button onclick="sendMessage()">📤 Отправить</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatHTML);
    
    if (!document.getElementById('chatStyles')) {
        const styles = `
            <style id="chatStyles">
                .chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 10000; }
                .chat-button { width: 65px; height: 65px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
                .chat-button:hover { transform: scale(1.1); }
                .chat-button i { color: white; font-size: 28px; }
                .chat-window { position: fixed; bottom: 95px; right: 20px; width: 400px; height: 550px; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; }
                .chat-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
                .chat-messages { flex: 1; padding: 15px; overflow-y: auto; background: #f5f5f5; }
                .chat-input-container { padding: 15px; background: white; border-top: 1px solid #ddd; display: flex; gap: 10px; }
                .chat-input-container input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 25px; outline: none; }
                .chat-input-container button { padding: 12px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 25px; cursor: pointer; }
                .message { margin-bottom: 12px; padding: 10px 14px; border-radius: 18px; max-width: 85%; word-wrap: break-word; }
                .user-message { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-left: auto; border-bottom-right-radius: 5px; }
                .bot-message { background: white; color: #333; margin-right: auto; border-bottom-left-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                .typing { background: white; padding: 10px 14px; border-radius: 18px; display: inline-block; }
                .typing span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #999; margin: 0 2px; animation: typingAnim 1.4s infinite; }
                .typing span:nth-child(2) { animation-delay: 0.2s; }
                .typing span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typingAnim { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-10px); opacity: 1; } }
                @media (max-width: 480px) { .chat-window { width: calc(100% - 40px); height: 500px; } }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// ============================================
// ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализация...');
    
    // Авторизация (всегда)
    checkAuth();
    
    // Чат (всегда)
    createChatWidget();
    getCurrentUserId();
    
    // Загрузка услуг и отзывов только на главной
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        loadServices();
        loadReviews();
        
        // Загрузка услуг в select
        fetch('/api/services')
            .then(res => res.json())
            .then(services => {
                const select = document.getElementById('reqService');
                if (select) {
                    select.innerHTML = '<option value="">Выберите услугу</option>' +
                        services.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
                }
            })
            .catch(err => console.error(err));
        
        // Форма заявки
        const requestForm = document.getElementById('requestForm');
        if (requestForm) {
            requestForm.onsubmit = submitRequest;
        }
        
        // Модальное окно
        const modal = document.getElementById('requestModal');
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        if (modal) {
            window.onclick = (e) => {
                if (e.target == modal) modal.style.display = 'none';
            };
        }
    }
    
    // Другие страницы
    if (window.location.pathname.includes('services.html')) {
        loadServicesTable();
    }
    if (window.location.pathname.includes('news.html')) {
        loadNews();
    }
    if (window.location.pathname.includes('vacancies.html')) {
        loadVacancies();
    }
    if (window.location.pathname.includes('gallery.html')) {
        loadGallery();
    }
    
    // Форма отзыва на странице reviews.html
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.onsubmit = submitReview;
    }
    // ============================================
// РАБОТА МЕНЮ МЫШКОЙ (ЗАПАСНОЙ ВАРИАНТ)
// ============================================

function initDropdownMenu() {
    const userMenu = document.querySelector('.user-menu');
    const userDropdown = document.querySelector('.user-dropdown');
    
    if (!userMenu || !userDropdown) return;
    
    let timeoutId;
    
    userMenu.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        userDropdown.style.opacity = '1';
        userDropdown.style.visibility = 'visible';
    });
    
    userMenu.addEventListener('mouseleave', () => {
        timeoutId = setTimeout(() => {
            userDropdown.style.opacity = '0';
            userDropdown.style.visibility = 'hidden';
        }, 200);
    });
    
    userDropdown.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        userDropdown.style.opacity = '1';
        userDropdown.style.visibility = 'visible';
    });
    
    userDropdown.addEventListener('mouseleave', () => {
        userDropdown.style.opacity = '0';
        userDropdown.style.visibility = 'hidden';
    });
}

// Вызываем после загрузки страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdownMenu);
} else {
    initDropdownMenu();
}

// Также вызываем после обновления меню (когда пользователь залогинился)
const originalCheckAuth = checkAuth;
window.checkAuth = async function() {
    await originalCheckAuth();
    initDropdownMenu();
};
});