const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'segredo';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db;

async function initDatabase() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS postits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT DEFAULT '',
      text TEXT DEFAULT '',
      color TEXT DEFAULT 'yellow',
      done BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const adminExists = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  const testExists = await db.get('SELECT id FROM users WHERE username = ?', ['teste']);

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
  }

  if (!testExists) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['teste', hashedPassword]);
  }

  console.log('Banco de dados SQLite inicializado com sucesso!');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);

    if (existing) {
      return res.status(409).json({ error: 'Usuário já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.json({
      success: true,
      message: 'Usuário criado com sucesso',
      userId: result.lastID
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/postits', authenticateToken, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM postits WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(rows);

  } catch (error) {
    console.error('Erro ao buscar post-its:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/postits', authenticateToken, async (req, res) => {
  try {
    const { title = '', text = '', color = 'yellow' } = req.body;

    const countResult = await db.get(
      'SELECT COUNT(*) as count FROM postits WHERE user_id = ?',
      [req.user.id]
    );

    if (countResult.count >= 8) {
      return res.status(400).json({ error: 'Máximo de 8 post-its atingido' });
    }

    const result = await db.run(
      'INSERT INTO postits (user_id, title, text, color) VALUES (?, ?, ?, ?)',
      [req.user.id, title, text, color]
    );

    const newPostIt = await db.get(
      'SELECT * FROM postits WHERE id = ?',
      [result.lastID]
    );

    res.json(newPostIt);

  } catch (error) {
    console.error('Erro ao criar post-it:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/postits/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text, color, done } = req.body;

    const existing = await db.get(
      'SELECT id FROM postits WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Post-it não encontrado' });
    }

    await db.run(
      'UPDATE postits SET title = ?, text = ?, color = ?, done = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, text, color, done, id]
    );

    const updatedPostIt = await db.get('SELECT * FROM postits WHERE id = ?', [id]);

    res.json(updatedPostIt);

  } catch (error) {
    console.error('Erro ao atualizar post-it:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/postits/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.get(
      'SELECT id FROM postits WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Post-it não encontrado' });
    }

    await db.run('DELETE FROM postits WHERE id = ?', [id]);

    res.json({ success: true, message: 'Post-it deletado com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar post-it:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log('Banco SQLite: database.sqlite');
  });
}).catch(err => {
  console.error('Erro ao inicializar banco:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Exceção não capturada:', err);
  process.exit(1);
});