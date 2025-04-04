import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.VITE_APP_URL,
    methods: ["GET", "POST"]
  }
});

// Configure CORS for Express
app.use(cors({
  origin: process.env.VITE_APP_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Room Schema
const roomSchema = new mongoose.Schema({
  name: String,
  videoUrl: String,
  isLocalFile: { type: Boolean, default: false },
  localFilePath: String,
  pin: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Message Schema
const messageSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: String,
  timestamp: { type: Date, default: Date.now }
});

// Define models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Video Streaming Route
app.get('/api/stream/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room || !room.isLocalFile || !room.localFilePath) {
      return res.status(404).send('Video not found');
    }

    const filePath = room.localFilePath;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).send('Error streaming video');
  }
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      password: hashedPassword
    });
    await user.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key');
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Room Routes
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const room = new Room({
      name: req.body.name,
      videoUrl: req.body.videoUrl,
      isLocalFile: req.body.isLocalFile,
      localFilePath: req.body.localFilePath,
      pin: req.body.pin,
      creator: req.user.id
    });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find().populate('creator', 'username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms/:id/verify-pin', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.pin !== req.body.pin) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }
    res.json({ 
      success: true, 
      videoUrl: room.isLocalFile ? `/api/stream/${room._id}` : room.videoUrl,
      isLocalFile: room.isLocalFile 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:id/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.id })
      .populate('user', 'username')
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io Logic
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        videoState: { isPlaying: false, currentTime: 0 },
        users: new Set()
      });
    }
    rooms.get(roomId).users.add(socket.id);
  });

  socket.on('video-state-change', ({ roomId, videoState }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.videoState = videoState;
      socket.to(roomId).emit('video-state-update', videoState);
    }
  });

  socket.on('chat-message', async ({ roomId, message, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const newMessage = new Message({
        room: roomId,
        user: decoded.id,
        message: message
      });
      await newMessage.save();
      const populatedMessage = await Message.findById(newMessage._id).populate('user', 'username');
      io.to(roomId).emit('chat-message', {
        message: populatedMessage.message,
        username: populatedMessage.user.username,
        timestamp: populatedMessage.timestamp
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      room.users.delete(socket.id);
      if (room.users.size === 0) {
        rooms.delete(roomId);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});