/**
 * persistence.js
 * ==============
 * Gerencia a persistência de projetos no localStorage do navegador.
 *
 * ESTRATÉGIA DE ARMAZENAMENTO
 * ───────────────────────────
 * - Cada projeto é salvo como JSON na chave `pm_<nome>`.
 * - Uma chave especial `pm___list__` guarda a lista de nomes de projetos.
 * - O rascunho automático é salvo em `pm___autosave__` a cada alteração.
 * - Na abertura do app, o rascunho automático é restaurado se existir.
 *
 * FORMATO DO DADO SALVO
 * ─────────────────────
 * {
 *   name:     string,     // Nome do projeto
 *   entities: Entity[],   // Array de entidades
 *   eid:      number,     // Último ID usado (para continuar a sequência)
 *   date:     string      // Data/hora ISO da última gravação
 * }
 */

/* ─────────────────────────────────────────────────────────────
   AUTO-SAVE (DEBOUNCE)
   ───────────────────────────────────────────────────────────── */

/**
 * Agenda um auto-save com debounce: espera AUTOSAVE_DELAY ms sem
 * novas chamadas antes de gravar. Evita salvar a cada keystroke.
 * Atualiza o texto de status da barra inferior.
 */
function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = buildProjectData(currentProjectName);
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));

      // Exibe hora do último save na barra de status
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('sb-save').textContent = 'Salvo ' + time;
    } catch (e) {
      // localStorage pode estar cheio ou bloqueado (modo privado em alguns browsers)
      console.warn('Auto-save falhou:', e);
    }
  }, AUTOSAVE_DELAY);
}

/* ─────────────────────────────────────────────────────────────
   SALVAR PROJETO COM NOME
   ───────────────────────────────────────────────────────────── */

/**
 * Pede um nome ao usuário e salva o projeto no localStorage.
 * Adiciona o nome à lista de projetos se for novo.
 */
function saveProject() {
  const name = prompt('Nome do projeto:', currentProjectName) || currentProjectName;
  currentProjectName = name;

  try {
    const data = buildProjectData(name);
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));

    // Atualiza a lista de projetos
    const list = getProjectList();
    if (!list.includes(name)) {
      list.push(name);
      localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
    }

    showToast(`✓ Projeto "${name}" salvo no navegador`);
    document.getElementById('sb-save').textContent = 'Projeto: ' + name;
  } catch (e) {
    showToast('Erro ao salvar: localStorage indisponível');
    console.error(e);
  }
}

/* ─────────────────────────────────────────────────────────────
   MODAL DE CARREGAMENTO
   ───────────────────────────────────────────────────────────── */

/**
 * Abre o modal listando todos os projetos salvos.
 * Cada projeto tem botões "Abrir" e "Deletar".
 */
function openLoadModal() {
  const list = getProjectList();
  const div  = document.getElementById('modal-list');

  if (list.length === 0) {
    div.innerHTML = '<p style="color:#9ca3af;font-size:12px">Nenhum projeto salvo ainda.</p>';
  } else {
    div.innerHTML = list.map(name => {
      // Carrega metadados para exibir a data
      let dateStr = '';
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + name) || '{}');
        if (saved.date) {
          dateStr = new Date(saved.date).toLocaleString('pt-BR');
        }
      } catch (_) {}

      return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #f3f4f6">
        <div style="flex:1">
          <b style="font-size:12px">${name}</b><br>
          <span style="font-size:10px;color:#9ca3af">${dateStr}</span>
        </div>
        <button class="modal-btn primary" onclick="loadProject('${name}')">Abrir</button>
        <button class="modal-btn" onclick="deleteProject('${name}')" style="color:#dc2626">Del</button>
      </div>`;
    }).join('');
  }

  document.getElementById('modal-bg').style.display = 'flex';
}

/**
 * Fecha o modal de carregamento.
 */
function closeModal() {
  document.getElementById('modal-bg').style.display = 'none';
}

/* ─────────────────────────────────────────────────────────────
   CARREGAR E DELETAR PROJETOS
   ───────────────────────────────────────────────────────────── */

/**
 * Carrega um projeto pelo nome: restaura `entities`, `eid` e `currentProjectName`.
 * @param {string} name
 */
function loadProject(name) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + name);
    if (!raw) { showToast('Projeto não encontrado'); return; }

    const data     = JSON.parse(raw);
    entities       = data.entities || [];
    eid            = data.eid || 0;
    currentProjectName = data.name || name;

    selected.clear();
    render();
    closeModal();
    showToast(`✓ Projeto "${name}" carregado`);
    document.getElementById('sb-save').textContent = 'Projeto: ' + name;
  } catch (e) {
    showToast('Erro ao carregar projeto');
    console.error(e);
  }
}

/**
 * Remove um projeto do localStorage após confirmação do usuário.
 * @param {string} name
 */
function deleteProject(name) {
  if (!confirm(`Deletar o projeto "${name}"? Essa ação não pode ser desfeita.`)) return;

  localStorage.removeItem(STORAGE_PREFIX + name);

  // Remove da lista de projetos
  const list = getProjectList().filter(n => n !== name);
  localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));

  // Reabre o modal para mostrar a lista atualizada
  openLoadModal();
}

/* ─────────────────────────────────────────────────────────────
   IMPORTAÇÃO DE ARQUIVO JSON
   ───────────────────────────────────────────────────────────── */

/**
 * Importa um projeto a partir de um arquivo .json selecionado pelo usuário.
 * Chamado pelo input[type=file] oculto no modal.
 * @param {Event} event - Evento de mudança do input
 */
function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      entities       = data.entities || [];
      eid            = data.eid || 0;
      currentProjectName = data.name || file.name.replace('.json', '');

      selected.clear();
      render();
      closeModal();
      showToast(`✓ Projeto importado: ${currentProjectName}`);
    } catch (err) {
      showToast('Arquivo inválido ou corrompido');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

/* ─────────────────────────────────────────────────────────────
   RESTAURAÇÃO DO RASCUNHO AUTOMÁTICO
   ───────────────────────────────────────────────────────────── */

/**
 * Tenta restaurar o último rascunho salvo automaticamente.
 * Chamado uma vez na inicialização do app.
 */
function restoreAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    entities   = data.entities || [];
    eid        = data.eid      || 0;
    showToast('Rascunho anterior restaurado');
  } catch (e) {
    // Rascunho corrompido — ignora silenciosamente
    console.warn('Não foi possível restaurar o rascunho:', e);
  }
}

/* ─────────────────────────────────────────────────────────────
   UTILITÁRIOS DE PERSISTÊNCIA
   ───────────────────────────────────────────────────────────── */

/**
 * Constrói o objeto de dados a ser serializado e salvo.
 * @param {string} name
 * @returns {object}
 */
function buildProjectData(name) {
  return {
    name,
    entities,
    eid,
    date: new Date().toISOString()
  };
}

/**
 * Retorna a lista de nomes de projetos salvos no localStorage.
 * @returns {string[]}
 */
function getProjectList() {
  try {
    return JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   TOAST DE NOTIFICAÇÃO
   ───────────────────────────────────────────────────────────── */

/**
 * Exibe uma notificação temporária no rodapé da tela.
 * Desaparece automaticamente após TOAST_DURATION ms.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, TOAST_DURATION);
}

/* ─────────────────────────────────────────────────────────────
   INICIALIZAÇÃO DO MODAL
   ───────────────────────────────────────────────────────────── */

/**
 * Vincula os eventos do modal de carregamento.
 * Chamado uma vez na inicialização do app.
 */
function initPersistenceModal() {
  // Fechar o modal clicando no fundo escuro
  document.getElementById('modal-bg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-bg')) closeModal();
  });
}
