const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuración de almacenamiento para archivos
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

// Configuración de Canales e Historial por Canal
const SECRET_HISTORY_PASSWORD = 'admin'; // Cambia esta contraseña si deseas
const channels = ['general', 'dudas', 'anuncios', 'historial'];

// Historial estructurado por cada canal
const channelHistories = {
    general: [],
    dudas: [],
    anuncios: [],
    historial: [] // Guarda el registro global de todo lo que ocurre
};

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

    // Cambio de canal guardando y enviando su historial
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
            
            // Envía el historial acumulado en ese canal específico (o todo si es #historial)
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

    // Envío de mensajes normales
    socket.on('send-message', (data) => {
        const payload = {
            type: 'text',
            id: Date.now(),
            user: currentUser,
            text: data.text,
            channel: currentChannel,
            replyTo: data.replyTo || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        // Guardar en el historial del canal actual y en el historial global
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

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

    // Envío de imágenes / GIFs / Pizarra
    socket.on('send-media', (data) => {
        const payload = {
            type: 'media',
            mediaType: data.type,
            user: currentUser,
            url: data.url,
            channel: currentChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-media', payload);
    });

    // Envío de archivos
    socket.on('share-file', (data) => {
        const payload = {
            type: 'file',
            user: currentUser,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            channel: currentChannel,
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
            mediaType: 'drawing',
            user: currentUser,
            url: dataUrl,
            channel: currentChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (channelHistories[currentChannel]) channelHistories[currentChannel].push(payload);
        channelHistories.historial.push(payload);

        io.to(currentChannel).emit('receive-media', payload);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Chat LAN corriendo en http://localhost:${PORT}`);
});