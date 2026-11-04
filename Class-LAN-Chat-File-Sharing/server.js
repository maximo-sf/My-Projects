const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({
            fileName: req.file.originalname,
            fileUrl: `/uploads/${req.file.filename}`
        });
    });
});

const SECRET_HISTORY_PASSWORD = 'admin';
const channels = ['general', 'historial'];

const channelHistories = {
    general: [],
    historial: []
};

const connectedUsers = new Map();
const voiceUsers = new Set();
const activePolls = {};
let pinnedMessage = null;

function broadcastUsersList() {
    const usersArray = Array.from(connectedUsers.values()).map(u => u.username);
    io.emit('update-user-list', [...new Set(usersArray)]);
}

function broadcastVoiceList() {
    io.emit('update-voice-list', Array.from(voiceUsers));
}

io.on('connection', (socket) => {
    let currentUser = 'Anónimo';
    let currentChannel = 'general';

    socket.join(currentChannel);

    socket.on('user-join', (username) => {
        currentUser = username;
        socket.username = username;
        connectedUsers.set(socket.id, { username, channel: currentChannel });
        io.emit('system-notification', `${currentUser} se ha conectado.`);
        broadcastUsersList();
        broadcastVoiceList();
    });

    socket.on('switch-channel', (data) => {
        const targetChannel = typeof data === 'string' ? data : data.channel;
        if (targetChannel === 'historial' && data.password !== SECRET_HISTORY_PASSWORD) {
            return socket.emit('access-denied', 'Contraseña incorrecta.');
        }

        if (channels.includes(targetChannel)) {
            socket.leave(currentChannel);
            currentChannel = targetChannel;
            socket.join(currentChannel);

            socket.emit('channel-switched', { 
                channel: currentChannel, 
                pinnedMessage,
                history: targetChannel === 'historial' ? channelHistories.historial : channelHistories[targetChannel]
            });
        }
    });

    socket.on('send-message', (data) => {
        const payload = {
            type: 'text',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            text: data.text,
            replyTo: data.replyTo || null,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);
        io.to(currentChannel).emit('receive-message', payload);
    });

    socket.on('react-message', ({ msgId, emoji }) => {
        const history = channelHistories[currentChannel] || [];
        const msg = history.find(m => m.id === msgId) || channelHistories.historial.find(m => m.id === msgId);
        if (msg) {
            if (!msg.reactions) msg.reactions = {};
            if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

            const idx = msg.reactions[emoji].indexOf(currentUser);
            if (idx > -1) {
                msg.reactions[emoji].splice(idx, 1);
                if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
            } else {
                msg.reactions[emoji].push(currentUser);
            }
            io.to(currentChannel).emit('update-message-reactions', { msgId, reactions: msg.reactions });
        }
    });

    socket.on('pin-message', (text) => {
        pinnedMessage = { user: currentUser, text };
        io.emit('update-pinned', pinnedMessage);
    });

    socket.on('typing', (isTyping) => {
        socket.to(currentChannel).emit('user-typing', { user: currentUser, isTyping });
    });

    socket.on('send-media', (data) => {
        const payload = {
            type: 'media',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            url: data.url,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);
        io.to(currentChannel).emit('receive-media', payload);
    });

    socket.on('share-file', (data) => {
        const payload = {
            type: 'file',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);
        io.to(currentChannel).emit('receive-file', payload);
    });

    socket.on('create-poll', (pollData) => {
        const pollId = 'poll_' + Date.now();
        activePolls[pollId] = { question: pollData.question, options: pollData.options.map(opt => ({ text: opt, votes: 0 })), votedUsers: [] };
        io.to(currentChannel).emit('receive-poll', { id: pollId, ...activePolls[pollId] });
    });

    socket.on('vote-poll', ({ pollId, optionIndex }) => {
        const poll = activePolls[pollId];
        if (poll && !poll.votedUsers.includes(currentUser)) {
            poll.options[optionIndex].votes++;
            poll.votedUsers.push(currentUser);
            io.emit('update-poll', { id: pollId, poll });
        }
    });

    socket.on('share-drawing', (dataUrl) => {
        const payload = {
            type: 'media',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            url: dataUrl,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);
        io.to(currentChannel).emit('receive-media', payload);
    });

    // WebRTC Voz
    socket.on('join-voice', () => {
        voiceUsers.add(currentUser);
        socket.join('voice-room');
        broadcastVoiceList();
        socket.to('voice-room').emit('user-connected-voice', socket.id);
    });

    socket.on('leave-voice', () => {
        voiceUsers.delete(currentUser);
        socket.leave('voice-room');
        broadcastVoiceList();
        socket.to('voice-room').emit('user-disconnected-voice', socket.id);
    });

    socket.on('webrtc-offer', ({ target, offer }) => socket.to(target).emit('webrtc-offer', { sender: socket.id, offer }));
    socket.on('webrtc-answer', ({ target, answer }) => socket.to(target).emit('webrtc-answer', { sender: socket.id, answer }));
    socket.on('webrtc-ice', ({ target, candidate }) => socket.to(target).emit('webrtc-ice', { sender: socket.id, candidate }));

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
        voiceUsers.delete(currentUser);
        broadcastUsersList();
        broadcastVoiceList();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Servidor activo en http://localhost:${PORT}`));