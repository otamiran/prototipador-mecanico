/**
 * geometry.js
 * ===========
 * Funções matemáticas e geométricas puras.
 *
 * Este módulo não acessa o DOM nem modifica o estado global.
 * Recebe dados, calcula e retorna resultados — sem efeitos colaterais.
 * Isso torna cada função testável de forma isolada.
 *
 * SISTEMA DE COORDENADAS
 * ──────────────────────
 * Utiliza o sistema SVG/tela: origem no canto superior esquerdo,
 * X cresce para a direita, Y cresce para baixo.
 * Ângulos seguem a convenção do Math.atan2 (Y invertido):
 *   0 = direita, π/2 = baixo, π = esquerda, 3π/2 = cima.
 */

/* ─────────────────────────────────────────────────────────────
   UTILITÁRIOS BÁSICOS
   ───────────────────────────────────────────────────────────── */

/**
 * Calcula a distância euclidiana entre dois pontos.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
function distanceBetween(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Normaliza um ângulo para o intervalo [0, 2π).
 * Evita valores negativos ou maiores que 2π nos cálculos de arco.
 * @param {number} angle - Ângulo em radianos
 * @returns {number}
 */
function normalizeAngle(angle) {
  return ((angle % PI2) + PI2) % PI2;
}

/* ─────────────────────────────────────────────────────────────
   SNAP DE COORDENADAS
   ───────────────────────────────────────────────────────────── */

/**
 * Aplica snap à grade: arredonda x e y para o múltiplo mais próximo de SNAP_GRID.
 * Retorna as coordenadas sem modificação se snapEnabled for false.
 * @param {number} x
 * @param {number} y
 * @returns {{x:number, y:number}}
 */
function snapToGrid(x, y) {
  if (!snapEnabled) return { x, y };
  return {
    x: Math.round(x / SNAP_GRID) * SNAP_GRID,
    y: Math.round(y / SNAP_GRID) * SNAP_GRID
  };
}

/**
 * Calcula o ponto de snap levando em conta pontos-chave das entidades.
 * Prioridade: pontos de ancoragem (endpoints, centros) > grade.
 *
 * Atualiza o indicador visual de snap (#snap-dot) como efeito colateral.
 *
 * @param {number} rawX - Posição bruta do cursor em pixels
 * @param {number} rawY
 * @returns {{x:number, y:number}} Ponto de snap calculado
 */
function getSnapPoint(rawX, rawY) {
  const snapDot = document.getElementById('snap-dot');

  // Coleta candidatos: pontos notáveis de todas as entidades
  const candidates = [];
  for (const e of entities) {
    if (e.type === 'line') {
      candidates.push(
        { x: e.x1, y: e.y1 },          // Início da linha
        { x: e.x2, y: e.y2 },          // Fim da linha
        { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 } // Ponto médio
      );
    } else if (e.type === 'circle') {
      candidates.push(
        { x: e.cx, y: e.cy },          // Centro
        { x: e.cx + e.r, y: e.cy },    // Quadrante leste
        { x: e.cx - e.r, y: e.cy },    // Quadrante oeste
        { x: e.cx, y: e.cy + e.r },    // Quadrante sul
        { x: e.cx, y: e.cy - e.r }     // Quadrante norte
      );
    } else if (e.type === 'arc') {
      candidates.push(
        { x: e.cx, y: e.cy },          // Centro do arco
        { x: e.cx + e.r * Math.cos(e.sa), y: e.cy + e.r * Math.sin(e.sa) }, // Ponto inicial
        { x: e.cx + e.r * Math.cos(e.ea), y: e.cy + e.r * Math.sin(e.ea) }  // Ponto final
      );
    }
  }

  // Encontra o candidato mais próximo dentro da tolerância
  let bestPoint = null;
  let bestDist = SNAP_POINT_DIST;
  for (const c of candidates) {
    const d = distanceBetween({ x: rawX, y: rawY }, c);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = c;
    }
  }

  // Exibe ou oculta o indicador visual de snap
  if (bestPoint) {
    snapDot.style.display = 'block';
    snapDot.style.left  = (bestPoint.x - 6.5) + 'px';
    snapDot.style.top   = (bestPoint.y - 6.5) + 'px';
    return bestPoint;
  }

  snapDot.style.display = 'none';
  return snapToGrid(rawX, rawY);
}

/**
 * Converte as coordenadas do evento de mouse para o espaço do SVG.
 * Subtrai o offset do bounding rect do SVG.
 * @param {MouseEvent} event
 * @returns {{x:number, y:number}}
 */
function getSvgCoords(event) {
  const rect = document.getElementById('sk').getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

/* ─────────────────────────────────────────────────────────────
   PROPRIEDADES DE ARCO
   ───────────────────────────────────────────────────────────── */

/**
 * Calcula a amplitude angular do arco (de sa até ea no sentido horário).
 * Retorna PI2 (círculo completo) se sa === ea, para evitar arco de amplitude zero.
 * @param {{sa:number, ea:number}} arc
 * @returns {number} Amplitude em radianos, no intervalo (0, 2π]
 */
function arcSpan(arc) {
  const span = (normalizeAngle(arc.ea) - normalizeAngle(arc.sa) + PI2) % PI2;
  return span || PI2; // Se for 0, considera círculo completo
}

/**
 * Gera a string do atributo `d` do elemento SVG <path> para um arco.
 * O arco vai de sa até ea no sentido horário (sweep=1).
 *
 * @param {{cx,cy,r,sa,ea}} arc
 * @returns {string} SVG path data
 */
function arcToPath(arc) {
  const x1 = arc.cx + arc.r * Math.cos(arc.sa);
  const y1 = arc.cy + arc.r * Math.sin(arc.sa);
  const x2 = arc.cx + arc.r * Math.cos(arc.ea);
  const y2 = arc.cy + arc.r * Math.sin(arc.ea);

  const span     = arcSpan(arc);
  const largeArc = span > Math.PI ? 1 : 0; // Flag do SVG: 1 para arco > 180°
  const sweep    = 1; // Sempre horário (Y para baixo no SVG)

  return `M${x1},${y1}A${arc.r},${arc.r} 0 ${largeArc},${sweep} ${x2},${y2}`;
}

/**
 * Verifica se um ângulo está dentro do intervalo do arco
 * (considerando a varredura horária de sa até ea).
 *
 * @param {number} angle - Ângulo a testar (radianos)
 * @param {{sa:number, ea:number}} arc
 * @returns {boolean}
 */
function angleInArc(angle, arc) {
  const normAngle = normalizeAngle(angle);
  const normSa    = normalizeAngle(arc.sa);
  const span      = arcSpan(arc);
  const fromStart = (normAngle - normSa + PI2) % PI2;
  return fromStart <= span + EPSILON;
}

/* ─────────────────────────────────────────────────────────────
   HIT TEST
   ───────────────────────────────────────────────────────────── */

/**
 * Testa se o ponto (x, y) está sobre a entidade, dentro da tolerância.
 *
 * Para linhas: usa distância ponto-segmento.
 * Para círculos: verifica se está na borda (|dist - r| < threshold).
 * Para arcos: como círculo, mas também valida o ângulo.
 *
 * @param {number} x
 * @param {number} y
 * @param {object} entity
 * @param {number} [threshold] - Padrão: HIT_THRESHOLD
 * @returns {boolean}
 */
function hitTest(x, y, entity, threshold = HIT_THRESHOLD) {
  if (entity.type === 'line') {
    const dx = entity.x2 - entity.x1;
    const dy = entity.y2 - entity.y1;
    const len2 = dx * dx + dy * dy;

    if (len2 < EPSILON) {
      // Linha degenerada (ponto): distância simples
      return distanceBetween({ x, y }, { x: entity.x1, y: entity.y1 }) < threshold;
    }

    // Parâmetro t da projeção do ponto no segmento, clamped em [0,1]
    const t = Math.max(0, Math.min(1, ((x - entity.x1) * dx + (y - entity.y1) * dy) / len2));
    const closestX = entity.x1 + t * dx;
    const closestY = entity.y1 + t * dy;
    return distanceBetween({ x, y }, { x: closestX, y: closestY }) < threshold;
  }

  if (entity.type === 'circle') {
    // Testa se está sobre a borda do círculo
    return Math.abs(distanceBetween({ x, y }, { x: entity.cx, y: entity.cy }) - entity.r) < threshold;
  }

  if (entity.type === 'arc') {
    // Primeiro verifica a borda, depois o ângulo
    if (Math.abs(distanceBetween({ x, y }, { x: entity.cx, y: entity.cy }) - entity.r) >= threshold) {
      return false;
    }
    return angleInArc(Math.atan2(y - entity.cy, x - entity.cx), entity);
  }

  return false;
}

/* ─────────────────────────────────────────────────────────────
   INTERSECÇÕES GEOMÉTRICAS
   ───────────────────────────────────────────────────────────── */

/**
 * Intersecção entre dois segmentos de linha.
 * Usa álgebra linear: resolve o sistema 2×2 de equações paramétricas.
 *
 * @param {object} l1 - { x1,y1,x2,y2 }
 * @param {object} l2 - { x1,y1,x2,y2 }
 * @returns {Array<{x,y}>} Array com 0 ou 1 ponto de intersecção
 */
function lineLineIntersect(l1, l2) {
  const dx1 = l1.x2 - l1.x1, dy1 = l1.y2 - l1.y1;
  const dx2 = l2.x2 - l2.x1, dy2 = l2.y2 - l2.y1;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPSILON) return []; // Linhas paralelas

  // Parâmetros paramétricos t (em l1) e u (em l2)
  const t = ((l2.x1 - l1.x1) * dy2 - (l2.y1 - l1.y1) * dx2) / denom;
  const u = ((l2.x1 - l1.x1) * dy1 - (l2.y1 - l1.y1) * dx1) / denom;

  // Intersecção só ocorre se t e u estiverem em [0, 1]
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return [];

  return [{ x: l1.x1 + t * dx1, y: l1.y1 + t * dy1 }];
}

/**
 * Intersecção entre um segmento de linha e um círculo ou arco.
 * Resolve a equação quadrática substituindo a parametrização da linha no círculo.
 *
 * @param {object} line   - { x1,y1,x2,y2 }
 * @param {object} circle - { cx,cy,r } ou arco com { cx,cy,r,sa,ea }
 * @returns {Array<{x,y}>}
 */
function lineCircleIntersect(line, circle) {
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
  const fx = line.x1 - circle.cx, fy = line.y1 - circle.cy;

  const a    = dx * dx + dy * dy;
  const b    = 2 * (fx * dx + fy * dy);
  const c    = fx * fx + fy * fy - circle.r * circle.r;
  const disc = b * b - 4 * a * c;

  if (disc < 0 || a < EPSILON) return []; // Sem intersecção real

  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const result   = [];

  for (const t of [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)]) {
    if (t < -EPSILON || t > 1 + EPSILON) continue; // Fora do segmento

    const x = line.x1 + t * dx;
    const y = line.y1 + t * dy;

    // Se for um arco, verifica se o ponto está dentro do intervalo angular
    if (circle.type === 'arc' && !angleInArc(Math.atan2(y - circle.cy, x - circle.cx), circle)) {
      continue;
    }

    result.push({ x, y });
  }

  return result;
}

/**
 * Intersecção entre dois círculos ou arcos.
 * Usa a fórmula geométrica: encontra o(s) ponto(s) equidistantes dos dois centros.
 *
 * @param {object} c1 - círculo ou arco
 * @param {object} c2 - círculo ou arco
 * @returns {Array<{x,y}>}
 */
function circleCircleIntersect(c1, c2) {
  const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
  const d  = Math.sqrt(dx * dx + dy * dy);

  // Casos sem intersecção: muito afastados, um dentro do outro, ou concêntricos
  if (d > c1.r + c2.r + EPSILON) return [];
  if (d < Math.abs(c1.r - c2.r) - EPSILON) return [];
  if (d < EPSILON) return [];

  // Distância do centro de c1 ao ponto médio das intersecções
  const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a));

  // Ponto médio entre as duas intersecções
  const midX = c1.cx + a * dx / d;
  const midY = c1.cy + a * dy / d;

  const candidates = [
    { x: midX + h * dy / d, y: midY - h * dx / d },
    { x: midX - h * dy / d, y: midY + h * dx / d }
  ];

  const result = [];
  for (const p of candidates) {
    let valid = true;

    // Para arcos, verifica o intervalo angular em cada um
    if (c1.type === 'arc' && !angleInArc(Math.atan2(p.y - c1.cy, p.x - c1.cx), c1)) valid = false;
    if (valid && c2.type === 'arc' && !angleInArc(Math.atan2(p.y - c2.cy, p.x - c2.cx), c2)) valid = false;

    if (valid) result.push(p);
    if (h < EPSILON) break; // Tangência: apenas um ponto
  }

  return result;
}

/**
 * Ponto de entrada para calcular intersecções entre quaisquer dois tipos de entidade.
 * Despacha para a função especializada correta.
 *
 * @param {object} e1
 * @param {object} e2
 * @returns {Array<{x,y}>}
 */
function getIntersections(e1, e2) {
  const isCircular = t => t === 'circle' || t === 'arc';

  if (e1.type === 'line' && e2.type === 'line') return lineLineIntersect(e1, e2);
  if (e1.type === 'line' && isCircular(e2.type)) return lineCircleIntersect(e1, e2);
  if (isCircular(e1.type) && e2.type === 'line') return lineCircleIntersect(e2, e1);
  return circleCircleIntersect(e1, e2);
}

/* ─────────────────────────────────────────────────────────────
   UTILITÁRIOS DE ENTIDADE
   ───────────────────────────────────────────────────────────── */

/**
 * Retorna o ponto representativo central de uma entidade
 * (usado para calcular distâncias relativas no painel).
 *
 * @param {object} entity
 * @returns {{x:number, y:number}}
 */
function centerOfEntity(entity) {
  if (entity.type === 'line') {
    return {
      x: (entity.x1 + entity.x2) / 2,
      y: (entity.y1 + entity.y2) / 2
    };
  }
  return { x: entity.cx, y: entity.cy };
}
