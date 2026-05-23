/**
 * config.js
 * =========
 * Constantes e configurações globais da aplicação.
 *
 * Centralizar aqui facilita ajustar comportamentos sem
 * precisar caçar valores espalhados em vários arquivos.
 * Qualquer valor que apareça mais de uma vez, ou que
 * represente um limiar ajustável, deve estar aqui.
 */

/* ─────────────────────────────────────────────────────────────
   GRADE E SNAP
   ───────────────────────────────────────────────────────────── */

/** Tamanho da célula da grade em pixels.
 *  Na escala padrão do app, 1 px ≡ 1 mm. */
const SNAP_GRID = 10;

/** Distância máxima (px) para ativar snap a um ponto de ancoragem
 *  (endpoint de linha, centro de círculo/arco, etc.). */
const SNAP_POINT_DIST = 15;

/* ─────────────────────────────────────────────────────────────
   HIT TEST
   ───────────────────────────────────────────────────────────── */

/** Tolerância padrão de hit-test em pixels.
 *  Quanto maior, mais fácil clicar em entidades finas. */
const HIT_THRESHOLD = 9;

/* ─────────────────────────────────────────────────────────────
   MATEMÁTICA
   ───────────────────────────────────────────────────────────── */

/** 2π — constante usada com frequência em cálculos de arco. */
const PI2 = Math.PI * 2;

/** Tolerância para comparações de ponto flutuante.
 *  Evita erros do tipo "0.1 + 0.2 ≠ 0.3". */
const EPSILON = 1e-9;

/* ─────────────────────────────────────────────────────────────
   PERSISTÊNCIA
   ───────────────────────────────────────────────────────────── */

/** Prefixo das chaves no localStorage.
 *  Evita colisão com outros apps no mesmo domínio. */
const STORAGE_PREFIX = 'pm_';

/** Chave especial do rascunho automático. */
const AUTOSAVE_KEY = STORAGE_PREFIX + '__autosave__';

/** Chave da lista de nomes de projetos salvos. */
const PROJECT_LIST_KEY = STORAGE_PREFIX + '__list__';

/** Delay do debounce do auto-save em milissegundos.
 *  Evita gravar a cada pequena mudança. */
const AUTOSAVE_DELAY = 800;

/** Duração do toast de notificação em milissegundos. */
const TOAST_DURATION = 2500;

/* ─────────────────────────────────────────────────────────────
   NOMES E TEXTOS DE INTERFACE
   ───────────────────────────────────────────────────────────── */

/** Nome legível de cada ferramenta (exibido na barra de status). */
const TOOL_NAMES = {
  select: 'Selecionar',
  line:   'Linha',
  circle: 'Círculo',
  arc:    'Arco',
  trim:   'Aparar',
  delete: 'Deletar'
};

/** Texto de ajuda exibido na barra de status para cada ferramenta. */
const TOOL_HINTS = {
  select: 'Clique para selecionar · Arraste as alças azuis para editar',
  line:   '1º clique: início · 2º clique: fim (encadeia · Esc para parar)',
  circle: '1º clique: centro · 2º clique: ponto no raio',
  arc:    '1º clique: centro · 2º: ponto inicial · 3º: ponto final',
  trim:   'Clique no segmento que deseja remover (apara nas intersecções)',
  delete: 'Clique em um elemento para deletá-lo'
};
