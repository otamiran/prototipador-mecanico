/**
 * panel.js
 * ========
 * Gerencia o painel de propriedades lateral.
 *
 * O painel é atualizado sempre que a seleção muda.
 * Exibe dados geométricos das entidades selecionadas e,
 * quando duas entidades estão selecionadas, mostra
 * a distância relativa entre seus centros.
 */

/* ─────────────────────────────────────────────────────────────
   ATUALIZAÇÃO PRINCIPAL DO PAINEL
   ───────────────────────────────────────────────────────────── */

/**
 * Reconstrói o conteúdo do painel a partir do estado atual da seleção.
 * Chamado por render() após qualquer mudança de estado.
 */
function updatePanel() {
  const body = document.getElementById('pnb');

  // Sem seleção: exibe o guia de atalhos
  if (selected.size === 0) {
    body.innerHTML = buildHelpHTML();
    return;
  }

  let html = '';

  // Seção de cada entidade selecionada
  for (const id of selected) {
    const entity = entities.find(e => e.id === id);
    if (!entity) continue;

    if (entity.type === 'line') {
      html += buildLineSection(entity);
    } else if (entity.type === 'circle') {
      html += buildCircleSection(entity);
    } else if (entity.type === 'arc') {
      html += buildArcSection(entity);
    }
  }

  // Seção de distância relativa (somente com exatamente 2 entidades selecionadas)
  if (selected.size === 2) {
    html += buildRelativeDistanceSection();
  }

  body.innerHTML = html || '<p style="color:#9ca3af;font-size:11px">—</p>';

  // Vincula os botões "Editar dimensão" gerados dinamicamente
  bindEditButtons();
}

/* ─────────────────────────────────────────────────────────────
   CONSTRUTORES DE SEÇÕES HTML
   ───────────────────────────────────────────────────────────── */

/**
 * Gera o HTML da seção de ajuda (exibida quando não há seleção).
 * @returns {string}
 */
function buildHelpHTML() {
  return `
    <p style="color:#9ca3af;font-size:11px;line-height:1.85">
      Selecione um elemento para editar.<br><br>
      <b style="color:#6b7280;font-weight:500">Atalhos de teclado:</b><br>
      <span class="kbd">S</span> Selecionar &nbsp;
      <span class="kbd">L</span> Linha<br>
      <span class="kbd">C</span> Círculo &nbsp;&nbsp;
      <span class="kbd">A</span> Arco<br>
      <span class="kbd">T</span> Aparar &nbsp;&nbsp;&nbsp;
      <span class="kbd">D</span> Deletar<br>
      <span class="kbd">Del</span> Deletar seleção<br>
      <span class="kbd">Esc</span> Cancelar operação<br>
      <span class="kbd">Ctrl+Z</span> Desfazer<br><br>
      <b style="color:#6b7280;font-weight:500">Cotas:</b>
      clique nos valores em vermelho/roxo para editar dimensões.
    </p>`;
}

/**
 * Gera o HTML da seção de propriedades de uma linha.
 * @param {object} entity
 * @returns {string}
 */
function buildLineSection(entity) {
  const d   = distanceBetween({ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 });
  const ang = Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1) * 180 / Math.PI;

  let html = sectionTitle(`Linha L${entity.id}`);
  html += propRow('Início',      `(${entity.x1.toFixed(0)}, ${entity.y1.toFixed(0)})`);
  html += propRow('Fim',         `(${entity.x2.toFixed(0)}, ${entity.y2.toFixed(0)})`);
  html += propRow('Comprimento', d.toFixed(2) + ' mm', entity.dim ? 'hi' : '');
  html += propRow('Ângulo',      ang.toFixed(1) + '°');
  html += propRow('ΔX',          Math.abs(entity.x2 - entity.x1).toFixed(1) + ' mm');
  html += propRow('ΔY',          Math.abs(entity.y2 - entity.y1).toFixed(1) + ' mm');
  if (entity.dim) html += propRow('Cota fixada', entity.dim.toFixed(2) + ' mm', 'hi');
  html += editButton(entity.id, 'line', 'Editar comprimento');
  return html;
}

/**
 * Gera o HTML da seção de propriedades de um círculo.
 * @param {object} entity
 * @returns {string}
 */
function buildCircleSection(entity) {
  const r = entity.dim || entity.r;

  let html = sectionTitle(`Círculo C${entity.id}`);
  html += propRow('Centro',    `(${entity.cx.toFixed(0)}, ${entity.cy.toFixed(0)})`);
  html += propRow('Raio',      r.toFixed(2) + ' mm', entity.dim ? 'hi' : '');
  html += propRow('Diâmetro',  (r * 2).toFixed(2) + ' mm');
  html += propRow('Área',      (Math.PI * r * r).toFixed(1) + ' mm²');
  html += propRow('Perímetro', (2 * Math.PI * r).toFixed(2) + ' mm');
  html += editButton(entity.id, 'circle', 'Editar diâmetro');
  return html;
}

/**
 * Gera o HTML da seção de propriedades de um arco.
 * @param {object} entity
 * @returns {string}
 */
function buildArcSection(entity) {
  const r    = entity.dim || entity.r;
  const span = arcSpan(entity) * 180 / Math.PI; // Amplitude em graus

  let html = sectionTitle(`Arco A${entity.id}`);
  html += propRow('Centro',        `(${entity.cx.toFixed(0)}, ${entity.cy.toFixed(0)})`);
  html += propRow('Raio',          r.toFixed(2) + ' mm', entity.dim ? 'hi' : '');
  html += propRow('Ângulo inicial', (entity.sa * 180 / Math.PI).toFixed(1) + '°');
  html += propRow('Ângulo final',   (entity.ea * 180 / Math.PI).toFixed(1) + '°');
  html += propRow('Amplitude',      span.toFixed(1) + '°');
  html += propRow('Comprimento arc.', (entity.r * arcSpan(entity)).toFixed(2) + ' mm');
  if (entity.dim) html += propRow('Raio fixado', entity.dim.toFixed(2) + ' mm', 'hi');
  html += editButton(entity.id, 'arc', 'Editar raio');
  return html;
}

/**
 * Gera o HTML da seção de distância relativa entre dois elementos selecionados.
 * @returns {string}
 */
function buildRelativeDistanceSection() {
  const ids = [...selected];
  const e1  = entities.find(e => e.id === ids[0]);
  const e2  = entities.find(e => e.id === ids[1]);
  if (!e1 || !e2) return '';

  const c1 = centerOfEntity(e1);
  const c2 = centerOfEntity(e2);
  const d  = distanceBetween(c1, c2);

  let html = sectionTitle('Distância Relativa');
  html += propRow('Dist. entre centros', d.toFixed(2) + ' mm');
  html += propRow('ΔX', Math.abs(c2.x - c1.x).toFixed(1) + ' mm');
  html += propRow('ΔY', Math.abs(c2.y - c1.y).toFixed(1) + ' mm');
  return html;
}

/* ─────────────────────────────────────────────────────────────
   COMPONENTES HTML REUTILIZÁVEIS
   ───────────────────────────────────────────────────────────── */

/**
 * Gera uma linha de separação com título de seção.
 * @param {string} title
 * @returns {string}
 */
function sectionTitle(title) {
  return `<div class="ph">${title}</div>`;
}

/**
 * Gera uma linha de propriedade chave–valor.
 * @param {string} key
 * @param {string} value
 * @param {string} [cls] - Classe CSS extra para o valor (ex: 'hi' para roxo)
 * @returns {string}
 */
function propRow(key, value, cls = '') {
  return `<div class="pr">
    <span class="pk">${key}</span>
    <span class="pv ${cls}">${value}</span>
  </div>`;
}

/**
 * Gera o botão "Editar dimensão" de uma entidade.
 * O atributo data-eb é lido por bindEditButtons() para vincular o evento.
 *
 * @param {number} id
 * @param {string} type - 'line' | 'circle' | 'arc'
 * @param {string} label
 * @returns {string}
 */
function editButton(id, type, label) {
  return `<button class="eb" data-eb="${id}:${type}">
    <i class="ti ti-edit" style="font-size:12px"></i> ${label}
  </button>`;
}

/* ─────────────────────────────────────────────────────────────
   BINDING DINÂMICO DOS BOTÕES
   ───────────────────────────────────────────────────────────── */

/**
 * Vincula os eventos de clique nos botões "Editar dimensão" após o painel ser reconstruído.
 * Os botões são gerados via innerHTML, então os listeners precisam ser re-aplicados.
 */
function bindEditButtons() {
  document.querySelectorAll('[data-eb]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [idStr, type] = btn.dataset.eb.split(':');
      const entity = entities.find(e => e.id === +idStr);
      if (!entity) return;

      // Posiciona o overlay próximo à entidade
      let svgX, svgY;
      if (entity.type === 'line') {
        svgX = (entity.x1 + entity.x2) / 2;
        svgY = (entity.y1 + entity.y2) / 2 - 20;
      } else {
        svgX = entity.cx;
        svgY = entity.cy - entity.r - 18;
      }
      openDimEdit(entity.id, svgX, svgY, type);
    });
  });
}
