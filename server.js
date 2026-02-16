const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const multer = require('multer');

// ========== ФАЙЛЫ ==========
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Инициализация файлов
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE));

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveMessages() {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ========== HTTP СЕРВЕР ==========
const server = http.createServer((req, res) => {
    const url = req.url;
    
    // СТАТИЧЕСКИЕ ФАЙЛЫ
    if (url === '/' || url === '/index.html') {
        serveFile('index.html', res);
        return;
    }
    if (url === '/login.html') {
        serveFile('login.html', res);
        return;
    }
    if (url === '/register.html') {
        serveFile('register.html', res);
        return;
    }
    
    // РАЗДАЧА ЗАГРУЖЕННЫХ ФАЙЛОВ
    if (url.startsWith('/uploads/')) {
        const filePath = path.join('/var/www/uploads', path.basename(url));
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error('❌ Файл не найден:', filePath);
                res.writeHead(404);
                return res.end('File not found');
            }
            const ext = path.extname(filePath);
            const contentType = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.pdf': 'application/pdf',
                '.txt': 'text/plain',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            }[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
        return;
    }
    
    // API
    if (url === '/api/register' && req.method === 'POST') {
        handleRegister(req, res);
        return;
    }
    if (url === '/api/login' && req.method === 'POST') {
        handleLogin(req, res);
        return;
    }
    if (url === '/api/users' && req.method === 'GET') {
        handleGetUsers(req, res);
        return;
    }
    if (url.startsWith('/api/messages/') && req.method === 'GET') {
        handleGetMessages(req, res);
        return;
    }
    
    // ЗАГРУЗКА ФАЙЛА
    if (url === '/api/upload' && req.method === 'POST') {
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                const uploadDir = '/var/www/uploads';
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                cb(null, uploadDir);
            },
            filename: function (req, file, cb) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                cb(null, 'file-' + uniqueSuffix + ext);
            }
        });

        // ===== УЛУЧШЕННЫЙ ФИЛЬТР =====
        const fileFilter = (req, file, cb) => {
            console.log('🔍 Проверка файла:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                ext: path.extname(file.originalname)
            });
            
            // Разрешаем ВСЕ изображения
            if (file.mimetype.startsWith('image/')) {
                console.log('✅ Изображение разрешено');
                return cb(null, true);
            }
            
            // Разрешаем текстовые файлы
            if (file.mimetype === 'text/plain') {
                console.log('✅ Текстовый файл разрешён');
                return cb(null, true);
            }
            
            // Разрешаем PDF
            if (file.mimetype === 'application/pdf') {
                console.log('✅ PDF разрешён');
                return cb(null, true);
            }
            
            // Разрешаем документы Word
            if (file.mimetype === 'application/msword' || 
                file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                console.log('✅ Word документ разрешён');
                return cb(null, true);
            }
            
            // Разрешаем по расширению для непонятных случаев
            const allowedExts = /\.(jpeg|jpg|png|gif|pdf|txt|doc|docx)$/i;
            if (allowedExts.test(file.originalname)) {
                console.log('✅ Файл разрешён по расширению');
                return cb(null, true);
            }
            
            console.log('❌ Файл запрещён:', file.mimetype);
            cb(new Error('Неподдерживаемый тип файла. Разрешены: изображения, PDF, документы Word, текстовые файлы'));
        };

        const upload = multer({ 
            storage: storage,
            limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
            fileFilter: fileFilter
        }).single('file');

        upload(req, res, (err) => {
            if (err) {
                console.error('❌ Ошибка загрузки:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
            
            if (!req.file) {
                console.error('❌ Файл не загружен');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Файл не загружен' }));
            }
            
            const fileUrl = `/uploads/${req.file.filename}`;
            
            console.log(`✅ Файл загружен: ${fileUrl} (${req.file.size} bytes)`);
            console.log(`   Оригинальное имя: ${req.file.originalname}`);
            console.log(`   MIME-тип: ${req.file.mimetype}`);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                filename: req.file.filename,
                originalName: req.file.originalname,
                url: fileUrl,
                size: req.file.size,
                mimetype: req.file.mimetype
            }));
        });
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not found');
});

function serveFile(filename, res) {
    fs.readFile(path.join(__dirname, filename), (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading file');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
    });
}

// ========== РЕГИСТРАЦИЯ ==========
async function handleRegister(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { username, password } = JSON.parse(body);
            
            if (!username || !password) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Заполните все поля' }));
                return;
            }
            
            if (users.find(u => u.username === username)) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Пользователь уже существует' }));
                return;
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                id: uuidv4(),
                username,
                password: hashedPassword,
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                status: 'offline'
            };
            
            users.push(user);
            saveUsers();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                userId: user.id, 
                username: user.username 
            }));
            
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Ошибка сервера' }));
        }
    });
}

// ========== ВХОД ==========
async function handleLogin(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { username, password } = JSON.parse(body);
            const user = users.find(u => u.username === username);
            
            if (!user || !(await bcrypt.compare(password, user.password))) {
                res.writeHead(401);
                res.end(JSON.stringify({ error: 'Неверное имя или пароль' }));
                return;
            }
            
            user.lastSeen = new Date().toISOString();
            saveUsers();
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                userId: user.id, 
                username: user.username 
            }));
            
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Ошибка сервера' }));
        }
    });
}

// ========== ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ==========
function handleGetUsers(req, res) {
    const safeUsers = users.map(({ password, ...rest }) => ({
        ...rest,
        status: rest.status || 'offline'
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(safeUsers));
}

// ========== ПОЛУЧИТЬ СООБЩЕНИЯ ==========
function handleGetMessages(req, res) {
    const parts = req.url.split('/');
    const userId = parts[3];
    const withUserId = parts[4];
    
    const chatMessages = messages.filter(m => 
        (m.from === userId && m.to === withUserId) ||
        (m.from === withUserId && m.to === userId)
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(chatMessages));
}

// ========== WEB-SOCKET ==========
const wss = new WebSocket.Server({ server });
const onlineUsers = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔵 Новое WebSocket соединение');
    
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let userId = url.searchParams.get('userId');
        let username = url.searchParams.get('username');
        
        console.log(`📋 Параметры: userId=${userId}, username=${username}`);
        
        if (!userId || !username) {
            console.log('⚠️ Нет параметров, создаем временного пользователя');
            userId = 'temp_' + Date.now();
            username = 'User_' + Math.floor(Math.random() * 1000);
        }
        
        let user = users.find(u => u.id === userId);
        if (!user) {
            user = {
                id: userId,
                username: username,
                status: 'online',
                lastSeen: new Date().toISOString()
            };
            users.push(user);
            saveUsers();
        }
        
        user.status = 'online';
        user.lastSeen = new Date().toISOString();
        saveUsers();
        
        onlineUsers.set(ws, { ...user, ws });
        
        ws.send(JSON.stringify({
            type: 'auth_success',
            user: { id: user.id, username: user.username }
        }));
        
        broadcastOnlineUsers();
        
        console.log(`✅ Пользователь ${user.username} подключился`);
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(`📨 Сообщение от ${user.username}:`, message.type);
                
                switch (message.type) {
                    case 'private_message':
                        handlePrivateMessage(ws, message);
                        break;
                    case 'typing':
                        handleTyping(ws, message);
                        break;
                }
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error);
            }
        });
        
        ws.on('close', () => {
            console.log(`🔴 Пользователь ${user.username} отключился`);
            
            user.status = 'offline';
            user.lastSeen = new Date().toISOString();
            saveUsers();
            
            onlineUsers.delete(ws);
            broadcastOnlineUsers();
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket ошибка:', error);
        });
        
    } catch (error) {
        console.error('Ошибка подключения:', error);
        ws.close();
    }
});

// ===== ОТПРАВКА ПРИВАТНОГО СООБЩЕНИЯ =====
function handlePrivateMessage(ws, message) {
    const fromUser = onlineUsers.get(ws);
    const toUserId = message.to;
    const text = message.text;
    const fileUrl = message.fileUrl;
    const fileName = message.fileName;
    
    console.log('📨 handlePrivateMessage вызван');
    console.log('   from:', fromUser?.username);
    console.log('   to:', toUserId);
    console.log('   text:', text);
    console.log('   fileUrl:', fileUrl);
    console.log('   fileName:', fileName);
    
    if (!fromUser || !toUserId) {
        console.log('❌ Нет отправителя или получателя');
        return;
    }
    
    const msg = {
        id: uuidv4(),
        from: fromUser.id,
        to: toUserId,
        text: text || '',
        fileUrl: fileUrl,
        fileName: fileName,
        timestamp: new Date().toISOString(),
        fromUser: {
            id: fromUser.id,
            username: fromUser.username
        }
    };
    
    messages.push(msg);
    saveMessages();
    
    // Отправляем отправителю
    ws.send(JSON.stringify({ type: 'private_message', message: msg }));
    console.log('✅ Сообщение отправлено отправителю');
    
    // Отправляем получателю
    let sentToReceiver = false;
    onlineUsers.forEach((user, client) => {
        if (user.id === toUserId && client.readyState === WebSocket.OPEN) {
            console.log('📤 Отправка получателю:', user.username);
            client.send(JSON.stringify({ type: 'private_message', message: msg }));
            sentToReceiver = true;
        }
    });
    
    if (!sentToReceiver) {
        console.log('❌ Получатель не в сети или не найден');
    }
}

// ===== ПЕЧАТАЕТ... =====
function handleTyping(ws, message) {
    const fromUser = onlineUsers.get(ws);
    const toUserId = message.to;
    
    if (!fromUser || !toUserId) return;
    
    for (let [client, user] of onlineUsers.entries()) {
        if (user.id === toUserId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'typing',
                from: fromUser.id,
                username: fromUser.username,
                isTyping: message.isTyping
            }));
            break;
        }
    }
}

// ===== РАССЫЛКА ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ =====
function broadcastOnlineUsers() {
    const onlineList = Array.from(onlineUsers.values()).map(user => ({
        id: user.id,
        username: user.username,
        status: 'online',
        lastSeen: new Date().toISOString()
    }));
    
    const message = JSON.stringify({
        type: 'online_users',
        users: onlineList
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ========== ЗАПУСК ==========
const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ====================================
    🚀 МЕССЕНДЖЕР УСПЕШНО ЗАПУЩЕН!
    
    📍 Адрес: http://ваш-сервер:${PORT}
    👥 Пользователей в БД: ${users.length}
    💾 Сообщений в БД: ${messages.length}
    
    ✅ Сервер готов к работе!
    ====================================
    `);
});

process.on('SIGINT', () => {
    users.forEach(u => { u.status = 'offline'; });
    saveUsers();
    process.exit();
});
