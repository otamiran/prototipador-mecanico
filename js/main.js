/**
 * main.js
 * =======
 * Ponto de entrada e orquestração da aplicação.
 *
 * Responsabilidades:
 *   - Inicializar o app (restaurar rascunho, vincular eventos, render inicial)
 *   - Gerenciar a ferramenta ativa e suas transições de estado
 *   - Processar eventos de canvas (mousemove, click, mousedown, mouseup)
 *   - Processar eventos de entidades (click, mousedown)
 *   - Atalhos de teclado
 *   - Ações globais: undo, clearAll, toggleGrid, toggleSnap
 *
 * Este arquivo depende de todos os outros módulos e deve ser carregado por último.
 */

/* ─────────────────────────────────────────────────────────────
   INICIALIZAÇÃO
   ───────────────────────────────────────────────────────────── */

/**
 * Inicializa a aplicação.
 * Chamado quando o DOM estiver pronto (window.onload ou defer).
 */
function init() {
  // Vincula os event listeners do canvas e do documento
  bindCanvasEvents();
  bindKeyboardShortcuts();

  // Vincula os event listeners dos módulos auxiliares
  initDimOverlay();       // dimension.js
  initPersistenceModal(); // persistence.js

  // Tenta restaurar o último rascunho automático do localStorage
  restoreAutosave();      // persistence.js

  // Define a ferramenta inicial e renderiza o estado restaurado
  setTool('select');
  render();
}

// Executa após o carregamento completo da página
window.addEventListener('load', init);

/* ─────────────────────────────────────────────────────────────
   GERENCIAMENTO DE FERRAMENTAS
   ───────────────────────────────────────────────────────────── */

/**
 * Ativa uma ferramenta e atualiza a interface (toolbar, status bar).
 * Limpa o estado de construção e o grupo temporário ao trocar de ferramenta.
 *
 * @param {string} toolId - ID da ferramenta a ativar
 */
function setTool(toolId) {
  tool       = toolId;
  buildState = null;

  // Atualiza os botões do toolbar: remove 'on' de todos, adiciona na ferramenta ativa
  document.querySelectorAll('[id^="tb-"]').forEach(btn => {
    // Grade e snap têm seu próprio estado — não alterar aqui
    if (btn.id === 'tb-grid' || btn.id === 'tb-snap') return;
    btn.classList.remove('on');
  });
  document.getElementById('tb-' + toolId)?.classList.add('on');

  // Atualiza a barra de status
  document.getElementById('sb-tool').textContent = 'Ferramenta: ' + (TOOL_NAMES[toolId] || toolId);
  document.getElementById('sb-hint').textContent = TOOL_HINTS[toolId] || '';

  // Ferramentas de desenho não mantêm seleção
  if (toolId !== 'select') selected.clear();

  // Limpa o shape temporário
  document.getElementById('gt').innerHTML = '';

  closeDimEdit(); // Fecha overlay de cota se aberto
  render();
}

/* ─────────────────────────────────────────────────────────────
   EVENTOS DE ENTIDADES
   ───────────────────────────────────────────────────────────── */

/**
 * Processa o mousedown em uma entidade (para iniciar seleção).
 * O drag de alças é tratado em render.js/renderHandles().
 *
 * @param {number} entityId
 * @param {MouseEvent} event
 */
function onEntityMouseDown(entityId, event) {
  if (event.button !== 0) return; // Apenas botão esquerdo

  if (tool === 'select') {
    // Shift+Clique: adiciona/remove da seleção múltipla
    if (!event.shiftKey) selected.clear();
    selected.add(entityId);
    render();
  }
}

/**
 * Processa o click em uma entidade.
 * O comportamento varia conforme a ferramenta ativa.
 *
 * @param {number} entityId
 */
function onEntityClick(entityId) {
  if (tool === 'delete') {
    // Remove a entidade e qualquer seleção dela
    pushUndoSnapshot();
    entities = entities.filter(e => e.id !== entityId);
    selected.delete(entityId);
    render();
    autoSave();
    return;
  }

  if (tool === 'trim') {
    // Apara a entidade no ponto onde o cursor está (rawMouse)
    pushUndoSnapshot();
    doTrim(entityId, rawMouse.x, rawMouse.y); // trim.js
    render();
    autoSave();
    return;
  }

  if (tool === 'select') {
    selected.clear();
    selected.add(entityId);
    render();
  }
}

/* ─────────────────────────────────────────────────────────────
   EVENTOS DO CANVAS SVG
   ───────────────────────────────────────────────────────────── */

/**
 * Vincula todos os event listeners do canvas e do documento.
 * Chamado uma vez em init().
 */
function bindCanvasEvents() {
  const svg = document.getElementById('sk');
  svg.addEventListener('mousemove', onCanvasMouseMove);
  svg.addEventListener('mousedown', onCanvasMouseDown);
  svg.addEventListener('click',     onCanvasClick);
  document.addEventListener('mouseup', onDocumentMouseUp);
}

/**
 * Processa o movimento do mouse no canvas.
 * Atualiza rawMouse, coordenadas na status bar, shape temporário e drag ativo.
 *
 * @param {MouseEvent} event
 */
function onCanvasMouseMove(event) {
  // Atualiza posição bruta (sem snap) — usada pelo trim para localizar o segmento
  rawMouse = getSvgCoords(event);

  // Atualiza as coordenadas com snap na status bar
  const snapped = getSnapPoint(rawMouse.x, rawMouse.y);
  document.getElementById('sb-xy').textContent =
    `X: ${snapped.x.toFixed(0)}  Y: ${snapped.y.toFixed(0)}`;

  // Atualiza o preview do shape em construção
  renderTempShape(); // render.js

  // Processa arraste de alça se houver um drag ativo
  if (dragState) {
    applyDrag(rawMouse.x, rawMouse.y); // render.js
    render();
  }
}

/**
 * Processa o mousedown no canvas (fora de entidades).
 * Limpa a seleção ao clicar no fundo vazio no modo select.
 *
 * @param {MouseEvent} event
 */
function onCanvasMouseDown(event) {
  if (event.button !== 0) return;

  const target = event.target;
  const isBackground = target === document.getElementById('sk') ||
                       target.id === 'gbg';

  if (isBackground && tool === 'select') {
    selected.clear();
    render();
  }
}

/**
 * Processa o click no canvas (fundo, não em entidades).
 * Avança o estado de construção das ferramentas de desenho.
 *
 * @param {MouseEvent} event
 */
function onCanvasClick(event) {
  // Ignora cliques que não foram diretamente no fundo do SVG
  const target = event.target;
  const isBackground = target === document.getElementById('sk') ||
                       target.id === 'gbg';
  if (!isBackground) return;

  // Ponto com snap para construção
  const snapped = snapToGrid(rawMouse.x, rawMouse.y);
  const { x, y } = snapped;

  if (tool === 'line')   handleLineClick(x, y);
  if (tool === 'circle') handleCircleClick(x, y);
  if (tool === 'arc')    handleArcClick(x, y);
}

/**
 * Libera o estado de drag quando o botão do mouse é solto.
 * @param {MouseEvent} event
 */
function onDocumentMouseUp(event) {
  if (dragState) {
    dragState = null;
    autoSave(); // Salva após cada arraste
  }
}

/* ─────────────────────────────────────────────────────────────
   MÁQUINAS DE ESTADO DAS FERRAMENTAS DE DESENHO
   ───────────────────────────────────────────────────────────── */

/**
 * Processa um clique no canvas para a ferramenta Linha.
 * Funciona em cadeia: o ponto final de uma linha vira o inicial da próxima.
 *
 * @param {number} x
 * @param {number} y
 */
function handleLineClick(x, y) {
  if (!buildState) {
    // 1º clique: define o ponto inicial e aguarda o segundo
    buildState = { step: 1, x1: x, y1: y };
    document.getElementById('sb-hint').textContent = '2º clique: ponto final (Esc para parar)';
  } else {
    // 2º clique: cria a linha e encadeia (o fim vira novo início)
    if (distanceBetween({ x, y }, { x: buildState.x1, y: buildState.y1 }) > 4) {
      pushUndoSnapshot();
      entities.push({
        id: ++eid, type: 'line',
        x1: buildState.x1, y1: buildState.y1,
        x2: x, y2: y,
        dim: null
      });
      autoSave();
      render();
    }
    // Encadeia a próxima linha a partir deste ponto
    buildState = { step: 1, x1: x, y1: y };
    document.getElementById('sb-hint').textContent = '2º clique: ponto final (Esc para parar)';
  }
}

/**
 * Processa um clique no canvas para a ferramenta Círculo.
 * 1º clique: centro; 2º clique: ponto no raio.
 *
 * @param {number} x
 * @param {number} y
 */
function handleCircleClick(x, y) {
  if (!buildState) {
    buildState = { step: 1, cx: x, cy: y };
    document.getElementById('sb-hint').textContent = '2º clique: ponto na circunferência (define o raio)';
  } else {
    const r = distanceBetween({ x: buildState.cx, y: buildState.cy }, { x, y });
    if (r > 4) {
      pushUndoSnapshot();
      entities.push({ id: ++eid, type: 'circle', cx: buildState.cx, cy: buildState.cy, r, dim: null });
      autoSave();
    }
    buildState = null;
    document.getElementById('sb-hint').textContent = TOOL_HINTS.circle;
    render();
  }
}

/**
 * Processa um clique no canvas para a ferramenta Arco.
 * 1º clique: centro; 2º: ponto inicial (define raio + ângulo inicial);
 * 3º: ponto final (define ângulo final).
 *
 * @param {number} x
 * @param {number} y
 */
function handleArcClick(x, y) {
  if (!buildState) {
    // 1º: define o centro
    buildState = { step: 1, cx: x, cy: y };
    document.getElementById('sb-hint').textContent = '2º clique: ponto de início (define o raio)';

  } else if (buildState.step === 1) {
    // 2º: define raio e ângulo inicial
    const r = distanceBetween({ x: buildState.cx, y: buildState.cy }, { x, y });
    if (r > 4) {
      buildState = {
        step: 2,
        cx: buildState.cx, cy: buildState.cy,
        r,
        sa: Math.atan2(y - buildState.cy, x - buildState.cx)
      };
      document.getElementById('sb-hint').textContent = '3º clique: ponto final do arco';
    }

  } else if (buildState.step === 2) {
    // 3º: define ângulo final e cria o arco
    const { cx, cy, r, sa } = buildState;
    const ea = Math.atan2(y - cy, x - cx);

    if (Math.abs(ea - sa) > 0.05) { // Arco com amplitude mínima
      pushUndoSnapshot();
      entities.push({ id: ++eid, type: 'arc', cx, cy, r, sa, ea, dim: null });
      autoSave();
    }
    buildState = null;
    document.getElementById('sb-hint').textContent = TOOL_HINTS.arc;
    render();
  }
}

/* ─────────────────────────────────────────────────────────────
   AÇÕES GLOBAIS
   ───────────────────────────────────────────────────────────── */

/**
 * Salva um snapshot do estado atual na pilha de undo.
 * Chamado antes de qualquer operação destrutiva.
 * Limita a pilha a 60 entradas para evitar uso excessivo de memória.
 */
function pushUndoSnapshot() {
  undoHistory.push(JSON.parse(JSON.stringify(entities)));
  if (undoHistory.length > 60) undoHistory.shift();
}

/**
 * Desfaz a última ação: restaura o snapshot mais recente da pilha.
 */
function undo() {
  if (undoHistory.length === 0) return;

  entities = undoHistory.pop();
  selected.clear();

  // Recalcula eid para continuar a sequência corretamente
  eid = entities.length > 0 ? Math.max(...entities.map(e => e.id)) : 0;

  render();
  autoSave();
}

/**
 * Limpa todo o esboço após confirmação do usuário.
 */
function clearAll() {
  if (!confirm('Limpar todo o esboço? Esta ação não pode ser desfeita após sair do app.')) return;

  pushUndoSnapshot();
  entities   = [];
  selected.clear();
  eid        = 0;
  buildState = null;

  document.getElementById('gt').innerHTML = '';
  render();
  autoSave();
}

/**
 * Alterna a visibilidade da grade de fundo.
 */
function toggleGrid() {
  showGrid = !showGrid;
  document.getElementById('gbg').style.display   = showGrid ? '' : 'none';
  document.getElementById('tb-grid').classList.toggle('on', showGrid);
}

/**
 * Ativa ou desativa o snap à grade.
 */
function toggleSnap() {
  snapEnabled = !snapEnabled;
  document.getElementById('tb-snap').classList.toggle('on', snapEnabled);
}

/* ─────────────────────────────────────────────────────────────
   ATALHOS DE TECLADO
   ───────────────────────────────────────────────────────────── */

/**
 * Vincula os atalhos de teclado globais.
 * Ignorados quando o foco está em um campo de texto (ex: overlay de cota).
 */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Não intercepta se o usuário estiver digitando num input
    if (event.target.tagName === 'INPUT') return;

    const key = event.key.toLowerCase();

    // Trocar ferramenta
    if (key === 's') setTool('select');
    if (key === 'l') setTool('line');
    if (key === 'c') setTool('circle');
    if (key === 'a') setTool('arc');
    if (key === 't') setTool('trim');
    if (key === 'd') setTool('delete');

    // Cancelar operação em curso
    if (key === 'escape') {
      buildState = null;
      document.getElementById('gt').innerHTML = '';
      setTool('select');
    }

    // Desfazer (Ctrl+Z ou Cmd+Z no Mac)
    if (key === 'z' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault(); // Evita o undo do browser
      undo();
    }

    // Deletar entidades selecionadas (Delete ou Backspace)
    if ((key === 'delete' || key === 'backspace') && selected.size > 0) {
      event.preventDefault();
      pushUndoSnapshot();
      for (const id of selected) {
        entities = entities.filter(e => e.id !== id);
      }
      selected.clear();
      render();
      autoSave();
    }
  });
}
