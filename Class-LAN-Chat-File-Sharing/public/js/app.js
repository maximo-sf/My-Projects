const socket = io();
let username = sessionStorage.getItem('chat_username') || prompt('Tu Nombre:') || 'Estudiante';
sessionStorage.setItem('chat_username', username);
socket.emit('user-join', username);

const messagesContainer = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
let currentReply = null;
let inVoice = false;

// Tema Claro / Oscuro
function toggleTheme() {
    document.body.classList.toggle('light-theme');
}

// Modales
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Canales
function switchChannel(channel) {
    if (channel === 'historial') return openModal('password-modal');
    changeChannelDirect(channel);
}

function submitHistoryPassword() {
    const pass = document.getElementById('history-pass-input').value;
    socket.emit('switch-channel', { channel: 'historial', password: pass });
    closeModal('password-modal');
}

function changeChannelDirect(channel) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (window.event && window.event.target) window.event.target.classList.add('active');
    socket.emit('switch-channel', { channel });
}

socket.on('channel-switched', (data) => {
    document.getElementById('current-channel-title').innerText = `# ${data.channel}`;
    messagesContainer.innerHTML = '';
    if (data.history) data.history.forEach(renderMessage);
});

// Lista de Usuarios
socket.on('update-user-list', (users) => {
    document.getElementById('user-count').innerText = users.length;
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `<li class="user-item"><span class="dot"></span> ${escapeHtml(u)}</li>`).join('');
});

// Voz WebRTC
function toggleVoice() {
    const btn = document.getElementById('voice-toggle-btn');
    if (!inVoice) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            socket.emit('join-voice');
            inVoice = true;
            btn.innerText = '🔴 Salir de Voz';
            btn.className = 'voice-btn leave';
        }).catch(() => alert('Permiso de micrófono denegado.'));
    } else {
        socket.emit('leave-voice');
        inVoice = false;
        btn.innerText = '🎙️ Unirme a Voz';
        btn.className = 'voice-btn join';
    }
}

socket.on('update-voice-list', (users) => {
    document.getElementById('voice-users-list').innerHTML = users.map(u => `<li>🗣️ ${escapeHtml(u)}</li>`).join('');
});

// Envio de Mensajes
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('send-message', { text, replyTo: currentReply });
        messageInput.value = '';
        cancelReply();
    }
});

fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        socket.emit('share-file', data);
    } catch (err) {
        alert('Error al subir archivo');
    } finally {
        fileInput.value = '';
    }
});

socket.on('receive-message', renderMessage);
socket.on('receive-media', renderMessage);
socket.on('receive-file', renderMessage);

function renderMessage(msg) {
    const isMine = msg.user === username;
    const card = document.createElement('div');
    card.className = `msg-card ${isMine ? 'mine' : ''}`;
    
    let body = escapeHtml(msg.text || '');
    if (msg.type === 'media') body = `<img src="${msg.url}" style="max-width:220px; border-radius:8px">`;
    if (msg.type === 'file') body = `📎 <a href="${msg.fileUrl}" target="_blank" style="color:inherit">${escapeHtml(msg.fileName)}</a>`;

    card.innerHTML = `
        <div class="avatar" style="background:${getAvatarColor(msg.user)}">${msg.user[0].toUpperCase()}</div>
        <div class="msg-box">
            <div class="msg-meta"><span>${escapeHtml(msg.user)}</span><span>${msg.timestamp}</span></div>
            <div>${body}</div>
        </div>
    `;
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function cancelReply() {
    currentReply = null;
    document.getElementById('reply-bar').style.display = 'none';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}