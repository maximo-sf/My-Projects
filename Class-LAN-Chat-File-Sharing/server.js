const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuración de subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use(express.json());

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}` });
});

// Estructuras de datos globales en memoria
const users = {};
const channels = { general: [], historial: [] };
const voiceUsers = new Set();
const activePolls = {}; 
const messageReactions = {}; // Registro: { msgId: { socketId: [ '👍', '❤️' ] } }

io.on('connection', (socket) => {
    let currentChannel = 'general';

    // 1. Registro de usuario
    socket.on('user-join', (username) => {
        users[socket.id] = {
            id: socket.id,
            username: username || 'Estudiante',
            status: '🟢'
        };
        socket.join(currentChannel);
        
        socket.emit('channel-switched', { channel: currentChannel, history: channels[currentChannel] || [] });
        io.emit('update-user-list', Object.values(users));
        io.emit('update-voice-list', Array.from(voiceUsers));
    });

    // 2. Sincronización de estado
    socket.on('update-status', (statusEmoji) => {
        if (!users[socket.id]) {
            users[socket.id] = { id: socket.id, username: 'Estudiante', status: statusEmoji };
        } else {
            users[socket.id].status = statusEmoji;
        }
        io.emit('update-user-list', Object.values(users));
    });

    // 3. Canales
    socket.on('switch-channel', ({ channel, password }) => {
        if (channel === 'historial' && password !== '1234') {
            return socket.emit('system-notification', '⚠️ Contraseña incorrecta.');
        }
        socket.leave(currentChannel);
        currentChannel = channel;
        socket.join(currentChannel);
        socket.emit('channel-switched', { channel: currentChannel, history: channels[currentChannel] || [] });
    });

    // 4. Mensajería
    socket.on('send-message', ({ text }) => {
        const userObj = users[socket.id];
        if (!userObj) return;
        const msgData = {
            id: Date.now().toString(),
            user: userObj.username,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channels[currentChannel]) channels[currentChannel].push(msgData);
        io.to(currentChannel).emit('receive-message', msgData);
    });

    // 5. Reacciones a mensajes (Límite: 1 reacción de cada emoji por usuario)
    socket.on('react-message', ({ msgId, emoji }) => {
        if (!messageReactions[msgId]) {
            messageReactions[msgId] = {};
        }
        if (!messageReactions[msgId][socket.id]) {
            messageReactions[msgId][socket.id] = new Set();
        }

        const userEmojis = messageReactions[msgId][socket.id];

        // Verificar si el usuario ya usó este emoji específico en este mensaje
        if (userEmojis.has(emoji)) {
            return socket.emit('system-notification', `⚠️ Ya has reaccionado con ${emoji} a este mensaje.`);
        }

        userEmojis.add(emoji);
        
        io.to(currentChannel).emit('message-reaction', { 
            msgId, 
            emoji, 
            user: users[socket.id]?.username 
        });
    });

    // 6. Encuestas Flash
    socket.on('create-poll', ({ question, options }) => {
        const pollId = 'poll-' + Date.now();
        const pollData = {
            id: pollId,
            question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            voters: []
        };
        activePolls[pollId] = pollData;
        io.to(currentChannel).emit('receive-poll', pollData);
    });

    socket.on('vote-poll', ({ pollId, optionIndex }) => {
        const poll = activePolls[pollId];
        if (!poll) return;

        if (poll.voters.includes(socket.id)) {
            return socket.emit('system-notification', '⚠️ Ya has votado en esta encuesta.');
        }

        if (poll.options[optionIndex]) {
            poll.options[optionIndex].votes += 1;
            poll.voters.push(socket.id);
            io.emit('update-poll-data', poll);
        }
    });

    // 7. Pizarra Digital
    socket.on('share-drawing', (dataUrl) => {
        const msgData = {
            id: Date.now().toString(),
            user: users[socket.id]?.username || 'Anónimo',
            type: 'media',
            url: dataUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channels[currentChannel]) channels[currentChannel].push(msgData);
        io.to(currentChannel).emit('receive-media', msgData);
    });

    // 8. Subida de archivos
    socket.on('share-file', (fileData) => {
        const msgData = {
            id: Date.now().toString(),
            user: users[socket.id]?.username || 'Anónimo',
            type: 'file',
            fileName: fileData.fileName,
            fileUrl: fileData.fileUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channels[currentChannel]) channels[currentChannel].push(msgData);
        io.to(currentChannel).emit('receive-file', msgData);
    });

    // 9. Sala de voz P2P
    socket.on('join-voice', () => {
        if (users[socket.id]) {
            voiceUsers.add(users[socket.id].username);
            io.emit('update-voice-list', Array.from(voiceUsers));
        }
    });

    socket.on('leave-voice', () => {
        if (users[socket.id]) {
            voiceUsers.delete(users[socket.id].username);
            io.emit('update-voice-list', Array.from(voiceUsers));
        }
    });

    // 10. Desconexión
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            voiceUsers.delete(users[socket.id].username);
            delete users[socket.id];
            io.emit('update-user-list', Object.values(users));
            io.emit('update-voice-list', Array.from(voiceUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));