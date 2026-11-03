const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuración de almacenamiento para archivos subidos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static('public'));

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`
    });
});

// Estado de la aplicación en memoria
const channels = ['general', 'dudas', 'anuncios'];
const activePolls = {};
let pinnedMessage = null;

io.on('connection', (socket) => {
    let currentUser = 'Anónimo';
    let currentChannel = 'general';

    socket.join(currentChannel);

    socket.on('user-join', (username) => {
        currentUser = username;
        socket.username = username;
        io.emit('system-notification', `${currentUser} se ha unido a la red.`);
    });

    // Cambio de canal
    socket.on('switch-channel', (newChannel) => {
        if (channels.includes(newChannel)) {
            socket.leave(currentChannel);
            currentChannel = newChannel;
            socket.join(currentChannel);
            socket.emit('channel-switched', { channel: currentChannel, pinnedMessage });
        }
    });

    // Envío de mensajes normales y respuestas
    socket.on('send-message', (data) => {
        const payload = {
            id: Date.now(),
            user: currentUser,
            text: data.text,
            replyTo: data.replyTo || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        io.to(currentChannel).emit('receive-message', payload);
    });

    // Fijar mensaje
    socket.on('pin-message', (text) => {
        pinnedMessage = { user: currentUser, text };
        io.emit('update-pinned', pinnedMessage);
    });

    // Indicador de "Escribiendo..."
    socket.on('typing', (isTyping) => {
        socket.to(currentChannel).emit('user-typing', { user: currentUser, isTyping });
    });

    // Envío de archivos y multimedia
    socket.on('send-media', (data) => {
        io.to(currentChannel).emit('receive-media', {
            user: currentUser,
            type: data.type,
            url: data.url,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('share-file', (data) => {
        io.to(currentChannel).emit('receive-file', {
            user: currentUser,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Sistema de Encuestas (Polls)
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

    // Dibujo en Pizarra
    socket.on('share-drawing', (dataUrl) => {
        io.to(currentChannel).emit('receive-media', {
            user: currentUser,
            type: 'drawing',
            url: dataUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Chat LAN corriendo en http://localhost:${PORT}`);
});