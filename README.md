💬 Messenger PRO
Личный мессенджер для общения с друзьями в реальном времени.
Свои аккаунты, личные сообщения, статусы онлайн — всё работает из коробки.

🚀 БЫСТРЫЙ СТАРТ
1. Клонировать репозиторий  
git clone git@github.com:martyvase/messenger-pro.git  
cd messenger-pro  
2. Установить зависимости  
npm install  
3. Запустить сервер  
node server.js  
Рекомендуемый способ (работает 24/7):  

npm install -g pm2  
pm2 start server.js --name messenger  
pm2 save  
pm2 startup  
4. Открыть в браузере  
http://localhost:8080  
✨ ВОЗМОЖНОСТИ  
✅ Регистрация и вход	У каждого свой аккаунт, пароли хэшируются  
✅ Личные сообщения	Приватные чаты 1 на 1  
✅ Статусы онлайн/оффлайн	Зелёные точки — кто в сети  
✅ Непрочитанные сообщения	Красные счетчики на чатах  
✅ Поиск пользователей	Быстро найти друга  
✅ Мобильная версия	Адаптивный дизайн, кнопка меню  
✅ Мгновенная доставка	WebSocket — сообщения приходят сразу  
✅ История переписки	Сохраняется на сервере  
🛠 ТЕХНОЛОГИИ  
Компонент	Технология  
Backend	Node.js, WebSocket (ws)  
Frontend	Чистый HTML, CSS, JavaScript  
База данных	JSON-файлы (не требует установки)  
Безопасность	bcrypt — хэширование паролей  
Запуск	PM2 — 24/7, автозапуск  
Версионирование	Git, GitHub  
📁 СТРУКТУРА ПРОЕКТА  
text  
messenger-pro/  
│
├── server.js          # Серверная часть (WebSocket + HTTP)  
├── index.html         # Главная страница чата  
├── login.html         # Страница входа  
├── register.html      # Страница регистрации  
├── package.json       # Зависимости и скрипты  
├── .gitignore         # Файлы, исключённые из Git  
├── README.md          # Документация  
│  
├── users.json         # База пользователей (создаётся автоматически, НЕ В GIT)  
├── messages.json      # База сообщений (создаётся автоматически, НЕ В GIT)  
│  
└── node_modules/      # Зависимости (не в Git, устанавливаются через npm)  
🔧 КОМАНДЫ ДЛЯ АДМИНИСТРИРОВАНИЯ  
# Запуск через PM2  
pm2 start server.js --name messenger  
pm2 save  
pm2 startup  

# Просмотр статуса
pm2 status  
pm2 logs messenger  

# Перезапуск
pm2 restart messenger  

# Остановка
pm2 stop messenger  
pm2 delete messenger  
📱 ДОСТУП С ДРУГИХ УСТРОЙСТВ  
Замените localhost на IP вашего сервера:  

http://123.45.67.89:8080  
Страницы:  

http://ваш-сервер:8080/ — чат (после входа)  

http://ваш-сервер:8080/login.html — вход  

http://ваш-сервер:8080/register.html — регистрация  

🧑‍💻 ДЛЯ РАЗРАБОТЧИКОВ  
Установка с нуля на новый сервер  

# 1. Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -  
sudo apt-get install -y nodejs git  

# 2. Клонирование
git clone git@github.com:martyvase/messenger-pro.git  
cd messenger-pro  

# 3. Установка и запуск
npm install  
npm install -g pm2  
pm2 start server.js --name messenger  
pm2 save  
pm2 startup  

Работа с Git  
# Создать новую ветку
git checkout -b feature/название  

# После изменений
git add .  
git commit -m "Описание изменений"  
git push origin feature/название  
Важно! Никогда не добавляйте в Git  
# Эти файлы уже в .gitignore, но на всякий случай:
users.json  
messages.json  
node_modules/  
*.log  
.env  

❓ ЧАСТЫЕ ВОПРОСЫ  
Q: Как сменить имя пользователя?  
A: В правом верхнем углу кнопка «Сменить имя»  

Q: Как поменять пароль?  
A: Пока через редактирование users.json на сервере, скоро будет форма  

Q: Как сделать резервную копию?  
A: Скопируйте файлы users.json и messages.json с сервера  

Q: На телефоне не работает кнопка меню  
A: Обновите страницу — кнопка появится слева сверху  

🤝 КАК ВНЕСТИ СВОЙ ВКЛАД  
Форкните репозиторий на GitHub  

Создайте ветку: git checkout -b feature/ваша-фича  

Закоммитьте: git commit -m 'Добавил что-то крутое'  

Запушьте: git push origin feature/ваша-фича  

Откройте Pull Request  

Идеи для улучшения:  

🖼 Аватарки пользователей  

🔐 Смена пароля через интерфейс  

📎 Отправка файлов  

🎙 Голосовые сообщения  

🌙 Тёмная тема  

📄 ЛИЦЕНЗИЯ  
MIT © 2026 Marty Vase  

⭐ ПОДДЕРЖКА ПРОЕКТА  
Если проект оказался полезным — поставьте звезду на GitHub!  
Это помогает другим людям найти его и мотивирует развивать дальше.  

🔗 https://github.com/martyvase/messenger-pro  

Сделано с ❤️ для друзей и хорошего общения  
