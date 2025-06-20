const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const adminDB = require('./admin.db.js');
const SECRET = process.env.ADMIN_JWT_SECRET || 'supersecretkey';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store waiting users and active connections
const waitingUsers = new Map();
const activeConnections = new Map();
const recentMessages = new Map(); // Store recent messages for admin monitoring
const userModes = new Map(); // Store user chat modes
const searchIntervals = new Map(); // Store search intervals for each user
const userUsernames = new Map(); // Store user usernames

adminDB.initDB();

// Middleware for admin authentication
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.admin = decoded;
    next();
  });
}

// Admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  adminDB.verifyAdmin(username, password, (err, admin) => {
    if (err || !admin) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin.id, username: admin.username }, SECRET, { expiresIn: '8h' });
    res.json({ token });
  });
});

// Create admin (first time setup)
app.post('/admin/create', (req, res) => {
  const { username, password } = req.body;
  adminDB.createAdmin(username, password, (err) => {
    if (err) return res.status(400).json({ error: 'Could not create admin (maybe already exists)' });
    res.json({ success: true });
  });
});

// List active chats
app.get('/admin/active-chats', adminAuth, (req, res) => {
  const chats = [];
  for (const [userId, partnerId] of activeConnections.entries()) {
    if (userId < partnerId) { // avoid duplicates
      const userMode = userModes.get(userId) || 'both';
      const partnerMode = userModes.get(partnerId) || 'both';
      const userUsername = userUsernames.get(userId) || 'Anonymous';
      const partnerUsername = userUsernames.get(partnerId) || 'Anonymous';
      chats.push({ 
        userId, 
        partnerId, 
        userMode, 
        partnerMode,
        userUsername,
        partnerUsername
      });
    }
  }
  res.json({ chats });
});

// List recent messages
app.get('/admin/recent-messages', adminAuth, (req, res) => {
  const allMessages = [];
  for (const [chatId, messages] of recentMessages.entries()) {
    allMessages.push(...messages.map(msg => ({
      ...msg,
      chatId
    })));
  }
  // Sort by timestamp, most recent first
  allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ messages: allMessages.slice(0, 50) }); // Return last 50 messages
});

// List bans
app.get('/admin/bans', adminAuth, (req, res) => {
  adminDB.getAllBans((err, bans) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ bans });
  });
});

// Ban a user
app.post('/admin/ban', adminAuth, (req, res) => {
  const { identifier, reason } = req.body;
  adminDB.addBan(identifier, reason || '', (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    // Optionally disconnect banned user
    const socketToBan = io.sockets.sockets.get(identifier);
    if (socketToBan) socketToBan.disconnect(true);
    res.json({ success: true });
  });
});

// Unban a user
app.post('/admin/unban', adminAuth, (req, res) => {
  const { identifier } = req.body;
  adminDB.removeBan(identifier, (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

// Enforce bans on connection
io.use((socket, next) => {
  const identifier = socket.id; // You can use IP: socket.handshake.address
  adminDB.isBanned(identifier, (err, banned) => {
    if (banned) return next(new Error('You are banned'));
    next();
  });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user looking for a match
  socket.on('findMatch', (data) => {
    console.log('User looking for match:', socket.id, 'Mode:', data?.mode || 'both', 'Username:', data?.username || 'Anonymous');
    
    // Disconnect from current partner and reset their state if exists
    if (activeConnections.has(socket.id)) {
      const partnerId = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
      
      // Reset partner's state and notify them
      resetUserStateOnly(partnerId);
      io.to(partnerId).emit('partnerDisconnected');
    }
    
    // Completely reset user state before starting new search
    resetUserState(socket.id);

    const userMode = data?.mode || 'both';
    const username = data?.username || 'Anonymous';
    
    userModes.set(socket.id, userMode);
    userUsernames.set(socket.id, username);

    // Add to waiting queue
    waitingUsers.set(socket.id, {
      timestamp: Date.now(),
      socketId: socket.id,
      username: username
    });
    
    // Start continuous search
    startContinuousSearch(socket.id);
    
    // Notify user they're waiting
    socket.emit('waitingForMatch');
    console.log('User added to waiting queue with continuous search:', socket.id, 'Mode:', userMode, 'Username:', username);
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  socket.on('iceCandidate', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('iceCandidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  // Handle text chat messages
  socket.on('textMessage', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      const username = userUsernames.get(socket.id) || 'Anonymous';
      const messageData = {
        message: data.message,
        from: socket.id,
        to: partnerId,
        username: username,
        timestamp: new Date().toISOString()
      };
      
      // Store message for admin monitoring (keep last 100 messages)
      const chatId = [socket.id, partnerId].sort().join('-');
      if (!recentMessages.has(chatId)) {
        recentMessages.set(chatId, []);
      }
      const messages = recentMessages.get(chatId);
      messages.push(messageData);
      if (messages.length > 100) {
        messages.shift(); // Remove oldest message
      }
      
      io.to(partnerId).emit('textMessage', {
        message: data.message,
        from: socket.id,
        username: username,
        timestamp: messageData.timestamp
      });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('typing', {
        isTyping: data.isTyping,
        from: socket.id
      });
    }
  });

  // Handle next match request
  socket.on('nextMatch', () => {
    console.log('User requesting next match:', socket.id);
    
    // Get current user mode before cleanup
    const currentMode = userModes.get(socket.id) || 'both';
    
    // Disconnect from current partner and reset their state
    if (activeConnections.has(socket.id)) {
      const partnerId = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
      
      // Reset partner's state and notify them
      resetUserStateOnly(partnerId);
      io.to(partnerId).emit('partnerDisconnected');
    }
    
    // Completely reset user state
    resetUserState(socket.id);
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      // Find new match with current mode
      socket.emit('findMatch', { mode: currentMode });
    }, 100);
  });

  // Handle end chat request
  socket.on('endChat', () => {
    console.log('User ending chat:', socket.id);
    
    // Disconnect from current partner
    if (activeConnections.has(socket.id)) {
      const partnerId = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
      
      // Reset partner's state and notify them
      resetUserStateOnly(partnerId);
      io.to(partnerId).emit('partnerDisconnected');
    }
    
    // Stop searching for this user
    stopSearchingForUser(socket.id);
    
    // Clear user mode
    userModes.delete(socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Stop searching for this user
    stopSearchingForUser(socket.id);
    
    // Handle active connection
    if (activeConnections.has(socket.id)) {
      const partnerId = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
      
      // Notify partner
      io.to(partnerId).emit('partnerDisconnected');
    }
    
    // Clear user mode
    userModes.delete(socket.id);
  });
});

// Clean up stale waiting users (older than 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, userData] of waitingUsers.entries()) {
    if (now - userData.timestamp > 5 * 60 * 1000) {
      waitingUsers.delete(userId);
      io.to(userId).emit('matchTimeout');
    }
  }
}, 60000); // Check every minute

// Function to completely reset a user's state
function resetUserState(userId) {
  console.log(`Resetting state for user: ${userId}`);
  
  // Remove from active connections
  if (activeConnections.has(userId)) {
    const partnerId = activeConnections.get(userId);
    activeConnections.delete(userId);
    activeConnections.delete(partnerId);
    
    // Notify partner that user disconnected
    io.to(partnerId).emit('partnerDisconnected');
  }
  
  // Stop searching for this user
  stopSearchingForUser(userId);
  
  // Clear user mode and username
  userModes.delete(userId);
  userUsernames.delete(userId);
  
  console.log(`State reset complete for user: ${userId}`);
}

// Function to reset a user's state without affecting their partner (for when partner disconnects)
function resetUserStateOnly(userId) {
  console.log(`Resetting state for user (only): ${userId}`);
  
  // Remove from active connections
  if (activeConnections.has(userId)) {
    const partnerId = activeConnections.get(userId);
    activeConnections.delete(userId);
    activeConnections.delete(partnerId);
  }
  
  // Stop searching for this user
  stopSearchingForUser(userId);
  
  // Clear user mode and username
  userModes.delete(userId);
  userUsernames.delete(userId);
  
  console.log(`State reset complete for user (only): ${userId}`);
}

// Function to find matches for a specific user
function findMatchForUser(userId) {
  const userMode = userModes.get(userId) || 'both';
  console.log(`Looking for match for user ${userId} with mode: ${userMode}`);
  console.log(`Current waiting users: ${waitingUsers.size}`);
  
  // Check if there's a waiting user with compatible mode (excluding self)
  for (const [waitingUserId, waitingUser] of waitingUsers.entries()) {
    if (waitingUserId === userId) {
      console.log(`Skipping self-match for user ${userId}`);
      continue; // Don't match with self
    }
    
    const waitingUserMode = userModes.get(waitingUserId) || 'both';
    console.log(`Checking compatibility: ${userMode} vs ${waitingUserMode} (user: ${waitingUserId})`);
    
    // Check if modes are compatible
    const isCompatible = (
      (userMode === 'text' && waitingUserMode === 'text') ||
      (userMode === 'both' && waitingUserMode === 'both') ||
      (userMode === 'both' && waitingUserMode === 'text') ||
      (userMode === 'text' && waitingUserMode === 'both')
    );
    
    if (isCompatible) {
      console.log(`Compatible match found! ${userId} (${userMode}) with ${waitingUserId} (${waitingUserMode})`);
      
      // Remove both users from waiting queue
      waitingUsers.delete(userId);
      waitingUsers.delete(waitingUserId);
      
      // Clear search intervals for both users
      if (searchIntervals.has(userId)) {
        clearInterval(searchIntervals.get(userId));
        searchIntervals.delete(userId);
        console.log(`Cleared search interval for user: ${userId}`);
      }
      if (searchIntervals.has(waitingUserId)) {
        clearInterval(searchIntervals.get(waitingUserId));
        searchIntervals.delete(waitingUserId);
        console.log(`Cleared search interval for user: ${waitingUserId}`);
      }
      
      // Create connection between users
      activeConnections.set(userId, waitingUserId);
      activeConnections.set(waitingUserId, userId);
      
      // Determine the actual chat mode for both users
      const actualMode = determineChatMode(userMode, waitingUserMode);
      
      // Notify both users they're matched
      io.to(userId).emit('matchFound', { 
        partnerId: waitingUserId,
        mode: actualMode,
        partnerUsername: userUsernames.get(waitingUserId) || 'Anonymous'
      });
      io.to(waitingUserId).emit('matchFound', { 
        partnerId: userId,
        mode: actualMode,
        partnerUsername: userUsernames.get(userId) || 'Anonymous'
      });
      
      console.log('Match created between:', userId, 'and', waitingUserId, 'Mode:', actualMode);
      return true; // Match found
    } else {
      console.log(`Modes not compatible: ${userMode} vs ${waitingUserMode}`);
    }
  }
  
  console.log(`No compatible match found for user ${userId}`);
  return false; // No match found
}

// Function to start continuous search for a user
function startContinuousSearch(userId) {
  // Clear any existing interval
  if (searchIntervals.has(userId)) {
    clearInterval(searchIntervals.get(userId));
  }
  
  console.log(`Starting continuous search for user: ${userId}`);
  
  // Start new search interval
  const interval = setInterval(() => {
    // Check if user is still connected
    if (!io.sockets.sockets.has(userId)) {
      console.log(`User ${userId} disconnected, clearing search interval`);
      clearInterval(interval);
      searchIntervals.delete(userId);
      return;
    }
    
    // Check if user is still waiting - if not, stop searching
    if (!waitingUsers.has(userId)) {
      console.log(`User ${userId} no longer in waiting queue, clearing search interval`);
      clearInterval(interval);
      searchIntervals.delete(userId);
      return;
    }
    
    // Try to find a match
    const matchFound = findMatchForUser(userId);
    if (matchFound) {
      console.log(`Match found for user ${userId}, clearing search interval`);
      clearInterval(interval);
      searchIntervals.delete(userId);
    } else {
      // Update timestamp to keep user in queue
      const userData = waitingUsers.get(userId);
      userData.timestamp = Date.now();
      waitingUsers.set(userId, userData);
      console.log(`No match found for user ${userId}, continuing search...`);
    }
  }, 1000); // Check every 1 second
  
  searchIntervals.set(userId, interval);
}

// Helper function to determine actual chat mode
function determineChatMode(mode1, mode2) {
  if (mode1 === 'both' && mode2 === 'both') return 'both';
  if (mode1 === 'both' && mode2 === 'text') return 'text';
  if (mode1 === 'text' && mode2 === 'both') return 'text';
  if (mode1 === 'text' && mode2 === 'text') return 'text';
  return 'both'; // fallback
}

// Function to stop searching for a user
function stopSearchingForUser(userId) {
  console.log(`Stopping search for user: ${userId}`);
  
  // Remove from waiting queue
  waitingUsers.delete(userId);
  
  // Clear search interval
  if (searchIntervals.has(userId)) {
    clearInterval(searchIntervals.get(userId));
    searchIntervals.delete(userId);
    console.log(`Cleared search interval for user: ${userId}`);
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});