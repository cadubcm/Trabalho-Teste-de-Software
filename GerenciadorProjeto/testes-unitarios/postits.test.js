const request = require('supertest');
const { app, dbPromise } = require('./app');

let db;

beforeAll(async () => {
  db = await dbPromise;
});

beforeEach(async () => {
  await db.run('DELETE FROM users');
  await db.run('DELETE FROM postits');
  await db.run("DELETE FROM sqlite_sequence WHERE name IN ('users', 'postits')");
});

describe('API de Autenticação', () => {
  const testUser = {
    username: 'usuarioTeste',
    password: 'senha123'
  };

  it('Deve registrar um novo usuário com sucesso', async () => {
    const res = await request(app)
      .post('/api/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true });
  });

  it('Não deve registrar um usuário com nome duplicado', async () => {
    await request(app).post('/api/register').send(testUser); 
    const res = await request(app).post('/api/register').send(testUser);

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error', 'Usuário já existe');
  });

  it('Deve fazer login com um usuário existente e retornar um token', async () => {
    await request(app).post('/api/register').send(testUser);

    const res = await request(app)
      .post('/api/login')
      .send(testUser);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user', testUser.username);
  });
});

describe('API de Post-its', () => {
  let token;
  const testUser = { username: 'user_postit', password: '123' };

  beforeEach(async () => {
    await request(app).post('/api/register').send(testUser);
    const res = await request(app).post('/api/login').send(testUser);
    token = res.body.token;
  });

  it('Deve criar um post-it (POST /api/postits)', async () => {
    const res = await request(app)
      .post('/api/postits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Teste Jest',
        text: 'Teste automático',
        color: 'yellow',
        done: false,
        responsible: 'eu',
        deadline: '2025-12-25'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Teste Jest');
  });

  it('Deve listar os post-its do usuário (GET /api/postits)', async () => {
    await request(app)
        .post('/api/postits')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Post-it para listar', text: '...' });
    
    const res = await request(app)
      .get('/api/postits')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Post-it para listar');
  });

  it('Deve atualizar um post-it (PUT /api/postits/:id)', async () => {
    const postRes = await request(app)
      .post('/api/postits')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Original' });
    
    const createdPostItId = postRes.body.id;

    const updatedData = {
        title: 'Teste Jest Atualizado',
        text: 'Texto atualizado',
        color: 'green',
        done: true,
        responsible: 'Jest',
        deadline: '2026-01-01'
    };
    const res = await request(app)
      .put(`/api/postits/${createdPostItId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedData);

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Teste Jest Atualizado');
    expect(res.body.done).toBe(true);
  });

  it('Deve deletar um post-it (DELETE /api/postits/:id)', async () => {
    const postRes = await request(app)
      .post('/api/postits')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Para deletar' });
    
    const createdPostItId = postRes.body.id;
    const res = await request(app)
      .delete(`/api/postits/${createdPostItId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const getRes = await request(app)
      .get('/api/postits')
      .set('Authorization', `Bearer ${token}`);
    
    expect(getRes.body.length).toBe(0);
  });
});