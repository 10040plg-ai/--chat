const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 이미지 저장 폴더가 없으면 자동 생성 (Render 배포 시 에러 방지)
const uploadDir = './public/uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 이미지 저장 설정
const storage = multer.diskStorage({
    destination: uploadDir,
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
        socket.username = data.username; // 소켓 객체에 유저명 저장 (나갈 때 필요)
        socket.roomName = data.roomName; // 소켓 객체에 방이름 저장

        // [추가] 방에 있는 다른 사람들에게 입장 알림
        io.to(data.roomName).emit('message', {
            username: '시스템',
            text: `📢 ${data.username}님이 입장하셨습니다.`,
            type: 'system' // 알림용 타입
        });
    });

    // 메시지 전송
    socket.on('chatMessage', (data) => {
        socket.to(data.roomName).emit('hideTyping');
        io.to(data.roomName).emit('message', data);
    });

    // 타이핑 중/멈춤 알림
    socket.on('typing', (data) => {
        socket.to(data.roomName).emit('displayTyping', data.username);
    });
    socket.on('stopTyping', (data) => {
        socket.to(data.roomName).emit('hideTyping');
    });

    // [추가] 접속 끊김 (퇴장) 감지
    socket.on('disconnect', () => {
        if (socket.username && socket.roomName) {
            io.to(socket.roomName).emit('message', {
                username: '시스템',
                text: `👋 ${socket.username}님이 퇴장하셨습니다.`,
                type: 'system'
            });
        }
    });
});

// Render 배포를 위해 PORT 설정을 process.env.PORT || 3000 으로 변경
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 실행 중입니다. 포트: ${PORT}`);
});
