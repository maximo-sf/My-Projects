const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuración de multer para subida de archivos
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

// Configuración de canales y contraseña del Historial Privado
const SECRET_HISTORY_PASSWORD = 'admin'; // Cambia 'admin' por la contraseña que tú quieras
const channels = ['general', 'dudas', 'anuncios', 'historial'];
const messageHistory = []; // Almacena el historial global
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

    // Verificación de canal privado / historial
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
            
            // Si entra al historial, le enviamos todos los mensajes registrados
            socket.emit('channel-switched', { 
                channel: currentChannel, 
                pinnedMessage,
                history: currentChannel === 'historial' ? messageHistory : []
            });
        }
    });

    // Envío de mensajes normales
    socket.on('send-message', (data) => {
        const payload = {
            id: Date.now(),
            user: currentUser,
            text: data.text,
            channel: currentChannel,
            replyTo: data.replyTo || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        // Guardar en el historial global
        messageHistory.push(payload);
        io.to(currentChannel).emit('receive-message', payload);
    });

    // Fijar mensaje
    socket.on('pin-message', (text) => {
        pinnedMessage = { user: currentUser, text };
        io.emit('update-pinned', pinnedMessage);
    });

    // Indicador de escribiendo
    socket.on('typing', (isTyping) => {
        socket.to(currentChannel).emit('user-typing', { user: currentUser, isTyping });
    });

    // Multimedia y archivos
    socket.on('send-media', (data) => {
        const payload = {
            user: currentUser,
            type: data.type,
            url: data.url,
            channel: currentChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        messageHistory.push(payload);
        io.to(currentChannel).emit('receive-media', payload);
    });

    socket.on('share-file', (data) => {
        const payload = {
            user: currentUser,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            channel: currentChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        messageHistory.push(payload);
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
            user: currentUser,
            type: 'drawing',
            url: dataUrl,
            channel: currentChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        messageHistory.push(payload);
        io.to(currentChannel).emit('receive-media', payload);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Chat LAN corriendo en http://localhost:${PORT}`);
});