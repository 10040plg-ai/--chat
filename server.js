const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 채팅 내역을 서버 메모리에 저장 (서버 재시작 전까지 유지)
let chatLogs = {}; 

const uploadDir = './public/uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());

app.post('/login', upload.single('profileImg'), (req, res) => {
    const { username, roomName, password } = req.body;
    if (roomName === "기송신유" && password === "1234") {
        const profileImg = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/50';
        res.json({ success: true, username, profileImg, roomName });
    } else {
        res.json({ success: false, message: "방 이름 또는 비밀번호가 틀렸습니다." });
    }
});

app.post('/upload', upload.single('chatImage'), (req, res) => {
    if (req.file) {
        res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
    } else {
        res.json({ success: false });
    }
});

io.on('connection', (socket) => {
    socket.on('joinRoom', (data) => {
        socket.join(data.roomName);
        socket.username = data.username;
        socket.roomName = data.roomName;

        // 방별 로그 배열이 없으면 생성
        if (!chatLogs[data.roomName]) {
            chatLogs[data.roomName] = [];
        }

        // 1. 새로 들어온 유저에게만 "기존 채팅 내역" 전송
        socket.emit('previousMessages', chatLogs[data.roomName]);

        // 2. 전체 유저에게 "입장 알림" 전송
        io.to(data.roomName).emit('message', {
            text: `${data.username}님이 입장하셨습니다.`,
            system: true 
        });
    });

    socket.on('chatMessage', (data) => {
        // 메시지를 해당 방의 로그에 저장
        if (chatLogs[data.roomName]) {
            chatLogs[data.roomName].push(data);
        }
        
        socket.to(data.roomName).emit('hideTyping');
        io.to(data.roomName).emit('message', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.roomName).emit('displayTyping', data.username);
    });

    socket.on('stopTyping', (data) => {
        socket.to(data.roomName).emit('hideTyping');
    });

    socket.on('disconnect', () => {
        if (socket.username && socket.roomName) {
            io.to(socket.roomName).emit('message', {
                text: `${socket.username}님이 퇴장하셨습니다.`,
                system: true
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
