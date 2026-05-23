/**
 * dimension.js
 * ============
 * Gerencia o overlay de edição de cotas dimensionais.
 *
 * O overlay é um pequeno painel flutuante que aparece sobre o canvas
 * quando o usuário clica em um label de cota. Permite digitar um
 * valor numérico que é aplicado à geometria da entidade:
 *
 *   - Linha:   reposiciona o ponto final para que o comprimento bata
 *   - Círculo: ajusta o raio (entrada em diâmetro)
 *   - Arco:    ajusta o raio (mantém ângulos)
 *
 * Quando uma cota é fixada, o campo `dim` da entidade recebe o valor
 * e os labels são exibidos em roxo para indicar que está restrito.
 */

/* ─────────────────────────────────────────────────────────────
   ABERTURA DO OVERLAY
   ───────────────────────────────────────────────────────────── */

/**
 * Abre o overlay de edição de cota posicionado próximo ao label clicado.
 *
 * @param {number} entityId - ID da entidade
 * @param {number} svgX     - Posição X do label no SVG (px)
 * @param {number} svgY     - Posição Y do label no SVG (px)
 * @param {string} dimType  - 'line' | 'circle' | 'arc'
 */
function openDimEdit(entityId, svgX, svgY, dimType) {
  closeDimEdit(); // Fecha qualquer overlay aberto anteriormente

  const entity = entities.find(e => e.id === entityId);
  if (!entity) return;

  // Define o label e o valor inicial conforme o tipo
  let label, value;
  if (dimType === 'line') {
    const d = distanceBetween({ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 });
    label = `Linha L${entity.id} — comprimento (mm)`;
    value = entity.dim || d;
  } else if (dimType === 'circle') {
    label = `Círculo C${entity.id} — diâmetro (mm)`;
    value = (entity.dim || entity.r) * 2; // Exibe em diâmetro
  } else if (dimType === 'arc') {
    label = `Arco A${entity.id} — raio (mm)`;
    value = entity.dim || entity.r;
  }

  // Calcula a posição do overlay relativa ao wrapper do canvas
  const svgRect  = document.getElementById('sk').getBoundingClientRect();
  const wrapRect = document.getElementById('cv').getBoundingClientRect();
  const left = Math.max(4, svgRect.left - wrapRect.left + svgX - 57);
  const top  = Math.max(4, svgRect.top  - wrapRect.top  + svgY - 34);

  // Atualiza e exibe o overlay
  const overlay = document.getElementById('dov');
  document.getElementById('dl').textContent = label;
  document.getElementById('di').value       = value.toFixed(2);
  overlay.style.left    = left + 'px';
  overlay.style.top     = top  + 'px';
  overlay.style.display = 'block';

  // Guarda qual entidade está sendo editada (usada por applyDimEdit)
  editingDimId   = entityId;
  editingDimType = dimType;

  document.getElementById('di').select();
  document.getElementById('di').focus();
}

/* ─────────────────────────────────────────────────────────────
   FECHAMENTO DO OVERLAY
   ───────────────────────────────────────────────────────────── */

/**
 * Fecha o overlay de edição sem aplicar nenhuma alteração.
 */
function closeDimEdit() {
  document.getElementById('dov').style.display = 'none';
  editingDimId   = null;
  editingDimType = null;
}

/* ─────────────────────────────────────────────────────────────
   APLICAÇÃO DA COTA
   ───────────────────────────────────────────────────────────── */

/**
 * Lê o valor do input, valida e aplica à geometria da entidade.
 * Salva o histórico de undo antes de modificar.
 */
function applyDimEdit() {
  if (!editingDimId) return;

  const rawValue = parseFloat(document.getElementById('di').value);

  // Valida: deve ser um número positivo
  if (isNaN(rawValue) || rawValue <= 0) {
    closeDimEdit();
    return;
  }

  pushUndoSnapshot();

  const entity = entities.find(e => e.id === editingDimId);
  if (!entity) { closeDimEdit(); return; }

  if (editingDimType === 'line') {
    const currentDist = distanceBetween(
      { x: entity.x1, y: entity.y1 },
      { x: entity.x2, y: entity.y2 }
    );
    if (currentDist > EPSILON) {
      // Move o ponto final ao longo da direção atual para bater com o novo comprimento
      const ratio = rawValue / currentDist;
      entity.x2 = entity.x1 + (entity.x2 - entity.x1) * ratio;
      entity.y2 = entity.y1 + (entity.y2 - entity.y1) * ratio;
    }
    entity.dim = rawValue;

  } else if (editingDimType === 'circle') {
    entity.r   = rawValue / 2; // Input em diâmetro → raio
    entity.dim = rawValue / 2;

  } else if (editingDimType === 'arc') {
    entity.r   = rawValue;
    entity.dim = rawValue;
  }

  closeDimEdit();
  render();
  autoSave();
}

/* ─────────────────────────────────────────────────────────────
   INICIALIZAÇÃO DOS EVENT LISTENERS DO OVERLAY
   ───────────────────────────────────────────────────────────── */

/**
 * Vincula os eventos do input e do canvas ao overlay.
 * Chamado uma vez na inicialização do app.
 */
function initDimOverlay() {
  const input = document.getElementById('di');

  // Enter confirma, Escape cancela
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter')  applyDimEdit();
    if (ev.key === 'Escape') closeDimEdit();
  });

  // Fechar ao perder o foco (com pequeno delay para não fechar ao clicar no input)
  input.addEventListener('blur', () => {
    setTimeout(() => { if (editingDimId) closeDimEdit(); }, 200);
  });

  // Clicar no SVG fecha o overlay (o usuário decidiu não editar)
  document.getElementById('sk').addEventListener('click', () => {
    if (editingDimId) closeDimEdit();
  });
}
