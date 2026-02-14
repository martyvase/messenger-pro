const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, '[]');

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE));
let groups = JSON.parse(fs.readFileSync(GROUPS_FILE));

function saveUsers(){ fs.writeFileSync(USERS_FILE, JSON.stringify(users,null,2)); }
function saveMessages(){ fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages,null,2)); }
function saveGroups(){ fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups,null,2)); }

const server = http.createServer((req,res)=>{
    const url = req.url;

    if(url==='/'||url==='/index.html') serveFile('index.html',res);
    else if(url==='/login.html') serveFile('login.html',res);
    else if(url==='/register.html') serveFile('register.html',res);

    else if(url==='/api/register' && req.method==='POST') handleRegister(req,res);
    else if(url==='/api/login' && req.method==='POST') handleLogin(req,res);
    else if(url==='/api/users' && req.method==='GET') handleGetUsers(req,res);
    else if(url.startsWith('/api/messages/') && req.method==='GET') handleGetMessages(req,res);

    else if(url==='/api/groups' && req.method==='POST') handleCreateGroup(req,res);
    else if(url==='/api/groups' && req.method==='GET') handleGetGroups(req,res);
    else if(url.startsWith('/api/groupMessages/') && req.method==='GET') handleGetGroupMessages(req,res);

    else{
        res.writeHead(404);
        res.end('Not found');
    }
});

function serveFile(file,res){
    fs.readFile(path.join(__dirname,file),(err,data)=>{
        if(err){ res.writeHead(500); res.end(); return; }
        res.writeHead(200,{ 'Content-Type':'text/html'});
        res.end(data);
    });
}

async function handleRegister(req,res){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async ()=>{
        const {username,password}=JSON.parse(body);

        if(users.find(u=>u.username===username)){
            res.writeHead(400);
            res.end(JSON.stringify({error:'exists'}));
            return;
        }

        const user={
            id:uuidv4(),
            username,
            password:await bcrypt.hash(password,10),
            createdAt:new Date().toISOString(),
            status:'offline',
            lastSeen:new Date().toISOString()
        };

        users.push(user);
        saveUsers();

        res.writeHead(200,{ 'Content-Type':'application/json'});
        res.end(JSON.stringify({success:true,userId:user.id,username:user.username}));
    });
}

async function handleLogin(req,res){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async ()=>{
        const {username,password}=JSON.parse(body);
        const user=users.find(u=>u.username===username);

        if(!user||!(await bcrypt.compare(password,user.password))){
            res.writeHead(401);
            res.end(JSON.stringify({error:'bad'}));
            return;
        }

        user.lastSeen=new Date().toISOString();
        saveUsers();

        res.writeHead(200,{ 'Content-Type':'application/json'});
        res.end(JSON.stringify({success:true,userId:user.id,username:user.username}));
    });
}

function handleGetUsers(req,res){
    const safe=users.map(({password,...r})=>r);
    res.writeHead(200,{ 'Content-Type':'application/json'});
    res.end(JSON.stringify(safe));
}

function handleGetMessages(req,res){
    const p=req.url.split('/');
    const u1=p[3];
    const u2=p[4];

    const data=messages.filter(m=>
        (m.from===u1 && m.to===u2) ||
        (m.from===u2 && m.to===u1)
    );

    res.writeHead(200,{ 'Content-Type':'application/json'});
    res.end(JSON.stringify(data));
}

function handleCreateGroup(req,res){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
        const {name,members}=JSON.parse(body);

        const uniqueMembers=[...new Set(members)];

        const group={
            id:uuidv4(),
            name,
            members:uniqueMembers,
            createdAt:new Date().toISOString()
        };

        groups.push(group);
        saveGroups();

        res.writeHead(200,{ 'Content-Type':'application/json'});
        res.end(JSON.stringify(group));
    });
}

function handleGetGroups(req,res){
    res.writeHead(200,{ 'Content-Type':'application/json'});
    res.end(JSON.stringify(groups));
}

function handleGetGroupMessages(req,res){
    const id=req.url.split('/')[3];
    const data=messages.filter(m=>m.groupId===id);

    res.writeHead(200,{ 'Content-Type':'application/json'});
    res.end(JSON.stringify(data));
}

const wss=new WebSocket.Server({server});
const onlineUsers=new Map();

wss.on('connection',(ws,req)=>{
    const url=new URL(req.url,'http://x');
    const userId=url.searchParams.get('userId');
    const username=url.searchParams.get('username');

    const user=users.find(u=>u.id===userId);
    if(!user) return;

    user.status='online';
    saveUsers();

    onlineUsers.set(ws,{...user,ws});

    ws.on('message',(data)=>{
        const msg=JSON.parse(data);

        if(msg.type==='private_message') handlePrivateMessage(ws,msg);
        if(msg.type==='group_message') handleGroupMessage(ws,msg);
    });

    ws.on('close',()=>{
        user.status='offline';
        saveUsers();
        onlineUsers.delete(ws);
    });
});

function handlePrivateMessage(ws,message){
    const from=onlineUsers.get(ws);
    const msg={
        id:uuidv4(),
        from:from.id,
        to:message.to,
        text:message.text,
        timestamp:new Date().toISOString()
    };

    messages.push(msg);
    saveMessages();

    for(let [c,u] of onlineUsers){
        if(u.id===message.to||c===ws){
            c.send(JSON.stringify({type:'private_message',message:msg}));
        }
    }
}

function handleGroupMessage(ws,message){
    const from=onlineUsers.get(ws);
    const group=groups.find(g=>g.id===message.groupId);
    if(!group) return;

    const msg={
        id:uuidv4(),
        groupId:group.id,
        from:from.id,
        text:message.text,
        timestamp:new Date().toISOString(),
        fromUser:{id:from.id,username:from.username}
    };

    messages.push(msg);
    saveMessages();

    for(let [client,user] of onlineUsers){
        if(group.members.includes(user.id)){
            client.send(JSON.stringify({type:'group_message',message:msg}));
        }
    }
}

server.listen(8080);