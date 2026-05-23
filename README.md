# Prototipador Mecânico

Aplicação web para esboço e prototipação de peças mecânicas em 2D.
Funciona como arquivo HTML estático — sem servidor, sem dependências instaladas.

---

## Funcionalidades

- **Ferramentas de desenho:** linha, círculo, arco (3 cliques: centro → início → fim)
- **Aparar (trim):** clica no segmento entre intersecções para removê-lo
- **Cotas dimensionais:** clique nos labels em vermelho/roxo para editar medidas exatas
- **Alças de controle:** arraste os pontos azuis para editar geometria com o mouse
- **Snap à grade** e **snap a pontos de ancoragem** (endpoints, centros)
- **Desfazer** (Ctrl+Z) com histórico de 60 ações
- **Salvar/carregar** projetos no navegador (localStorage)
- **Auto-save** automático a cada alteração
- **Exportar DXF** (compatível com AutoCAD, FreeCAD, LibreCAD, SolidWorks…)
- **Exportar SVG** vetorial

---

## Estrutura de Arquivos

```
prototipador-mecanico/
│
├── index.html              # Estrutura HTML pura — sem lógica inline
│
├── css/
│   └── styles.css          # Todos os estilos (variáveis, layout, componentes)
│
└── js/
    ├── config.js           # Constantes e configurações globais
    ├── state.js            # Estado mutável da aplicação (variáveis globais)
    ├── geometry.js         # Funções matemáticas puras (distância, intersecções, arcos)
    ├── render.js           # Renderização SVG (entidades, handles, cotas, preview)
    ├── trim.js             # Algoritmo de aparar linhas, círculos e arcos
    ├── dimension.js        # Overlay de edição de cotas
    ├── panel.js            # Painel de propriedades lateral
    ├── persistence.js      # Salvar/carregar no localStorage + modal
    ├── export.js           # Exportação DXF e SVG
    └── main.js             # Inicialização, eventos, atalhos de teclado
```

---

## Como Usar Localmente

1. Baixe ou clone todos os arquivos mantendo a estrutura de pastas.
2. Abra `index.html` diretamente no navegador.

> **Nota:** Alguns navegadores bloqueiam carregamento de scripts locais por segurança.
> Se os ícones não aparecerem (requerem CDN), use um servidor local simples:
> ```bash
> # Python 3
> python -m http.server 8080
> # Node.js (com npx)
> npx serve .
> ```
> Depois acesse `http://localhost:8080`.

---

## Como Hospedar no GitHub Pages

1. Crie um repositório público no [GitHub](https://github.com).
2. Faça upload de todos os arquivos (mantendo a estrutura de pastas).
3. Vá em **Settings → Pages → Source → Deploy from a branch → main / (root)**.
4. Aguarde ~1 minuto e acesse `https://seu-usuario.github.io/nome-do-repositorio`.

---

## Atalhos de Teclado

| Tecla       | Ação                        |
|-------------|---------------------------  |
| `S`         | Ferramenta Selecionar        |
| `L`         | Ferramenta Linha             |
| `C`         | Ferramenta Círculo           |
| `A`         | Ferramenta Arco              |
| `T`         | Ferramenta Aparar            |
| `D`         | Ferramenta Deletar           |
| `Del`       | Deletar seleção atual        |
| `Esc`       | Cancelar operação em curso   |
| `Ctrl+Z`    | Desfazer                     |

---

## Sobre o Formato DXF

O arquivo exportado segue o padrão **DXF R12 (AC1009)** — o mais compatível entre
versões de software CAD. É lido por:

- AutoCAD (todas as versões)
- FreeCAD (gratuito, open source)
- LibreCAD (gratuito, especializado em 2D)
- SolidWorks, CATIA, BricsCAD, DraftSight e outros

> O formato DWG (`.dwg`) é proprietário da Autodesk e requer licença paga para
> ser gerado programaticamente. O DXF é o equivalente aberto e é aceito por
> praticamente todos os softwares CAD. Se necessário, abra o DXF no AutoCAD
> e salve como DWG com um clique.

---

## Convenção de Coordenadas

O app usa o sistema de coordenadas do SVG (Y cresce para baixo).
Na escala padrão, **1 pixel equivale a 1 milímetro**.

Ao exportar para DXF, as coordenadas Y são negadas (`Y_dxf = -Y_svg`)
para converter para o sistema CAD (Y cresce para cima), e os ângulos dos
arcos são ajustados de acordo.

---

## Licença

Projeto de uso livre. Sinta-se à vontade para modificar e redistribuir.
