const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ========== ФАЙЛЫ ==========
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');
const GROUP_MESSAGES_FILE = path.join(__dirname, 'group-messages.json');

// Инициализация файлов
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, '[]');
if (!fs.existsSync(GROUP_MESSAGES_FILE)) fs.writeFileSync(GROUP_MESSAGES_FILE, '[]');

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE));
let groups = JSON.parse(fs.readFileSync(GROUPS_FILE));
let groupMessages = JSON.parse(fs.readFileSync(GROUP_MESSAGES_FILE));

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveMessages() {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function saveGroups() {
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

function saveGroupMessages() {
    fs.writeFileSync(GROUP_MESSAGES_FILE, JSON.stringify(groupMessages, null, 2));
}

// ========== HTTP СЕРВЕР ==========
const server = http.createServer((req, res) => {
    const url = req.url;
    
    // Статические файлы
    if (url === '/' || url === '/index.html') serveFile('index.html', res);
    else if (url === '/login.html') serveFile('login.html', res);
    else if (url === '/register.html') serveFile('register.html', res);
    
    // API
    else if (url === '/api/register' && req.method === 'POST') handleRegister(req, res);
    else if (url === '/api/login' && req.method === 'POST') handleLogin(req, res);
    else if (url === '/api/users' && req.method === 'GET') handleGetUsers(req, res);
    else if (url.startsWith('/api/messages/') && req.method === 'GET') handleGetMessages(req, res);
    else if (url === '/api/groups' && req.method === 'POST') handleCreateGroup(req, res);
    else if (url === '/api/groups' && req.method === 'GET') handleGetUserGroups(req, res);
    else if (url.startsWith('/api/groups/') && req.method === 'POST') handleAddToGroup(req, res);
    else if (url.startsWith('/api/group-messages/') && req.method === 'GET') handleGetGroupMessages(req, res);
    else {
        res.writeHead(404);
        res.end('Not found');
    }
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

// ========== СОЗДАНИЕ ГРУППЫ ==========
function handleCreateGroup(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { name, creatorId, members } = JSON.parse(body);
            
            const group = {
                id: uuidv4(),
                name: name,
                creator: creatorId,
                members: [creatorId, ...(members || [])],
                createdAt: new Date().toISOString(),
                avatar: '👥'
            };
            
            groups.push(group);
            saveGroups();
            
            // Оповещаем всех участников, КРОМЕ создателя
            const groupCreatedMessage = JSON.stringify({
                type: 'group_created',
                group: group
            });
            
            wss.clients.forEach(client => {
                const user = onlineUsers.get(client);
                if (user && group.members.includes(user.id) && user.id !== creatorId && client.readyState === WebSocket.OPEN) {
                    client.send(groupCreatedMessage);
                }
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, group }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Ошибка создания группы' }));
        }
    });
}

// ========== ПОЛУЧИТЬ ГРУППЫ ПОЛЬЗОВАТЕЛЯ ==========
function handleGetUserGroups(req, res) {
    const userId = req.url.split('?userId=')[1];
    if (!userId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'userId required' }));
        return;
    }
    
    console.log('📋 Запрос групп для userId:', userId);
    const userGroups = groups.filter(group => 
        group.members.includes(userId)
    );
    console.log('📤 Отправляем группы:', userGroups.length);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(userGroups));
}

// ========== ДОБАВИТЬ УЧАСТНИКА В ГРУППУ ==========
function handleAddToGroup(req, res) {
    const parts = req.url.split('/');
    const groupId = parts[3];
    let body = '';
    
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { userId } = JSON.parse(body);
            const group = groups.find(g => g.id === groupId);
            
            if (!group) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Group not found' }));
                return;
            }
            
            if (!group.members.includes(userId)) {
                group.members.push(userId);
                saveGroups();
                
                const groupUpdateMessage = JSON.stringify({
                    type: 'group_updated',
                    group: group
                });
                
                wss.clients.forEach(client => {
                    const user = onlineUsers.get(client);
                    if (user && user.id === userId && client.readyState === WebSocket.OPEN) {
                        client.send(groupUpdateMessage);
                    }
                });
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, group }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Failed to add member' }));
        }
    });
}

// ========== ПОЛУЧИТЬ СООБЩЕНИЯ ГРУППЫ ==========
function handleGetGroupMessages(req, res) {
    const groupId = req.url.split('/')[3];
    const chatMessages = groupMessages.filter(m => m.groupId === groupId);
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
                    case 'group_message':
                        handleGroupMessage(ws, message);
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
    
    if (!fromUser || !toUserId || !text) return;
    
    console.log(`✉️ ${fromUser.username} → ${toUserId}: ${text}`);
    
    const msg = {
        id: uuidv4(),
        from: fromUser.id,
        to: toUserId,
        text: text,
        timestamp: new Date().toISOString(),
        fromUser: {
            id: fromUser.id,
            username: fromUser.username
        }
    };
    
    messages.push(msg);
    saveMessages();
    
    ws.send(JSON.stringify({
        type: 'private_message',
        message: msg
    }));
    
    for (let [client, user] of onlineUsers.entries()) {
        if (user.id === toUserId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'private_message',
                message: msg
            }));
            break;
        }
    }
}

// ===== ОТПРАВКА СООБЩЕНИЯ В ГРУППУ =====
function handleGroupMessage(ws, message) {
    const fromUser = onlineUsers.get(ws);
    const { groupId, text, tempId } = message;
    
    if (!fromUser || !groupId || !text) return;
    
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members.includes(fromUser.id)) return;
    
    console.log(`👥 ${fromUser.username} → группа ${group.name}: ${text}`);
    
    const msg = {
        id: uuidv4(),
        groupId,
        from: fromUser.id,
        fromUser: { id: fromUser.id, username: fromUser.username },
        text,
        timestamp: new Date().toISOString(),
        tempId: tempId
    };
    
    groupMessages.push(msg);
    saveGroupMessages();
    
    wss.clients.forEach(client => {
        const user = onlineUsers.get(client);
        if (user && group.members.includes(user.id) && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'group_message',
                message: msg
            }));
        }
    });
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
    👥 Групп: ${groups.length}
    
    ✅ Сервер готов к работе!
    ====================================
    `);
});

process.on('SIGINT', () => {
    users.forEach(u => { u.status = 'offline'; });
    saveUsers();
    process.exit();
});