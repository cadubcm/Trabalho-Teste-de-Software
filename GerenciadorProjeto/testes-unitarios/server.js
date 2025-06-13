const { app, dbPromise } = require('./app');

const PORT = 3000;

dbPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch(err => {
    console.error("Falha ao iniciar o servidor, o banco de dados não pôde ser inicializado.", err);
});
