const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 이미지 저장 설정 (uploads 폴더가 있어야 함)
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());

// [API] 로그인 및 방 입장 검증
app.post('/login', upload.single('profileImg'), (req, res) => {
    const { username, roomName, password } = req.body;
    
    // 조건: 방 이름 '기송신유', 비밀번호 '1234'
    if (roomName === "기송신유" && password === "1234") {
        const profileImg = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/50';
        res.json({ success: true, username, profileImg, roomName });
    } else {
        res.json({ success: false, message: "방 이름 또는 비밀번호가 틀렸습니다." });
    }
});

// [API] 채팅 이미지 업로드
app.post('/upload', upload.single('chatImage'), (req, res) => {
    if (req.file) {
        res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
    } else {
        res.json({ success: false });
    }
});

// [Socket.io] 실시간 통신
io.on('connection', (socket) => {
    // 방 접속
    socket.on('joinRoom', (data) => {
        socket.join(data.roomName);
    });

    // 메시지 전송
    socket.on('chatMessage', (data) => {
        // 메시지가 오면 해당 방의 타이핑 표시 중단
        socket.to(data.roomName).emit('hideTyping');
        io.to(data.roomName).emit('message', data);
    });

    // 타이핑 중 알림
    socket.on('typing', (data) => {
        socket.to(data.roomName).emit('displayTyping', data.username);
    });

    // 타이핑 멈춤 알림
    socket.on('stopTyping', (data) => {
        socket.to(data.roomName).emit('hideTyping');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});