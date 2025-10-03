const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SQLite Database (file-based, no installation needed)
const db = new sqlite3.Database('./tracking.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    
    // Create vehicles table
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plat_nomor TEXT UNIQUE,
      driver_name TEXT,
      latitude REAL,
      longitude REAL,
      speed REAL,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      } else {
        console.log('✅ Vehicles table ready');
        
        // Insert sample data
        const sampleData = [
          ['B 1234 ABC', 'Driver A', -6.2088, 106.8456, 40],
          ['B 5678 XYZ', 'Driver B', -6.2146, 106.8451, 35]
        ];
        
        sampleData.forEach((vehicle) => {
          db.run(
            `INSERT OR IGNORE INTO vehicles (plat_nomor, driver_name, latitude, longitude, speed) 
             VALUES (?, ?, ?, ?, ?)`,
            vehicle
          );
        });
      }
    });
  }
});

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/vehicles', (req, res) => {
  db.all("SELECT * FROM vehicles", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/update-position', (req, res) => {
  const { plat_nomor, latitude, longitude, speed } = req.body;
  
  const query = `
    INSERT INTO vehicles (plat_nomor, latitude, longitude, speed, last_update)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(plat_nomor) 
    DO UPDATE SET 
      latitude = excluded.latitude,
      longitude = excluded.longitude, 
      speed = excluded.speed,
      last_update = datetime('now')
  `;
  
  db.run(query, [plat_nomor, latitude, longitude, speed], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Emit real-time update
      io.emit('position_update', { plat_nomor, latitude, longitude, speed });
      res.json({ success: true });
    }
  });
});

// Socket.io Real-time
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('📱 Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚗 Vehicle Tracking Server running on port ${PORT}`);
  console.log(`📱 Akses via: http://localhost:${PORT}`);
  console.log(`✅ READY FOR MOBILE ACCESS!`);
});