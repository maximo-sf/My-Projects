const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
        originalName: req.file.originalname,
        fileName: req.file.filename,
        fileUrl: fileUrl,
        size: req.file.size
    });
});

// Socket.io real-time connection handler
io.on('connection', (socket) => {
    let currentUser = 'Anonymous';

    socket.on('user-join', (username) => {
        currentUser = username && username.trim() !== '' ? username : 'Anonymous';
        io.emit('system-notification', `${currentUser} joined the chat`);
    });

    socket.on('send-message', (data) => {
        io.emit('receive-message', {
            user: currentUser,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('share-file', (data) => {
        io.emit('receive-file', {
            user: currentUser,
            fileName: data.originalName,
            fileUrl: data.fileUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        io.emit('system-notification', `${currentUser} left the chat`);
    });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Binds to all local network interfaces

server.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Share this server's LAN IP with classmates on port ${PORT}`);
});
