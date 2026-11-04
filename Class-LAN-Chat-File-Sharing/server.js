const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. Garantizar la existencia de la carpeta de subidas al arrancar
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configuración de multer blindada
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Limpiamos el nombre original para evitar caracteres raros
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50MB por archivo
});

// Servir estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Endpoint de subida de archivos
app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Error de Multer: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ error: `Error en el servidor: ${err.message}` });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        res.json({
            fileName: req.file.originalname,
            fileUrl: `/uploads/${req.file.filename}`
        });
    });
});

const SECRET_HISTORY_PASSWORD = 'admin';
const channels = ['general', 'dudas', 'anuncios', 'historial'];

const channelHistories = {
    general: [],
    dudas: [],
    anuncios: [],
    historial: []
};

// Registro de usuarios conectados
const connectedUsers = new Map();
const activePolls = {};
let pinnedMessage = null;

function broadcastUsersList() {
    const usersArray = Array.from(connectedUsers.values()).map(u => u.username);
    const uniqueUsers = [...new Set(usersArray)];
    io.emit('update-user-list', uniqueUsers);
}

io.on('connection', (socket) => {
    let currentUser = 'Anónimo';
    let currentChannel = 'general';

    socket.join(currentChannel);

    socket.on('user-join', (username) => {
        currentUser = username;
        socket.username = username;
        connectedUsers.set(socket.id, { username, channel: currentChannel });
        
        io.emit('system-notification', `${currentUser} se ha unido a la red.`);
        broadcastUsersList();
    });

    socket.on('switch-channel', (data) => {
        const targetChannel = typeof data === 'string' ? data : data.channel;
        const passwordInput = data.password;

        if (targetChannel === 'historial') {
            if (passwordInput !== SECRET_HISTORY_PASSWORD) {
                return socket.emit('access-denied', 'Contraseña incorrecta para el canal Historial.');
            }
        }

        if (channels.includes(targetChannel)) {
            socket.leave(currentChannel);
            currentChannel = targetChannel;
            socket.join(currentChannel);

            if (connectedUsers.has(socket.id)) {
                connectedUsers.get(socket.id).channel = currentChannel;
            }

            const historyToSend = targetChannel === 'historial' 
                ? channelHistories.historial 
                : (channelHistories[targetChannel] || []);

            socket.emit('channel-switched', { 
                channel: currentChannel, 
                pinnedMessage,
                history: historyToSend
            });
        }
    });

    // Envío de mensajes
    socket.on('send-message', (data) => {
        const payload = {
            type: 'text',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            text: data.text,
            channel: currentChannel,
            replyTo: data.replyTo || null,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-message', payload);
    });

    // Sistema de Reacciones con Emojis
    socket.on('react-message', ({ msgId, emoji }) => {
        const history = channelHistories[currentChannel] || [];
        const msg = history.find(m => m.id === msgId) || channelHistories.historial.find(m => m.id === msgId);

        if (msg) {
            if (!msg.reactions) msg.reactions = {};
            if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

            const userIndex = msg.reactions[emoji].indexOf(currentUser);
            if (userIndex > -1) {
                msg.reactions[emoji].splice(userIndex, 1);
                if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
            } else {
                msg.reactions[emoji].push(currentUser);
            }

            io.to(currentChannel).emit('update-message-reactions', { msgId, reactions: msg.reactions });
        }
    });

    // Fijar mensaje
    socket.on('pin-message', (text) => {
        pinnedMessage = { user: currentUser, text };
        io.emit('update-pinned', pinnedMessage);
    });

    // Indicador "Escribiendo..."
    socket.on('typing', (isTyping) => {
        socket.to(currentChannel).emit('user-typing', { user: currentUser, isTyping });
    });

    // Multimedia
    socket.on('send-media', (data) => {
        const payload = {
            type: 'media',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            mediaType: data.type,
            user: currentUser,
            url: data.url,
            channel: currentChannel,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-media', payload);
    });

    // Archivos
    socket.on('share-file', (data) => {
        const payload = {
            type: 'file',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            user: currentUser,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            channel: currentChannel,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-file', payload);
    });

    // Encuestas
    socket.on('create-poll', (pollData) => {
        const pollId = 'poll_' + Date.now();
        activePolls[pollId] = {
            question: pollData.question,
            options: pollData.options.map(opt => ({ text: opt, votes: 0 })),
            votedUsers: []
        };
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

    // Pizarra
    socket.on('share-drawing', (dataUrl) => {
        const payload = {
            type: 'media',
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            mediaType: 'drawing',
            user: currentUser,
            url: dataUrl,
            channel: currentChannel,
            reactions: {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-media', payload);
    });

    // Desconexión
    socket.on('disconnect', () => {
        if (connectedUsers.has(socket.id)) {
            connectedUsers.delete(socket.id);
            broadcastUsersList();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Chat LAN corriendo en http://localhost:${PORT}`);
});
