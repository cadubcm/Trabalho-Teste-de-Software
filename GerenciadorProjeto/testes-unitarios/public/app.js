const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db;
const dbPromise = (async () => {
  try {
    db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    });

    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS postits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT,
        title TEXT,
        text TEXT,
        color TEXT,
        done INTEGER,
        responsible TEXT,
        deadline TEXT
      )
    `);
    console.log("Conexão com o banco de dados estabelecida com sucesso.");
    return db;
  } catch (err) {
    console.error("Falha ao inicializar o banco de dados:", err);
    process.exit(1);
  }
})();
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
      return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    res.status(201).json({ success: true }); 
  } catch (e) {
    res.status(409).json({ error: 'Usuário já existe' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ username }, 'secreto', { expiresIn: '1h' });
    res.json({ token, user: username });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido ou mal formatado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, 'secreto');
    req.user = decoded.username;
    next();
  } catch {
    res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}

app.get('/api/postits', auth, async (req, res) => {
  const postits = await db.all('SELECT * FROM postits WHERE user = ?', [req.user]);
  res.json(postits);
});

app.post('/api/postits', auth, async (req, res) => {
  const { title, text, color, done, responsible, deadline } = req.body;
  const result = await db.run(
    'INSERT INTO postits (user, title, text, color, done, responsible, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user, title, text, color, done ? 1 : 0, responsible, deadline]
  );
  const id = result.lastID;
  res.status(201).json({ id, title, text, color, done: !!done, responsible, deadline });
});

app.put('/api/postits/:id', auth, async (req, res) => {
  const { title, text, color, done, responsible, deadline } = req.body;
  const result = await db.run(
    'UPDATE postits SET title=?, text=?, color=?, done=?, responsible=?, deadline=? WHERE id=? AND user=?',
    [title, text, color, done ? 1 : 0, responsible, deadline, req.params.id, req.user]
  );

  if (result.changes === 0) {
      return res.status(404).json({ error: 'Post-it não encontrado ou não pertence ao usuário.'})
  }

  res.json({ id: parseInt(req.params.id), title, text, color, done: !!done, responsible, deadline });
});

app.delete('/api/postits/:id', auth, async (req, res) => {
  const result = await db.run('DELETE FROM postits WHERE id=? AND user=?', [req.params.id, req.user]);
  if (result.changes === 0) {
      return res.status(404).json({ error: 'Post-it não encontrado ou não pertence ao usuário.'})
  }
  res.json({ success: true });
});

module.exports = { app, dbPromise };