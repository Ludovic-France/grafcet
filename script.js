const editor = document.getElementById('editor');
const sidebar = document.querySelector('.sidebar');
const linkLayer = document.getElementById('link-layer');
let ghost = null;
let draggedType = null;

// Données pour la gestion des liens
let links = []; // {from: anchorId, to: anchorId}
let anchors = {}; // id -> {el, parentObj, position, ...}
let anchorIdSeq = 1;

// -- gestion de la grille et du drag depuis la palette --
sidebar.querySelectorAll('.item').forEach(item => {
  item.addEventListener('mousedown', (e) => {
    e.preventDefault();
    draggedType = item.getAttribute('data-type');
    createGhost(draggedType, e.clientX, e.clientY);
    document.addEventListener('mousemove', moveGhost);
    document.addEventListener('mouseup', endGhostDrag);
  });
});

function getItemDimensions(type) {
  return (type === 'action')
    ? { width: 90, height: 40 }
    : { width: 40, height: 40 };
}

function createGhost(type, x, y) {
  removeGhost();
  ghost = document.createElement('div');
  ghost.classList.add('ghost-preview', 'placed-item', type);
  ghost.textContent = (type === 'initial') ? '0' : (type === 'step') ? 'X' : 'Action';
  ghost.style.position = 'fixed';
  document.body.appendChild(ghost);
  moveGhostPointer(x, y);
}
function moveGhost(e) {
  if (!ghost) return;
  moveGhostPointer(e.clientX, e.clientY);
}
function moveGhostPointer(x, y) {
  if (!ghost || !draggedType) return;
  const dims = getItemDimensions(draggedType);
  ghost.style.left = x + 'px';
  ghost.style.top = (y - dims.height) + 'px';
}
function endGhostDrag(e) {
  document.removeEventListener('mousemove', moveGhost);
  document.removeEventListener('mouseup', endGhostDrag);
  const editorRect = editor.getBoundingClientRect();
  if (
    e.clientX >= editorRect.left && e.clientX <= editorRect.right &&
    e.clientY >= editorRect.top && e.clientY <= editorRect.bottom
  ) {
    const gridSize = 20;
    let x = e.clientX - editorRect.left;
    let y = e.clientY - editorRect.top;
    const dims = getItemDimensions(draggedType);
    x = Math.round(x / gridSize) * gridSize;
    y = Math.round(y / gridSize) * gridSize - dims.height;
    createItem(draggedType, x, y);
  }
  removeGhost();
  draggedType = null;
}
function removeGhost() {
  if (ghost) {
    ghost.remove();
    ghost = null;
  }
}

function createItem(type, x, y) {
  const el = document.createElement('div');
  el.classList.add('placed-item', type);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.textContent = (type === 'initial') ? '0' : (type === 'step') ? 'X' : 'Action';

  editor.appendChild(el);
  makeDraggable(el);

  // Ajout des anchors
  if (type === 'step' || type === 'initial') {
    addAnchorListeners(createAnchor(el, 'top'));
    addAnchorListeners(createAnchor(el, 'bottom'));
    addAnchorListeners(createAnchor(el, 'right'));
  }
  if (type === 'action') {
    addAnchorListeners(createAnchor(el, 'left'));
  }

  el.contentEditable = (type === 'step' || type === 'initial' || type === 'action');
}

// -- Création et gestion anchors --
function createAnchor(parent, position) {
  const anchor = document.createElement('div');
  anchor.className = 'anchor ' + position;
  const id = 'a' + (anchorIdSeq++);
  anchor.dataset.anchorId = id;
  anchors[id] = {
    el: anchor,
    parentObj: parent,
    position
  };
  parent.appendChild(anchor);
  return anchor;
}
function addAnchorListeners(anchor) {
  anchor.addEventListener('mousedown', startLink);
}

// -- Liaison par anchor : drag and drop --
let linking = {
  fromAnchor: null,
  previewLine: null
};

function anchorCoords(anchor) {
  const rect = anchor.el.getBoundingClientRect();
  const svgRect = linkLayer.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - svgRect.left,
    y: rect.top + rect.height / 2 - svgRect.top
  };
}
function startLink(e) {
  e.stopPropagation();
  const fromId = e.target.dataset.anchorId;
  linking.fromAnchor = fromId;
  if (linking.previewLine) linking.previewLine.remove();
  linking.previewLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  linking.previewLine.setAttribute('class', 'link-line link-preview');
  linking.previewLine.setAttribute('stroke', '#888');
  linking.previewLine.setAttribute('stroke-width', '3');
  linking.previewLine.setAttribute('fill', 'none');
  linkLayer.appendChild(linking.previewLine);

  function move(ev) {
    const a = anchorCoords(anchors[fromId]);
    const mx = ev.clientX - linkLayer.getBoundingClientRect().left;
    const my = ev.clientY - linkLayer.getBoundingClientRect().top;
    linking.previewLine.setAttribute('points', `${a.x},${a.y} ${mx},${my}`);
  }
  function up(ev) {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if (linking.previewLine) linking.previewLine.remove();

    // Detect anchor under mouse
    let toAnchorEl = document.elementFromPoint(ev.clientX, ev.clientY);
    if (toAnchorEl && toAnchorEl.classList && toAnchorEl.classList.contains('anchor')) {
      let toId = toAnchorEl.dataset.anchorId;
      if (fromId && toId && isAnchorsCompatible(fromId, toId)) {
        links.push({ from: fromId, to: toId });
        renderLinks();
      }
    }
    linking.fromAnchor = null;
    linking.previewLine = null;
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

function isAnchorsCompatible(fromId, toId) {
  if (fromId === toId) return false;
  const a = anchors[fromId];
  const b = anchors[toId];
  // Règles GRAFCET
  if (a.position === b.position) return false;
  // Etape à étape (vertical)
  if ((a.position === 'bottom' && b.position === 'top') ||
    (a.position === 'top' && b.position === 'bottom')) return true;
  // Action à étape (horizontal, gauche vers droite)
  if (a.position === 'left' && b.position === 'right') return true;
  return false;
}

// -- Affichage dynamique des liens --
function renderLinks() {
  // Supprime les anciens traits
  Array.from(linkLayer.querySelectorAll('.link-line:not(.link-preview)')).forEach(l => l.remove());
  // Nettoie la liste de liens pour ne garder que ceux dont les 2 anchors existent ET sont dans le DOM
  links = links.filter(link => {
    const a = anchors[link.from], b = anchors[link.to];
    return a && b && document.body.contains(a.el) && document.body.contains(b.el);
  });
  links.forEach(link => {
    const a = anchors[link.from], b = anchors[link.to];
    if (!a || !b) return;
    const start = anchorCoords(a), end = anchorCoords(b);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute('class', 'link-line');
    let pts, color = '#00a';
    if ((a.position === 'bottom' && b.position === 'top') || (a.position === 'top' && b.position === 'bottom')) {
      pts = `${start.x},${start.y} ${start.x},${end.y} ${end.x},${end.y}`;
    } else {
      pts = `${start.x},${start.y} ${end.x},${end.y}`;
      color = '#000';
    }
    line.setAttribute('points', pts);
    line.setAttribute('style', `stroke: ${color}; stroke-width:3; fill:none;`);
    linkLayer.appendChild(line);
  });
}


// -- Mise à jour des liens lors du déplacement --
function makeDraggable(el) {
  let offsetX, offsetY;
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
    e.preventDefault();
  });
  function move(e) {
    const rect = editor.getBoundingClientRect();
    const gridSize = 20;
    let x = Math.round((e.clientX - rect.left - offsetX) / gridSize) * gridSize;
    let y = Math.round((e.clientY - rect.top - offsetY) / gridSize) * gridSize;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    renderLinks();
  }
  function stop() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', stop);
  }
}

// -- Shift = affichage des anchors --
document.addEventListener('keydown', (e) => {
  if (e.key === "Shift") editor.classList.add('show-anchors');
});
document.addEventListener('keyup', (e) => {
  if (e.key === "Shift") editor.classList.remove('show-anchors');
});

// -- Responsive SVG
function resizeSvg() {
  const w = window.innerWidth - 140;
  const h = window.innerHeight - 40;
  linkLayer.setAttribute('width', w);
  linkLayer.setAttribute('height', h);
  linkLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
}
window.addEventListener('resize', resizeSvg);
resizeSvg();
