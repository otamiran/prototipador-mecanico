/**
 * export.js
 * =========
 * Funções de exportação do esboço para formatos externos.
 *
 * FORMATOS SUPORTADOS
 * ───────────────────
 * DXF (Drawing Exchange Format)
 *   Padrão aberto criado pela Autodesk. Compatível com AutoCAD, FreeCAD,
 *   LibreCAD, SolidWorks, CATIA, BricsCAD e praticamente qualquer software CAD.
 *   Gerado no formato AC1009 (DXF R12) — o mais compatível entre versões.
 *
 *   CONVERSÃO DE COORDENADAS DXF
 *   ─────────────────────────────
 *   O SVG usa Y crescendo para baixo; o DXF usa Y crescendo para cima.
 *   Por isso todas as coordenadas Y são negadas: Y_dxf = -Y_svg.
 *
 *   Para arcos, a inversão do eixo Y também inverte a direção de rotação:
 *   horário no SVG → anti-horário no DXF.
 *   Portanto os ângulos de início e fim são trocados após a negação:
 *     sa_dxf = -ea_svg (em graus, normalizado para [0, 360))
 *     ea_dxf = -sa_svg (em graus, normalizado para [0, 360))
 *
 * SVG (Scalable Vector Graphics)
 *   Exporta o esboço como SVG vetorial puro, sem grade nem anotações.
 *   Centralizado em uma viewBox justa com padding de 20px.
 */

/* ─────────────────────────────────────────────────────────────
   EXPORTAÇÃO DXF
   ───────────────────────────────────────────────────────────── */

/**
 * Gera e baixa o arquivo DXF do esboço atual.
 * Exibe um toast de confirmação ou erro.
 */
function exportDXF() {
  if (entities.length === 0) {
    showToast('Nada para exportar — desenhe algo primeiro');
    return;
  }

  const lines = []; // Linhas do arquivo DXF (pares código/valor)

  // Utilitário: adiciona um par código/valor
  const L = (code, value) => lines.push(`${code}\n${value}`);

  /* ── SEÇÃO HEADER ────────────────────────── */
  L(0, 'SECTION'); L(2, 'HEADER');
  L(9, '$ACADVER'); L(1, 'AC1009');   // DXF R12: máxima compatibilidade
  L(9, '$INSUNITS'); L(70, 4);        // 4 = milímetros
  L(0, 'ENDSEC');

  /* ── SEÇÃO TABLES (definição de camada) ──── */
  L(0, 'SECTION'); L(2, 'TABLES');
  L(0, 'TABLE');   L(2, 'LAYER'); L(70, 1);
  L(0, 'LAYER');   L(2, '0');    L(70, 0); L(62, 7); L(6, 'CONTINUOUS');
  L(0, 'ENDTAB');
  L(0, 'ENDSEC');

  /* ── SEÇÃO ENTITIES ──────────────────────── */
  L(0, 'SECTION'); L(2, 'ENTITIES');

  for (const e of entities) {
    if (e.type === 'line') {
      writeDxfLine(L, e);
    } else if (e.type === 'circle') {
      writeDxfCircle(L, e);
    } else if (e.type === 'arc') {
      writeDxfArc(L, e);
    }
  }

  L(0, 'ENDSEC');
  L(0, 'EOF');

  // Monta o conteúdo e força o download
  const content  = lines.join('\n');
  const filename = sanitizeFilename(currentProjectName) + '.dxf';
  downloadBlob(content, filename, 'application/dxf');

  showToast('✓ DXF exportado — abra com AutoCAD, FreeCAD ou LibreCAD');
}

/**
 * Escreve a entidade LINE no DXF.
 * Nega Y para converter do sistema SVG para o DXF.
 * @param {Function} L - Acumulador de linhas DXF
 * @param {object} e   - Entidade linha
 */
function writeDxfLine(L, e) {
  L(0, 'LINE'); L(8, '0');
  L(10, e.x1.toFixed(6)); L(20, (-e.y1).toFixed(6)); L(30, '0.0');
  L(11, e.x2.toFixed(6)); L(21, (-e.y2).toFixed(6)); L(31, '0.0');
}

/**
 * Escreve a entidade CIRCLE no DXF.
 * @param {Function} L
 * @param {object} e - Entidade círculo
 */
function writeDxfCircle(L, e) {
  L(0, 'CIRCLE'); L(8, '0');
  L(10, e.cx.toFixed(6)); L(20, (-e.cy).toFixed(6)); L(30, '0.0');
  L(40, e.r.toFixed(6)); // Raio
}

/**
 * Escreve a entidade ARC no DXF.
 *
 * Conversão de ângulos:
 *   1. Negar: ângulo_dxf = -ângulo_svg (inverte Y)
 *   2. Trocar sa e ea: arc SVG horário → arc DXF anti-horário
 *   3. Normalizar para [0°, 360°)
 *
 * @param {Function} L
 * @param {object} e - Entidade arco
 */
function writeDxfArc(L, e) {
  // Troca sa↔ea e nega (converte horário SVG → anti-horário DXF com Y invertido)
  const startAngleDxf = ((-e.ea * 180 / Math.PI) % 360 + 360) % 360;
  const endAngleDxf   = ((-e.sa * 180 / Math.PI) % 360 + 360) % 360;

  L(0, 'ARC'); L(8, '0');
  L(10, e.cx.toFixed(6)); L(20, (-e.cy).toFixed(6)); L(30, '0.0');
  L(40, e.r.toFixed(6));
  L(41, startAngleDxf.toFixed(6)); // Ângulo inicial (DXF: anti-horário a partir de X+)
  L(42, endAngleDxf.toFixed(6));   // Ângulo final
}

/* ─────────────────────────────────────────────────────────────
   EXPORTAÇÃO SVG
   ───────────────────────────────────────────────────────────── */

/**
 * Gera e baixa um arquivo SVG vetorial com o esboço atual.
 * Calcula o bounding box das entidades e aplica padding de 20px.
 */
function exportSVG() {
  if (entities.length === 0) {
    showToast('Nada para exportar — desenhe algo primeiro');
    return;
  }

  // Calcula bounding box para determinar viewBox
  const bbox = computeBoundingBox();
  const pad  = 20;
  const W    = bbox.maxX - bbox.minX + pad * 2;
  const H    = bbox.maxY - bbox.minY + pad * 2;

  // Gera os elementos SVG de cada entidade
  let inner = '';
  for (const e of entities) {
    inner += entityToSvgString(e, bbox.minX - pad, bbox.minY - pad);
  }

  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     width="${W.toFixed(0)}mm" height="${H.toFixed(0)}mm"`,
    `     viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">`,
    `  <title>${currentProjectName}</title>`,
    inner,
    '</svg>'
  ].join('\n');

  const filename = sanitizeFilename(currentProjectName) + '.svg';
  downloadBlob(content, filename, 'image/svg+xml;charset=utf-8');
  showToast('✓ SVG exportado');
}

/**
 * Converte uma entidade para uma string de elemento SVG,
 * subtraindo o offset para centralizar no viewBox.
 *
 * @param {object} e
 * @param {number} offX - Offset X a subtrair (minX - padding)
 * @param {number} offY - Offset Y a subtrair (minY - padding)
 * @returns {string}
 */
function entityToSvgString(e, offX, offY) {
  const stroke = `stroke="#1e293b" stroke-width="1.5"`;

  if (e.type === 'line') {
    return `  <line x1="${(e.x1 - offX).toFixed(2)}" y1="${(e.y1 - offY).toFixed(2)}" `
         + `x2="${(e.x2 - offX).toFixed(2)}" y2="${(e.y2 - offY).toFixed(2)}" `
         + `${stroke} stroke-linecap="round"/>\n`;
  }

  if (e.type === 'circle') {
    return `  <circle cx="${(e.cx - offX).toFixed(2)}" cy="${(e.cy - offY).toFixed(2)}" `
         + `r="${e.r.toFixed(2)}" fill="none" ${stroke}/>\n`;
  }

  if (e.type === 'arc') {
    const x1 = (e.cx + e.r * Math.cos(e.sa) - offX).toFixed(2);
    const y1 = (e.cy + e.r * Math.sin(e.sa) - offY).toFixed(2);
    const x2 = (e.cx + e.r * Math.cos(e.ea) - offX).toFixed(2);
    const y2 = (e.cy + e.r * Math.sin(e.ea) - offY).toFixed(2);
    const sp = arcSpan(e);
    const la = sp > Math.PI ? 1 : 0;

    return `  <path d="M${x1},${y1}A${e.r.toFixed(2)},${e.r.toFixed(2)} 0 ${la},1 ${x2},${y2}" `
         + `fill="none" ${stroke} stroke-linecap="round"/>\n`;
  }

  return '';
}

/**
 * Calcula o bounding box de todas as entidades.
 * @returns {{ minX, minY, maxX, maxY }}
 */
function computeBoundingBox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const e of entities) {
    if (e.type === 'line') {
      minX = Math.min(minX, e.x1, e.x2);
      minY = Math.min(minY, e.y1, e.y2);
      maxX = Math.max(maxX, e.x1, e.x2);
      maxY = Math.max(maxY, e.y1, e.y2);
    } else {
      // Círculo e arco: usa o bounding box do círculo completo
      minX = Math.min(minX, e.cx - e.r);
      minY = Math.min(minY, e.cy - e.r);
      maxX = Math.max(maxX, e.cx + e.r);
      maxY = Math.max(maxY, e.cy + e.r);
    }
  }

  return { minX, minY, maxX, maxY };
}

/* ─────────────────────────────────────────────────────────────
   UTILITÁRIOS DE ARQUIVO
   ───────────────────────────────────────────────────────────── */

/**
 * Força o download de um arquivo de texto no navegador.
 * Cria um <a> temporário, clica nele e o remove.
 *
 * @param {string} content  - Conteúdo textual do arquivo
 * @param {string} filename - Nome do arquivo com extensão
 * @param {string} mimeType - Tipo MIME
 */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Remove caracteres inválidos para nomes de arquivo.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  return (name || 'esboço').replace(/[^a-z0-9_\-]/gi, '_');
}
