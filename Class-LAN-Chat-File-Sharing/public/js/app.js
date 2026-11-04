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

// Web Audio API para Efectos Sonoros Nativos sin Librerías
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'message') {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'join') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) { console.log('Audio no interactuado aún'); }
}

function toggleTheme() { document.body.classList.toggle('light-theme'); }
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
    if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
    socket.emit('switch-channel', { channel });
}

socket.on('channel-switched', (data) => {
    document.getElementById('current-channel-title').innerText = `# ${data.channel}`;
    messagesContainer.innerHTML = '';
    
    if (!data.history || data.history.length === 0) {
        showEmptyWelcome(data.channel);
    } else {
        data.history.forEach(renderMessage);
    }
});

function showEmptyWelcome(channel) {
    messagesContainer.innerHTML = `
        <div class="empty-welcome">
            <h2>👋 ¡Bienvenido a #${escapeHtml(channel)}!</h2>
            <p>Este canal está tranquilo por ahora. ¡Rompe el hielo enviado un saludo o una encuesta!</p>
            <div class="quick-actions">
                <button class="quick-btn" onclick="sendQuickGreeting()">👋 Saludar</button>
                <button class="quick-btn" onclick="openModal('poll-modal')">📊 Crear Encuesta</button>
            </div>
        </div>
    `;
}

function sendQuickGreeting() {
    socket.emit('send-message', { text: `¡Hola a todos en la clase! 👋` });
}

// Conectados
socket.on('update-user-list', (users) => {
    document.getElementById('user-count').innerText = users.length;
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `<li class="user-item"><span class="dot"></span> ${escapeHtml(u)}</li>`).join('');
});

// Voz WebRTC con Onda Animada
function toggleVoice() {
    const btn = document.getElementById('voice-toggle-btn');
    const wave = document.getElementById('voice-wave');

    if (!inVoice) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            socket.emit('join-voice');
            inVoice = true;
            btn.innerText = '🔴 Salir de Voz';
            btn.className = 'voice-btn leave';
            if (wave) wave.classList.add('active');
            playSound('join');
        }).catch(() => alert('Permiso de micrófono denegado.'));
    } else {
        socket.emit('leave-voice');
        inVoice = false;
        btn.innerText = '🎙️ Unirme a Voz';
        btn.className = 'voice-btn join';
        if (wave) wave.classList.remove('active');
    }
}

socket.on('update-voice-list', (users) => {
    document.getElementById('voice-users-list').innerHTML = users.map(u => `<li>🗣️ ${escapeHtml(u)}</li>`).join('');
});

// Chat y Mensajes
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('send-message', { text, replyTo: currentReply });
        messageInput.value = '';
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
    } catch (err) { alert('Error al subir archivo'); }
    finally { fileInput.value = ''; }
});

socket.on('receive-message', (msg) => {
    removeWelcomeIfPresent();
    renderMessage(msg);
    if (msg.user !== username) playSound('message');
});

socket.on('receive-media', (msg) => { removeWelcomeIfPresent(); renderMessage(msg); });
socket.on('receive-file', (msg) => { removeWelcomeIfPresent(); renderMessage(msg); });

function removeWelcomeIfPresent() {
    const welcome = document.querySelector('.empty-welcome');
    if (welcome) welcome.remove();
}

function renderMessage(msg) {
    const isMine = msg.user === username;
    const card = document.createElement('div');
    card.className = `msg-card ${isMine ? 'mine' : ''}`;
    
    let body = escapeHtml(msg.text || '');
    if (msg.type === 'media') body = `<img src="${msg.url}" style="max-width:220px; border-radius:10px">`;
    if (msg.type === 'file') body = `📎 <a href="${msg.fileUrl}" target="_blank" style="color:inherit; font-weight:600">${escapeHtml(msg.fileName)}</a>`;

    card.innerHTML = `
        <div class="avatar" style="background:${getAvatarColor(msg.user)}">${msg.user[0].toUpperCase()}</div>
        <div class="msg-box">
            <div class="msg-actions">
                <button class="react-btn" onclick="sendReaction('${msg.id}', '👍')">👍</button>
                <button class="react-btn" onclick="sendReaction('${msg.id}', '❤️')">❤️</button>
                <button class="react-btn" onclick="sendReaction('${msg.id}', '🔥')">🔥</button>
            </div>
            <div class="msg-meta"><span>${escapeHtml(msg.user)}</span><span>${msg.timestamp}</span></div>
            <div>${body}</div>
        </div>
    `;
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendReaction(msgId, emoji) {
    socket.emit('react-message', { msgId, emoji });
}

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 65%, 48%)`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}