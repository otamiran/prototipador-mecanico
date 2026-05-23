/**
 * trim.js
 * =======
 * Algoritmo de aparar (trim) entidades nos pontos de intersecção.
 *
 * COMO FUNCIONA
 * ─────────────
 * 1. Calcula todas as intersecções da entidade clicada com as outras entidades.
 * 2. Parameteriza a entidade (t para linhas, ângulo para círculos/arcos).
 * 3. Identifica qual segmento contém o ponto clicado.
 * 4. Remove esse segmento e mantém os outros como novas entidades.
 *
 * Se não houver intersecções, a entidade inteira é removida.
 */

/**
 * Ponto de entrada do trim.
 * Coleta intersecções e despacha para a função específica do tipo.
 *
 * @param {number} entityId - ID da entidade a aparar
 * @param {number} mx       - Posição X do clique (para identificar o segmento)
 * @param {number} my       - Posição Y do clique
 */
function doTrim(entityId, mx, my) {
  const entity = entities.find(e => e.id === entityId);
  if (!entity) return;

  // Encontra todos os pontos de intersecção com as outras entidades
  const others = entities.filter(e => e.id !== entityId);
  const intersectionPoints = [];
  for (const other of others) {
    intersectionPoints.push(...getIntersections(entity, other));
  }

  // Despacha para o algoritmo correto conforme o tipo
  if (entity.type === 'line')   trimLine(entity, intersectionPoints, mx, my);
  if (entity.type === 'circle') trimCircle(entity, intersectionPoints, mx, my);
  if (entity.type === 'arc')    trimArc(entity, intersectionPoints, mx, my);
}

/* ─────────────────────────────────────────────────────────────
   TRIM DE LINHA
   ───────────────────────────────────────────────────────────── */

/**
 * Apara uma linha: remove o sub-segmento mais próximo do clique.
 *
 * Parametriza a linha como t ∈ [0,1], projeta os pontos de intersecção
 * para obter seus valores de t, e divide a linha nessas fronteiras.
 *
 * @param {object} entity
 * @param {Array<{x,y}>} intersections
 * @param {number} mx
 * @param {number} my
 */
function trimLine(entity, intersections, mx, my) {
  const dx   = entity.x2 - entity.x1;
  const dy   = entity.y2 - entity.y1;
  const len2 = dx * dx + dy * dy;

  if (len2 < EPSILON) {
    // Linha degenerada — remove direto
    entities = entities.filter(e => e.id !== entity.id);
    return;
  }

  // Calcula o parâmetro t do ponto clicado sobre a linha
  const clickT = Math.max(0, Math.min(1, ((mx - entity.x1) * dx + (my - entity.y1) * dy) / len2));

  // Converte cada ponto de intersecção para seu parâmetro t
  const params = intersections
    .map(p => Math.max(0, Math.min(1, ((p.x - entity.x1) * dx + (p.y - entity.y1) * dy) / len2)))
    .filter(t => t > EPSILON && t < 1 - EPSILON); // Ignora intersecções nas extremidades

  if (params.length === 0) {
    // Sem intersecções intermediárias — remove a linha toda
    entities = entities.filter(e => e.id !== entity.id);
    return;
  }

  params.sort((a, b) => a - b);

  // Monta o array de fronteiras: [0, t1, t2, ..., 1]
  const boundaries = [0, ...params, 1];

  // Localiza o índice do segmento que contém o clique
  let removedIndex = boundaries.length - 2; // Default: último segmento
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (clickT >= boundaries[i] && clickT <= boundaries[i + 1] + EPSILON) {
      removedIndex = i;
      break;
    }
  }

  // Remove a entidade original
  entities = entities.filter(e => e.id !== entity.id);

  // Adiciona os segmentos restantes como novas linhas
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (i === removedIndex) continue; // Pula o segmento removido

    const t1 = boundaries[i], t2 = boundaries[i + 1];
    if (t2 - t1 < EPSILON) continue; // Segmento degenerado

    const p1 = { x: entity.x1 + t1 * dx, y: entity.y1 + t1 * dy };
    const p2 = { x: entity.x1 + t2 * dx, y: entity.y1 + t2 * dy };

    if (distanceBetween(p1, p2) > 2) {
      entities.push({ id: ++eid, type: 'line', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, dim: null });
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   TRIM DE CÍRCULO
   ───────────────────────────────────────────────────────────── */

/**
 * Apara um círculo: converte-o em arcos, removendo o arco clicado.
 *
 * Parametriza o círculo por ângulo. Os pontos de intersecção definem
 * fronteiras angulares que dividem o círculo em arcos.
 *
 * @param {object} entity
 * @param {Array<{x,y}>} intersections
 * @param {number} mx
 * @param {number} my
 */
function trimCircle(entity, intersections, mx, my) {
  if (intersections.length < 2) {
    // Com menos de 2 intersecções não há como criar arcos fechados — remove
    entities = entities.filter(e => e.id !== entity.id);
    return;
  }

  // Converte cada ponto de intersecção para seu ângulo no círculo
  const angles = intersections
    .map(p => normalizeAngle(Math.atan2(p.y - entity.cy, p.x - entity.cx)));
  angles.sort((a, b) => a - b);

  const n           = angles.length;
  const clickAngle  = normalizeAngle(Math.atan2(my - entity.cy, mx - entity.cx));

  // Localiza o segmento de arco que contém o clique
  let removedIndex = n - 1; // Default: arco "wrap-around" (último → primeiro)
  for (let i = 0; i < n - 1; i++) {
    if (clickAngle >= angles[i] && clickAngle < angles[i + 1]) {
      removedIndex = i;
      break;
    }
  }
  // Verifica o arco wrap-around (de angles[n-1] de volta para angles[0])
  if (clickAngle >= angles[n - 1] || clickAngle < angles[0]) {
    removedIndex = n - 1;
  }

  // Remove o círculo original
  entities = entities.filter(e => e.id !== entity.id);

  // Adiciona os arcos restantes
  for (let i = 0; i < n; i++) {
    if (i === removedIndex) continue;

    const sa   = angles[i];
    const ea   = angles[(i + 1) % n]; // Wrap: último → primeiro
    const span = (ea - sa + PI2) % PI2;
    if (span < 0.05) continue;

    entities.push({ id: ++eid, type: 'arc', cx: entity.cx, cy: entity.cy, r: entity.r, sa, ea, dim: null });
  }
}

/* ─────────────────────────────────────────────────────────────
   TRIM DE ARCO
   ───────────────────────────────────────────────────────────── */

/**
 * Apara um arco: divide-o em sub-arcos, removendo o que foi clicado.
 *
 * Similar ao trim de círculo, mas limitado ao intervalo angular do arco.
 *
 * @param {object} entity
 * @param {Array<{x,y}>} intersections
 * @param {number} mx
 * @param {number} my
 */
function trimArc(entity, intersections, mx, my) {
  const startAngle = normalizeAngle(entity.sa);
  const span       = arcSpan(entity);

  // Filtra apenas as intersecções que caem dentro do intervalo do arco
  const validAngles = intersections
    .map(p => normalizeAngle(Math.atan2(p.y - entity.cy, p.x - entity.cx)))
    .filter(a => {
      const offset = (a - startAngle + PI2) % PI2;
      return offset > EPSILON && offset < span - EPSILON;
    });

  if (validAngles.length === 0) {
    // Sem intersecções no arco — remove o arco inteiro
    entities = entities.filter(e => e.id !== entity.id);
    return;
  }

  // Ordena por offset a partir do início do arco (sentido horário)
  validAngles.sort((a, b) => (a - startAngle + PI2) % PI2 - (b - startAngle + PI2) % PI2);

  // Monta fronteiras: [início do arco, ...intersecções, fim do arco]
  const boundaries = [normalizeAngle(entity.sa), ...validAngles, normalizeAngle(entity.ea)];

  // Localiza o segmento que contém o clique
  const clickAngle  = normalizeAngle(Math.atan2(my - entity.cy, mx - entity.cx));
  const clickOffset = (clickAngle - startAngle + PI2) % PI2;

  let removedIndex = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = (boundaries[i]     - startAngle + PI2) % PI2;
    const segEnd   = (boundaries[i + 1] - startAngle + PI2) % PI2;
    if (clickOffset >= segStart && clickOffset <= segEnd + EPSILON) {
      removedIndex = i;
      break;
    }
  }

  // Remove o arco original
  entities = entities.filter(e => e.id !== entity.id);

  // Adiciona os sub-arcos restantes
  for (let i = 0; i < boundaries.length - 1; i++) {
    if (i === removedIndex) continue;

    const segSa   = boundaries[i];
    const segEa   = boundaries[i + 1];
    const segSpan = (segEa - segSa + PI2) % PI2;
    if (segSpan < 0.05) continue;

    entities.push({ id: ++eid, type: 'arc', cx: entity.cx, cy: entity.cy, r: entity.r, sa: segSa, ea: segEa, dim: null });
  }
}
