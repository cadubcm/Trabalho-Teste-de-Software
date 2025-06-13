let user = null;
let authToken = null;

async function apiRequest(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  } catch (error) {
    console.error('Erro na API:', error);
    throw error;
  }
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) {
    alert('Por favor, preencha usuário e senha.');
    return;
  }

  try {
    const response = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    user = response.user;
    authToken = response.token;
    
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    showBoard();
  } catch (error) {
    alert('Erro no login: ' + error.message);
  }
}

async function register() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) {
    alert('Por favor, preencha usuário e senha.');
    return;
  }

  try {
    await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    alert('Usuário criado com sucesso! Faça login para continuar.');
  } catch (error) {
    alert('Erro no registro: ' + error.message);
  }
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  authToken = null;
  user = null;
  location.reload();
}

function showBoard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('board-page').style.display = 'flex';
  document.getElementById('current-user').textContent = user.username;
  loadPostIts();
}

async function addPostIt() {
  const board = document.getElementById('board');
  if (board.children.length >= 8) {
    alert('Máximo de 8 post-its atingido.');
    return;
  }

  const color = document.getElementById('color-select').value;

  try {
    const newPostIt = await apiRequest('/api/postits', {
      method: 'POST',
      body: JSON.stringify({
        title: '',
        text: '',
        color
      })
    });

    await loadPostIts();
  } catch (error) {
    alert('Erro ao criar post-it: ' + error.message);
  }
}

async function loadPostIts() {
  try {
    const postIts = await apiRequest('/api/postits');
    renderPostIts(postIts);
  } catch (error) {
    console.error('Erro ao carregar post-its:', error);
    if (error.message.includes('Token')) {
      logout();
    }
  }
}

function renderPostIts(postIts) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  postIts.forEach(postIt => {
    const div = document.createElement('div');
    div.className = `postit ${postIt.color}`;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Título';
    titleInput.value = postIt.title || '';
    titleInput.className = 'postit-title';
    titleInput.onchange = () => updatePostIt(postIt.id, {
      ...postIt,
      title: titleInput.value
    });

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Descrição...';
    textarea.value = postIt.text || '';
    textarea.onchange = () => updatePostIt(postIt.id, {
      ...postIt,
      text: textarea.value
    });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = postIt.done;
    checkbox.id = `done_${postIt.id}`;
    checkbox.onchange = () => updatePostIt(postIt.id, {
      ...postIt,
      done: checkbox.checked
    });

    const labelCheckbox = document.createElement('label');
    labelCheckbox.htmlFor = `done_${postIt.id}`;
    labelCheckbox.textContent = 'Concluído';

    const doneContainer = document.createElement('div');
    doneContainer.className = 'done-container';
    doneContainer.appendChild(checkbox);
    doneContainer.appendChild(labelCheckbox);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.className = 'delete-btn';
    delBtn.onclick = () => deletePostIt(postIt.id);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';
    actionsDiv.appendChild(delBtn);

    div.appendChild(titleInput);
    div.appendChild(textarea);
    div.appendChild(doneContainer);
    div.appendChild(actionsDiv);

    board.appendChild(div);
  });
}

async function updatePostIt(id, updatedData) {
  try {
    await apiRequest(`/api/postits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedData)
    });
  } catch (error) {
    console.error('Erro ao atualizar post-it:', error);
    alert('Erro ao atualizar post-it: ' + error.message);
  }
}

async function deletePostIt(id) {
  if (!confirm('Tem certeza que deseja excluir este post-it?')) {
    return;
  }

  try {
    await apiRequest(`/api/postits/${id}`, {
      method: 'DELETE'
    });
    await loadPostIts();
  } catch (error) {
    alert('Erro ao excluir post-it: ' + error.message);
  }
}

window.onload = () => {
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('currentUser');
  
  if (savedToken && savedUser) {
    authToken = savedToken;
    user = JSON.parse(savedUser);
    showBoard();
  }
};