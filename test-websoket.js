const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/?userId=test&username=test');

ws.on('open', () => {
    console.log('✅ WebSocket работает!');
    ws.send(JSON.stringify({
        type: 'private_message',
        to: 'test',
        text: 'Тест'
    }));
});

ws.on('message', (data) => {
    console.log('📩 Получено сообщение:', data.toString());
});

ws.on('error', (err) => {
    console.log('❌ Ошибка WebSocket:', err.message);
});

setTimeout(() => ws.close(), 3000);
