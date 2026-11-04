const socket = io();

let username = sessionStorage.getItem('chat_username') || prompt('Tu Nombre:') || 'Estudiante';
sessionStorage.setItem('chat_username', username);

socket.emit('user-join', username);

let messagesContainer, messageForm, messageInput, fileInput;
let inVoice = false;
const votedPolls = new Set(); 
const userReactions = {}; // Control local: { msgId: Set(['👍', '❤️']) }

document.addEventListener('DOMContentLoaded', () => {
    messagesContainer = document.getElementById('chat-messages');
    messageForm = document.getElementById('message-form');
    messageInput = document.getElementById('message-input');
    fileInput = document.getElementById('file-input');

    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = messageInput.value.trim();
            if (text) {
                socket.emit('send-message', { text });
                messageInput.value = '';
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();
                socket.emit('share-file', data);
                showToast(`Archivo enviado: ${file.name}`, '📎');
            } catch (err) { alert('Error al subir archivo'); }
            finally { fileInput.value = ''; }
        });
    }
});

// --- Estado Global ---
window.setStatus = function(emoji) {
    if (window.event && window.event.currentTarget) {
        document.querySelectorAll('.status-opt').forEach(b => b.classList.remove('active'));
        window.event.currentTarget.classList.add('active');
    }

    socket.emit('update-status', emoji);
    showToast(`Estado cambiado a ${emoji}`, '👤');
};

socket.on('update-user-list', (usersList) => {
    const countElem = document.getElementById('user-count');
    const listElem = document.getElementById('user-list');
    
    if (countElem) countElem.innerText = usersList.length;
    if (!listElem) return;

    listElem.innerHTML = usersList.map(u => {
        const name = typeof u === 'object' ? u.username : u;
        const icon = (typeof u === 'object' && u.status) ? u.status : '🟢';
        
        return `
            <li class="user-item" style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${escapeHtml(name)}</span>
                <span style="font-size:1rem;">${icon}</span>
            </li>
        `;
    }).join('');
});

// --- Mensajería y Reacciones Limitadas ---
socket.on('receive-message', (msg) => {
    renderMessage(msg);
    if (msg.user !== username) showToast(`Mensaje de ${msg.user}`, '💬');
});
socket.on('receive-media', renderMessage);
socket.on('receive-file', renderMessage);

socket.on('message-reaction', ({ msgId, emoji }) => {
    const msgCard = document.getElementById(`msg-${msgId}`);
    if (!msgCard) return;

    let reactionsList = msgCard.querySelector('.msg-reactions-list');
    if (!reactionsList) {
        reactionsList = document.createElement('div');
        reactionsList.className = 'msg-reactions-list';
        reactionsList.style.cssText = 'display:flex; gap:4px; margin-top:6px; font-size:0.8rem;';
        msgCard.querySelector('.msg-box').appendChild(reactionsList);
    }

    const tag = document.createElement('span');
    tag.style.cssText = 'background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:12px; border:1px solid rgba(255,255,255,0.2);';
    tag.innerText = emoji;
    reactionsList.appendChild(tag);
});

function renderMessage(msg) {
    if (!messagesContainer) messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const isMine = msg.user === username;
    const card = document.createElement('div');
    card.className = `msg-card ${isMine ? 'mine' : ''}`;
    card.id = `msg-${msg.id}`;
    
    let body = escapeHtml(msg.text || '');
    if (msg.type === 'media') body = `<img src="${msg.url}" style="max-width:200px; border-radius:8px">`;
    if (msg.type === 'file') body = `📎 <a href="${msg.fileUrl}" target="_blank" style="color:inherit">${escapeHtml(msg.fileName)}</a>`;

    card.innerHTML = `
        <div class="avatar" style="background:${getAvatarColor(msg.user)}">${msg.user[0].toUpperCase()}</div>
        <div class="msg-box">
            <div class="msg-meta"><span>${escapeHtml(msg.user)}</span><span>${msg.timestamp}</span></div>
            <div class="msg-text">${body}</div>
            <div class="msg-actions" style="margin-top:6px; display:flex; gap:6px;">
                <button type="button" class="react-btn react-btn-thumbs" onclick="sendReaction('${msg.id}', '👍', this)">👍</button>
                <button type="button" class="react-btn react-btn-heart" onclick="sendReaction('${msg.id}', '❤️', this)">❤️</button>
                <button type="button" class="react-btn react-btn-fire" onclick="sendReaction('${msg.id}', '🔥', this)">🔥</button>
            </div>
            <div class="msg-reactions-list" style="display:flex; gap:4px; margin-top:4px; font-size:0.8rem;"></div>
        </div>
    `;
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

window.sendReaction = function(msgId, emoji, btnElem) {
    if (!userReactions[msgId]) userReactions[msgId] = new Set();

    // Bloqueo si ya usaste este emoji exacto en este mensaje
    if (userReactions[msgId].has(emoji)) {
        return showToast(`Ya has añadido ${emoji} a este mensaje`, '⚠️');
    }

    userReactions[msgId].add(emoji);

    // Deshabilitar el botón específico usado
    if (btnElem) {
        btnElem.disabled = true;
        btnElem.style.opacity = '0.4';
        btnElem.style.cursor = 'default';
    }

    if (socket && socket.connected) {
        socket.emit('react-message', { msgId, emoji });
    }
};

// --- Modales y Canales ---
window.openModal = function(id) { 
    const m = document.getElementById(id);
    if (m) m.style.display = 'flex'; 
    if (id === 'whiteboard-modal') initCanvas();
};

window.closeModal = function(id) { 
    const m = document.getElementById(id);
    if (m) m.style.display = 'none'; 
};

window.switchChannel = function(channel) {
    if (channel === 'historial') return openModal('password-modal');
    changeChannelDirect(channel);
};

window.submitHistoryPassword = function() {
    const pass = document.getElementById('history-pass-input').value;
    socket.emit('switch-channel', { channel: 'historial', password: pass });
    closeModal('password-modal');
};

function changeChannelDirect(channel) {
    document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
    if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
    socket.emit('switch-channel', { channel });
}

socket.on('channel-switched', (data) => {
    const title = document.getElementById('current-channel-title');
    if (title) title.innerText = `# ${data.channel}`;
    if (!messagesContainer) messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        if (data.history) data.history.forEach(renderMessage);
    }
});

// --- Encuestas Flash ---
window.submitPoll = function() {
    const question = document.getElementById('poll-q').value.trim();
    const opt1 = document.getElementById('poll-opt1').value.trim();
    const opt2 = document.getElementById('poll-opt2').value.trim();

    if (!question || !opt1 || !opt2) return alert('Rellena todos los campos.');

    socket.emit('create-poll', { question, options: [opt1, opt2] });
    document.getElementById('poll-q').value = '';
    document.getElementById('poll-opt1').value = '';
    document.getElementById('poll-opt2').value = '';
    closeModal('poll-modal');
    showToast('Encuesta publicada', '📊');
};

document.addEventListener('click', (e) => {
    const pollBtn = e.target.closest('.poll-vote-btn');
    if (pollBtn) {
        const pollId = pollBtn.getAttribute('data-poll-id');
        const optIndex = parseInt(pollBtn.getAttribute('data-opt-index'), 10);
        
        if (pollId && !isNaN(optIndex)) {
            if (votedPolls.has(pollId)) {
                return showToast('Ya has votado en esta encuesta', '⚠️');
            }
            votedPolls.add(pollId);
            socket.emit('vote-poll', { pollId, optionIndex: optIndex });
        }
    }
});

socket.on('receive-poll', (poll) => {
    if (!messagesContainer) messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    const card = createPollElement(poll);
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on('update-poll-data', (updatedPoll) => {
    const existingPollElem = document.getElementById(updatedPoll.id);
    if (existingPollElem) {
        const newPollElem = createPollElement(updatedPoll);
        existingPollElem.replaceWith(newPollElem);
    }
});

function createPollElement(poll) {
    const card = document.createElement('div');
    card.className = 'msg-card';
    card.id = poll.id;
    
    const total = poll.options.reduce((acc, curr) => acc + curr.votes, 0);
    const hasVoted = votedPolls.has(poll.id);

    let optsHtml = poll.options.map((opt, idx) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        return `
            <button type="button" 
                    class="icon-btn poll-vote-btn" 
                    data-poll-id="${poll.id}" 
                    data-opt-index="${idx}"
                    ${hasVoted ? 'disabled' : ''}
                    style="width:100%; text-align:left; background:${hasVoted ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; margin-top:6px; padding:10px 12px; border-radius:8px; font-size:0.85rem; display:flex; justify-content:space-between; align-items:center; cursor:${hasVoted ? 'default' : 'pointer'}; opacity:${hasVoted ? '0.7' : '1'};">
                <span style="pointer-events:none;">${escapeHtml(opt.text)} (${opt.votes})</span>
                <b style="color:var(--neon-cyan); pointer-events:none;">${pct}%</b>
            </button>
        `;
    }).join('');

    card.innerHTML = `
        <div class="msg-box" style="width:100%; max-width:300px; border:1px solid var(--neon-cyan); padding:12px; border-radius:12px;">
            <div class="msg-meta" style="margin-bottom:6px;">📊 Encuesta Flash ${hasVoted ? '(Votado)' : ''}</div>
            <div class="msg-text" style="font-weight:700; margin-bottom:10px">${escapeHtml(poll.question)}</div>
            ${optsHtml}
        </div>
    `;
    return card;
}

// --- Pizarra Digital ---
// --- PIZARRA DIGITAL CON COLORES ---
let canvas, ctx, drawing = false;
let currentColor = '#0f172a';

function initCanvas() {
    canvas = document.getElementById('canvas-board');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    canvas.onmousedown = (e) => { 
        drawing = true; 
        ctx.beginPath(); 
        ctx.strokeStyle = currentColor;
        ctx.moveTo(e.offsetX, e.offsetY); 
    };
    canvas.onmousemove = (e) => { 
        if (drawing) { 
            ctx.lineTo(e.offsetX, e.offsetY); 
            ctx.stroke(); 
        } 
    };
    canvas.onmouseup = () => { drawing = false; };
}

window.setCanvasColor = function(color, btnElem) {
    currentColor = color;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    if (btnElem) btnElem.classList.add('active');
};

window.clearCanvas = function() {
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};

window.sendDrawing = function() {
    if (!canvas) return;
    socket.emit('share-drawing', canvas.toDataURL());
    clearCanvas();
    closeModal('whiteboard-modal');
    showToast('Dibujo compartido', '🎨');
};

// --- Voz P2P ---
window.toggleVoice = function() {
    const btn = document.getElementById('voice-toggle-btn');
    if (!inVoice) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            socket.emit('join-voice');
            inVoice = true;
            if (btn) btn.innerText = '🔴 Salir de Audio';
            showToast('Conectado al audio', '🎙️');
        }).catch(() => alert('Permiso de micrófono denegado.'));
    } else {
        socket.emit('leave-voice');
        inVoice = false;
        if (btn) btn.innerText = '🎙️ Unirme a Audio';
        showToast('Desconectado del audio', '🔇');
    }
};

socket.on('update-voice-list', (users) => {
    const voiceList = document.getElementById('voice-users-list');
    if (voiceList) {
        voiceList.innerHTML = users.map(u => `<li>🗣️ ${escapeHtml(u)}</li>`).join('');
    }
});

// --- Sistema de Notificaciones ---
socket.on('system-notification', (msg) => {
    showToast(msg, '⚠️');
});

window.showToast = function(text, icon = '🔔') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(text)}</span>`;
    container.appendChild(toast);
    playNotificationSound();
    setTimeout(() => toast.remove(), 3500);
};

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
}

window.filterMessages = function() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput || !messagesContainer) return;
    const query = searchInput.value.toLowerCase();
    const cards = messagesContainer.getElementsByClassName('msg-card');
    Array.from(cards).forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(query) ? 'flex' : 'none';
    });
};

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