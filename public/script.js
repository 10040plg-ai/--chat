const socket = io();
let currentUser = {};
let typing = false;
let timeout = undefined;

// 이미지 미리보기
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview').src = e.target.result;
        reader.readAsDataURL(input.files[0]);
    }
}

// 화면 이동
function goToStep(step) {
    if (step === 2) {
        if (!document.getElementById('username').value.trim()) return alert("이름을 입력하세요!");
        document.getElementById('step-profile').style.display = 'none';
        document.getElementById('step-room').style.display = 'block';
    }
}

// 로그인 (방 인증)
async function login() {
    const formData = new FormData();
    formData.append('username', document.getElementById('username').value);
    formData.append('profileImg', document.getElementById('profileImg').files[0]);
    formData.append('roomName', document.getElementById('roomName').value);
    formData.append('password', document.getElementById('password').value);

    const res = await fetch('/login', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
        currentUser = data;
        document.getElementById('step-room').style.display = 'none';
        document.getElementById('chat-area').style.display = 'flex';
        socket.emit('joinRoom', data);
    } else {
        alert(data.message);
    }
}

// 텍스트 메시지 전송
function sendMessage() {
    const input = document.getElementById('msg-input');
    if (!input.value.trim()) return;

    const messageData = {
        roomName: currentUser.roomName,
        username: currentUser.username,
        profileImg: currentUser.profileImg,
        text: input.value,
        imageUrl: null
    };

    socket.emit('chatMessage', messageData);
    input.value = "";
    typingTimeout(); // 전송 시 타이핑 상태 해제
}

// 이미지 파일 전송
async function sendImage(input) {
    if (!input.files || !input.files[0]) return;

    const formData = new FormData();
    formData.append('chatImage', input.files[0]);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    const result = await res.json();

    if (result.success) {
        socket.emit('chatMessage', {
            roomName: currentUser.roomName,
            username: currentUser.username,
            profileImg: currentUser.profileImg,
            text: "",
            imageUrl: result.imageUrl
        });
        input.value = "";
    }
}

// 타이핑 감지 로직
document.getElementById('msg-input').addEventListener('keypress', (e) => {
    if (e.which !== 13) { // 엔터키가 아닐 때
        if (typing === false) {
            typing = true;
            socket.emit('typing', { roomName: currentUser.roomName, username: currentUser.username });
        }
        clearTimeout(timeout);
        timeout = setTimeout(typingTimeout, 3000);
    }
});

function typingTimeout() {
    typing = false;
    socket.emit('stopTyping', { roomName: currentUser.roomName });
}

// 메시지 수신 및 화면 표시
socket.on('message', (data) => {
    const messagesDiv = document.getElementById('messages');

    if (data.system) {
        // 시스템 메시지 (입퇴장 알림) 처리
        const sysHtml = `<div class="system-msg">${data.text}</div>`;
        messagesDiv.insertAdjacentHTML('beforeend', sysHtml);
    } else {
        // 일반 채팅 메시지 처리
        const isMe = data.username === currentUser.username;
        let contentHtml = "";
        if (data.text) contentHtml += `<div>${data.text}</div>`;
        if (data.imageUrl) contentHtml += `<img src="${data.imageUrl}" onload="scrollToBottom()">`;

        const msgHtml = `
            <div class="msg-row ${isMe ? 'me' : 'other'}">
                ${!isMe ? `<img src="${data.profileImg}" class="profile-pic">` : ''}
                <div>
                    ${!isMe ? `<div class="user-name">${data.username}</div>` : ''}
                    <div class="bubble">${contentHtml}</div>
                </div>
            </div>
        `;
        messagesDiv.insertAdjacentHTML('beforeend', msgHtml);
    }
    
    scrollToBottom();
});

// 타이핑 표시 제어 수신
socket.on('displayTyping', (user) => {
    const display = document.getElementById('typing-display');
    display.innerText = `${user}님이 입력 중...`;
    display.classList.add('visible');
});

socket.on('hideTyping', () => {
    document.getElementById('typing-display').classList.remove('visible');
});

// 부드러운 스크롤
function scrollToBottom() {
    const win = document.getElementById('chat-window');
    win.scrollTo({ top: win.scrollHeight, behavior: 'smooth' });
}
