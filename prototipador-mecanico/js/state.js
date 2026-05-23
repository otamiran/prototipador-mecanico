/**
 * state.js
 * ========
 * Estado global mutável da aplicação.
 *
 * Todas as variáveis que mudam durante o uso ficam aqui.
 * Isso torna o estado previsível: qualquer arquivo pode ler
 * ou modificar o estado, mas sabe exatamente onde procurá-lo.
 *
 * CONVENÇÃO DE TIPOS
 * ──────────────────
 * Entidade linha:
 *   { id: number, type: 'line', x1, y1, x2, y2, dim: number|null }
 *
 * Entidade círculo:
 *   { id: number, type: 'circle', cx, cy, r, dim: number|null }
 *
 * Entidade arco:
 *   { id: number, type: 'arc', cx, cy, r, sa, ea, dim: number|null }
 *   sa = startAngle, ea = endAngle, ambos em radianos (convenção SVG, Y para baixo).
 *   O arco sempre vai de sa até ea no sentido horário (sweep=1 no SVG).
 *
 * O campo `dim` guarda a cota fixada pelo usuário (ou null se livre).
 * Quando fixado, as cotas são exibidas em roxo.
 */

/* ─────────────────────────────────────────────────────────────
   ENTIDADES
   ───────────────────────────────────────────────────────────── */

/** Array principal: todas as entidades geométricas do esboço. */
let entities = [];

/** Contador de IDs auto-incrementado — cada nova entidade recebe ++eid. */
let eid = 0;

/* ─────────────────────────────────────────────────────────────
   SELEÇÃO
   ───────────────────────────────────────────────────────────── */

/** Set com os IDs das entidades atualmente selecionadas.
 *  Permite múltipla seleção com Shift+Clique. */
let selected = new Set();

/* ─────────────────────────────────────────────────────────────
   FERRAMENTA ATIVA
   ───────────────────────────────────────────────────────────── */

/** Ferramenta ativa: 'select' | 'line' | 'circle' | 'arc' | 'trim' | 'delete' */
let tool = 'select';

/**
 * Estado de construção da ferramenta em progresso.
 * O formato varia conforme a ferramenta:
 *
 *   linha:   null  →  { step:1, x1, y1 }
 *   círculo: null  →  { step:1, cx, cy }
 *   arco:    null  →  { step:1, cx, cy }  →  { step:2, cx, cy, r, sa }
 *
 * null significa que a ferramenta está aguardando o primeiro clique.
 */
let buildState = null;

/* ─────────────────────────────────────────────────────────────
   INTERAÇÃO COM O MOUSE
   ───────────────────────────────────────────────────────────── */

/** ID da entidade sobre a qual o cursor está passando (hover). */
let hoveredId = null;

/**
 * Estado de arraste de uma alça de controle (handle).
 * Quando não há arraste em curso: null.
 * Quando arrastando:
 *   {
 *     eid:  number,   // ID da entidade sendo editada
 *     key:  string,   // Identificador da alça (ex: 'p1', 'center', 'sa')
 *     orig: object    // Snapshot profundo da entidade antes do arraste
 *   }
 */
let dragState = null;

/** Posição bruta (sem snap) do cursor dentro do SVG, em pixels. */
let rawMouse = { x: 0, y: 0 };

/* ─────────────────────────────────────────────────────────────
   CONFIGURAÇÕES DE CANVAS
   ───────────────────────────────────────────────────────────── */

/** Se true, o cursor encaixa na grade ao desenhar. */
let snapEnabled = true;

/** Se true, a grade de fundo é exibida. */
let showGrid = true;

/* ─────────────────────────────────────────────────────────────
   HISTÓRICO DE DESFAZER (UNDO)
   ───────────────────────────────────────────────────────────── */

/**
 * Pilha de snapshots do array `entities`.
 * Cada entrada é uma cópia profunda (JSON) de `entities`
 * gravada antes de uma ação destrutiva.
 * Limite de 60 entradas para não consumir memória excessiva.
 */
let undoHistory = [];

/* ─────────────────────────────────────────────────────────────
   EDIÇÃO DE DIMENSÃO (OVERLAY)
   ───────────────────────────────────────────────────────────── */

/** ID da entidade com o overlay de edição de cota aberto. */
let editingDimId = null;

/** Tipo da dimensão sendo editada: 'line' | 'circle' | 'arc' */
let editingDimType = null;

/* ─────────────────────────────────────────────────────────────
   PERSISTÊNCIA
   ───────────────────────────────────────────────────────────── */

/** Nome do projeto atual (chave no localStorage e nome do arquivo exportado). */
let currentProjectName = 'Projeto 1';

/** Referência ao temporizador do debounce do auto-save. */
let saveTimer = null;
