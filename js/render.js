/**
 * render.js
 * =========
 * Responsável por toda a renderização visual no SVG.
 *
 * Cada função de renderização limpa seu grupo SVG e o reconstrói
 * do zero a partir do estado atual. Essa abordagem "stateless"
 * é simples e garante que o DOM sempre reflita o estado.
 *
 * GRUPOS SVG (definidos no index.html)
 * ─────────────────────────────────────
 *   #ge  — entidades (linhas, círculos, arcos)
 *   #gd  — cotas dimensionais
 *   #gh  — alças de controle da seleção
 *   #gt  — shape temporário em construção
 */

/* ─────────────────────────────────────────────────────────────
   FÁBRICA DE ELEMENTOS SVG
   ───────────────────────────────────────────────────────────── */

/**
 * Cria um elemento SVG com os atributos fornecidos.
 * Evita repetição de createElementNS em todo o código.
 *
 * @param {string} tag    - Nome do elemento (ex: 'line', 'circle')
 * @param {object} attrs  - Pares chave/valor para setAttribute
 * @returns {SVGElement}
 */
function makeSvgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
  }
  return el;
}

/* ─────────────────────────────────────────────────────────────
   RENDER PRINCIPAL
   ───────────────────────────────────────────────────────────── */

/**
 * Ponto de entrada: re-renderiza todos os grupos do SVG.
 * Chamado sempre que o estado muda (adição, deleção, seleção, etc.).
 */
function render() {
  renderEntities();
  renderHandles();
  renderDimensions();
  updatePanel();
  updateStatusBar();
}

/* ─────────────────────────────────────────────────────────────
   RENDERIZAÇÃO DE ENTIDADES
   ───────────────────────────────────────────────────────────── */

/**
 * Reconstrói o grupo #ge com todas as entidades do array `entities`.
 * Para cada entidade, cria dois elementos:
 *   1. O elemento visual (linha/círculo/caminho)
 *   2. Uma área de hit invisível e mais larga (facilita o clique)
 */
function renderEntities() {
  const group = document.getElementById('ge');
  group.innerHTML = '';

  for (const entity of entities) {
    const isSelected = selected.has(entity.id);
    const isHovered  = hoveredId === entity.id;
    const isTrimHov  = tool === 'trim' && isHovered;

    // Cor: vermelho se hover em modo trim, azul se selecionado, escuro padrão
    const stroke      = isTrimHov ? '#dc2626' : isSelected ? '#2563eb' : '#1e293b';
    const strokeWidth = isSelected || isHovered ? 2.5 : 2;

    // Cria o elemento visual principal
    const visual = makeEntityVisual(entity, stroke, strokeWidth);
    if (!visual) continue;

    // Cria a área de hit (invisível, mais larga para facilitar o clique)
    const hit = makeHitArea(entity);
    hit.style.cursor = (tool === 'delete' || tool === 'trim') ? 'crosshair' : 'pointer';

    // Eventos de interação da área de hit
    hit.addEventListener('mouseenter', () => { hoveredId = entity.id; renderEntities(); });
    hit.addEventListener('mouseleave', () => { hoveredId = null; renderEntities(); });
    hit.addEventListener('mousedown',  (ev) => { ev.stopPropagation(); onEntityMouseDown(entity.id, ev); });
    hit.addEventListener('click',      (ev) => { ev.stopPropagation(); onEntityClick(entity.id); });

    group.appendChild(visual);
    group.appendChild(hit);
  }
}

/**
 * Cria o elemento SVG visual de uma entidade.
 * @param {object} entity
 * @param {string} stroke
 * @param {number} strokeWidth
 * @returns {SVGElement|null}
 */
function makeEntityVisual(entity, stroke, strokeWidth) {
  if (entity.type === 'line') {
    return makeSvgEl('line', {
      x1: entity.x1, y1: entity.y1,
      x2: entity.x2, y2: entity.y2,
      stroke, 'stroke-width': strokeWidth, 'stroke-linecap': 'round'
    });
  }
  if (entity.type === 'circle') {
    return makeSvgEl('circle', {
      cx: entity.cx, cy: entity.cy, r: entity.r,
      fill: 'none', stroke, 'stroke-width': strokeWidth
    });
  }
  if (entity.type === 'arc') {
    return makeSvgEl('path', {
      d: arcToPath(entity),
      fill: 'none', stroke, 'stroke-width': strokeWidth, 'stroke-linecap': 'round'
    });
  }
  return null;
}

/**
 * Cria a área de hit transparente com largura maior (14px) para facilitar o clique.
 * @param {object} entity
 * @returns {SVGElement}
 */
function makeHitArea(entity) {
  const hitAttrs = { stroke: 'transparent', 'stroke-width': 14 };

  if (entity.type === 'line') {
    return makeSvgEl('line', {
      x1: entity.x1, y1: entity.y1, x2: entity.x2, y2: entity.y2, ...hitAttrs
    });
  }
  if (entity.type === 'circle') {
    return makeSvgEl('circle', {
      cx: entity.cx, cy: entity.cy, r: entity.r, fill: 'none', ...hitAttrs
    });
  }
  // Arco
  return makeSvgEl('path', { d: arcToPath(entity), fill: 'none', ...hitAttrs });
}

/* ─────────────────────────────────────────────────────────────
   ALÇAS DE CONTROLE (HANDLES)
   ───────────────────────────────────────────────────────────── */

/**
 * Reconstrói o grupo #gh com as alças azuis das entidades selecionadas.
 * Cada alça permite arrastar para editar a geometria da entidade.
 */
function renderHandles() {
  const group = document.getElementById('gh');
  group.innerHTML = '';

  for (const id of selected) {
    const entity = entities.find(e => e.id === id);
    if (!entity) continue;

    for (const handle of getHandlePositions(entity)) {
      // Área de hit da alça (invisível, maior que o visual)
      const hitCircle = makeSvgEl('circle', {
        cx: handle.x, cy: handle.y, r: 7, fill: 'transparent', 'stroke-width': 0
      });
      hitCircle.style.cursor = 'grab';
      hitCircle.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        pushUndoSnapshot(); // Salva estado antes de arrastar
        dragState = {
          eid:  id,
          key:  handle.key,
          orig: JSON.parse(JSON.stringify(entity)) // Snapshot profundo
        };
      });

      // Visual da alça (círculo azul com borda branca)
      const visual = makeSvgEl('circle', {
        cx: handle.x, cy: handle.y, r: 5,
        fill: '#2563eb', stroke: '#fff', 'stroke-width': 1.5
      });
      visual.style.pointerEvents = 'none'; // Eventos apenas na área de hit

      group.appendChild(hitCircle);
      group.appendChild(visual);
    }
  }
}

/**
 * Retorna as posições e chaves das alças para uma entidade.
 * A chave identifica qual aspecto da geometria aquela alça controla.
 *
 * @param {object} entity
 * @returns {Array<{x:number, y:number, key:string}>}
 */
function getHandlePositions(entity) {
  if (entity.type === 'line') {
    return [
      { x: entity.x1, y: entity.y1, key: 'p1' },                               // Ponto inicial
      { x: entity.x2, y: entity.y2, key: 'p2' },                               // Ponto final
      { x: (entity.x1 + entity.x2) / 2, y: (entity.y1 + entity.y2) / 2, key: 'mid' } // Ponto médio (mover tudo)
    ];
  }
  if (entity.type === 'circle') {
    return [
      { x: entity.cx,           y: entity.cy,           key: 'center' }, // Centro (mover)
      { x: entity.cx + entity.r, y: entity.cy,          key: 're' },     // Quadrante leste (raio)
      { x: entity.cx,           y: entity.cy - entity.r, key: 'rn' }    // Quadrante norte (raio)
    ];
  }
  if (entity.type === 'arc') {
    return [
      { x: entity.cx, y: entity.cy, key: 'center' }, // Centro (mover)
      { x: entity.cx + entity.r * Math.cos(entity.sa), y: entity.cy + entity.r * Math.sin(entity.sa), key: 'sa' }, // Ponto inicial (ângulo)
      { x: entity.cx + entity.r * Math.cos(entity.ea), y: entity.cy + entity.r * Math.sin(entity.ea), key: 'ea' }  // Ponto final (ângulo)
    ];
  }
  return [];
}

/**
 * Aplica o deslocamento do arraste sobre a entidade, conforme a alça arrastada.
 * Chamado a cada evento mousemove enquanto dragState estiver ativo.
 *
 * @param {number} rawX - Posição bruta atual do mouse
 * @param {number} rawY
 */
function applyDrag(rawX, rawY) {
  const snapped = snapToGrid(rawX, rawY);
  const entity  = entities.find(e => e.id === dragState.eid);
  const orig    = dragState.orig; // Snapshot da geometria antes do drag
  if (!entity) return;

  if (entity.type === 'line') {
    if (dragState.key === 'p1') {
      // Move ponto inicial
      entity.x1 = snapped.x; entity.y1 = snapped.y;
    } else if (dragState.key === 'p2') {
      // Move ponto final
      entity.x2 = snapped.x; entity.y2 = snapped.y;
    } else if (dragState.key === 'mid') {
      // Translada a linha inteira: calcula deslocamento em relação ao meio original
      const origMidX = (orig.x1 + orig.x2) / 2;
      const origMidY = (orig.y1 + orig.y2) / 2;
      entity.x1 = orig.x1 + (snapped.x - origMidX);
      entity.y1 = orig.y1 + (snapped.y - origMidY);
      entity.x2 = orig.x2 + (snapped.x - origMidX);
      entity.y2 = orig.y2 + (snapped.y - origMidY);
    }
  }

  if (entity.type === 'circle') {
    if (dragState.key === 'center') {
      // Translada o círculo
      entity.cx = snapped.x; entity.cy = snapped.y;
    } else {
      // Redimensiona: novo raio = distância entre o cursor e o centro
      entity.r = Math.max(5, distanceBetween(snapped, { x: entity.cx, y: entity.cy }));
    }
  }

  if (entity.type === 'arc') {
    if (dragState.key === 'center') {
      // Translada o arco
      entity.cx = snapped.x; entity.cy = snapped.y;
    } else if (dragState.key === 'sa') {
      // Redimensiona raio e ajusta ângulo inicial
      entity.r  = Math.max(5, distanceBetween(snapped, { x: entity.cx, y: entity.cy }));
      entity.sa = Math.atan2(snapped.y - entity.cy, snapped.x - entity.cx);
    } else if (dragState.key === 'ea') {
      // Ajusta apenas o ângulo final
      entity.ea = Math.atan2(snapped.y - entity.cy, snapped.x - entity.cx);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   COTAS DIMENSIONAIS
   ───────────────────────────────────────────────────────────── */

/**
 * Reconstrói o grupo #gd com as anotações dimensionais de todas as entidades.
 */
function renderDimensions() {
  const group = document.getElementById('gd');
  group.innerHTML = '';
  for (const entity of entities) {
    renderDimForEntity(entity, group);
  }
}

/**
 * Adiciona a cota dimensional de uma entidade ao grupo fornecido.
 * Cotas não fixadas são vermelhas; fixadas (dim !== null) são roxas.
 *
 * @param {object} entity
 * @param {SVGGElement} parentGroup
 */
function renderDimForEntity(entity, parentGroup) {
  const isConstrained = entity.dim !== null;
  const color = isConstrained ? '#9333ea' : '#dc2626';

  // Utilitário local: cria o retângulo de fundo + texto da cota
  const addLabel = (g, text, sx, sy) => {
    const textWidth = text.length * 5.5 + 10;
    g.appendChild(makeSvgEl('rect', {
      x: sx - textWidth / 2, y: sy - 7.5, width: textWidth, height: 14, rx: 3,
      fill: '#fff', stroke: color, 'stroke-width': 0.9
    }));
    const t = makeSvgEl('text', {
      x: sx, y: sy + 3.5, 'text-anchor': 'middle',
      'font-size': 9.5, 'font-family': 'monospace', fill: color, 'font-weight': 600
    });
    t.textContent = text;
    g.appendChild(t);
  };

  if (entity.type === 'line') {
    const d   = distanceBetween({ x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 });
    if (d < 6) return; // Linha muito curta, omite a cota

    const angle = Math.atan2(entity.y2 - entity.y1, entity.x2 - entity.x1);
    const off   = 18; // Distância perpendicular da cota à linha
    const px    = -Math.sin(angle) * off; // Vetor perpendicular X
    const py    =  Math.cos(angle) * off; // Vetor perpendicular Y
    const mx    = (entity.x1 + entity.x2) / 2;
    const my    = (entity.y1 + entity.y2) / 2;
    const label = (entity.dim || d).toFixed(1) + ' mm';

    const g = makeSvgEl('g', {});
    g.style.cursor = 'pointer';
    g.title = 'Clique para editar dimensão';

    // Linha de cota paralela à entidade (deslocada perpendicularmente)
    g.appendChild(makeSvgEl('line', {
      x1: entity.x1 + px * 0.8, y1: entity.y1 + py * 0.8,
      x2: entity.x2 + px * 0.8, y2: entity.y2 + py * 0.8,
      stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '4,2.5'
    }));
    // Linhas de extensão (perpendiculares nas extremidades)
    g.appendChild(makeSvgEl('line', { x1: entity.x1, y1: entity.y1, x2: entity.x1 + px * 0.85, y2: entity.y1 + py * 0.85, stroke: color, 'stroke-width': 0.8 }));
    g.appendChild(makeSvgEl('line', { x1: entity.x2, y1: entity.y2, x2: entity.x2 + px * 0.85, y2: entity.y2 + py * 0.85, stroke: color, 'stroke-width': 0.8 }));
    addLabel(g, label, mx + px, my + py);

    g.addEventListener('click', (ev) => { ev.stopPropagation(); openDimEdit(entity.id, mx + px, my + py, 'line'); });
    parentGroup.appendChild(g);
  }

  if (entity.type === 'circle') {
    const r     = entity.dim || entity.r;
    const label = 'Ø ' + (r * 2).toFixed(1) + ' mm';
    const sx    = entity.cx;
    const sy    = entity.cy - entity.r - 13;

    const g = makeSvgEl('g', {});
    g.style.cursor = 'pointer';
    // Linha de extensão do centro ao label
    g.appendChild(makeSvgEl('line', {
      x1: entity.cx, y1: entity.cy - entity.r, x2: entity.cx, y2: sy + 6,
      stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2'
    }));
    addLabel(g, label, sx, sy);

    g.addEventListener('click', (ev) => { ev.stopPropagation(); openDimEdit(entity.id, sx, sy, 'circle'); });
    parentGroup.appendChild(g);
  }

  if (entity.type === 'arc') {
    // Posiciona o label no ponto médio do arco, afastado para fora
    const midAngle = normalizeAngle(entity.sa) + arcSpan(entity) / 2;
    const arcMidX  = entity.cx + entity.r * Math.cos(midAngle);
    const arcMidY  = entity.cy + entity.r * Math.sin(midAngle);
    const offsetX  = Math.cos(midAngle) * 22;
    const offsetY  = Math.sin(midAngle) * 22;
    const sx       = arcMidX + offsetX;
    const sy       = arcMidY + offsetY;
    const label    = 'R ' + (entity.dim || entity.r).toFixed(1) + ' mm';

    const g = makeSvgEl('g', {});
    g.style.cursor = 'pointer';
    g.appendChild(makeSvgEl('line', {
      x1: arcMidX, y1: arcMidY, x2: sx, y2: sy,
      stroke: color, 'stroke-width': 0.8, 'stroke-dasharray': '3,2'
    }));
    addLabel(g, label, sx, sy);

    g.addEventListener('click', (ev) => { ev.stopPropagation(); openDimEdit(entity.id, sx, sy, 'arc'); });
    parentGroup.appendChild(g);
  }
}

/* ─────────────────────────────────────────────────────────────
   SHAPE TEMPORÁRIO (PREVIEW DE CONSTRUÇÃO)
   ───────────────────────────────────────────────────────────── */

/**
 * Renderiza o grupo #gt com a visualização em progresso da ferramenta ativa.
 * Chamado em cada mousemove enquanto uma ferramenta de desenho está em uso.
 * Dá feedback visual ao usuário sobre o que será criado.
 */
function renderTempShape() {
  const group = document.getElementById('gt');
  group.innerHTML = '';
  if (!buildState) return;

  const snapped = snapToGrid(rawMouse.x, rawMouse.y);

  if (tool === 'line' && buildState.step === 1) {
    // Linha tracejada do ponto inicial até o cursor
    group.appendChild(makeSvgEl('line', {
      x1: buildState.x1, y1: buildState.y1,
      x2: snapped.x, y2: snapped.y,
      stroke: '#f59e0b', 'stroke-width': 1.5, 'stroke-dasharray': '5,3'
    }));
    // Texto com a distância atual
    const d = distanceBetween({ x: buildState.x1, y: buildState.y1 }, snapped);
    if (d > 4) {
      const tx = makeSvgEl('text', {
        x: (buildState.x1 + snapped.x) / 2 + 7,
        y: (buildState.y1 + snapped.y) / 2 - 5,
        'font-size': 10, 'font-family': 'monospace', fill: '#d97706'
      });
      tx.textContent = d.toFixed(1) + ' mm';
      group.appendChild(tx);
    }
  }

  if (tool === 'circle' && buildState.step === 1) {
    // Círculo tracejado preview
    const r = distanceBetween({ x: buildState.cx, y: buildState.cy }, snapped);
    if (r > 4) {
      group.appendChild(makeSvgEl('circle', {
        cx: buildState.cx, cy: buildState.cy, r,
        fill: 'none', stroke: '#f59e0b', 'stroke-width': 1.5, 'stroke-dasharray': '5,3'
      }));
      group.appendChild(makeSvgEl('circle', { cx: buildState.cx, cy: buildState.cy, r: 3, fill: '#f59e0b' }));
    }
  }

  if (tool === 'arc') {
    if (buildState.step === 1) {
      // Círculo fantasma mostrando o raio que será criado
      const r = distanceBetween({ x: buildState.cx, y: buildState.cy }, snapped);
      if (r > 4) {
        group.appendChild(makeSvgEl('circle', {
          cx: buildState.cx, cy: buildState.cy, r,
          fill: 'none', stroke: '#f59e0b', 'stroke-width': 0.8, 'stroke-dasharray': '3,2', opacity: 0.45
        }));
        group.appendChild(makeSvgEl('line', {
          x1: buildState.cx, y1: buildState.cy, x2: snapped.x, y2: snapped.y,
          stroke: '#f59e0b', 'stroke-width': 1, 'stroke-dasharray': '3,2'
        }));
        group.appendChild(makeSvgEl('circle', { cx: buildState.cx, cy: buildState.cy, r: 3, fill: '#f59e0b' }));
      }
    }
    if (buildState.step === 2) {
      // Arco preview com círculo de referência
      const { cx, cy, r, sa } = buildState;
      const ea   = Math.atan2(snapped.y - cy, snapped.x - cx);
      const span = (ea - sa + PI2) % PI2;
      const la   = span > Math.PI ? 1 : 0;
      const x1   = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
      const x2   = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);

      // Círculo de referência semitransparente
      group.appendChild(makeSvgEl('circle', {
        cx, cy, r, fill: 'none',
        stroke: '#f59e0b', 'stroke-width': 0.8, 'stroke-dasharray': '2,3', opacity: 0.35
      }));
      // Arco sólido em construção
      if (span > 0.05) {
        group.appendChild(makeSvgEl('path', {
          d: `M${x1},${y1}A${r},${r} 0 ${la},1 ${x2},${y2}`,
          fill: 'none', stroke: '#f59e0b', 'stroke-width': 2, 'stroke-linecap': 'round'
        }));
      }
      // Label de raio
      const tx = makeSvgEl('text', {
        x: (x1 + x2) / 2 + 10, y: (y1 + y2) / 2 - 8,
        'font-size': 10, 'font-family': 'monospace', fill: '#d97706'
      });
      tx.textContent = 'R ' + r.toFixed(1) + ' mm';
      group.appendChild(tx);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   STATUS BAR
   ───────────────────────────────────────────────────────────── */

/**
 * Atualiza o contador de entidades na barra de status.
 */
function updateStatusBar() {
  const count = entities.length;
  document.getElementById('sb-cnt').textContent =
    `${count} entidade${count !== 1 ? 's' : ''}`;
}
