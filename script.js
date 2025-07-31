const editor = document.getElementById('editor');
const sidebar = document.querySelector('.sidebar');
let ghost = null;
let draggedType = null;

const linkLayer = document.getElementById('link-layer');
let linkStart = null; // DOM element de départ
let previewLine = null;

// Taille CSS des objets
function getItemDimensions(type) {
  switch (type) {
    case 'initial':
    case 'step':
      return { width: 60, height: 60 };
    case 'action':
      return { width: 80, height: 60 };
    case 'transition':
      return { width: 40, height: 2 };
    case 'branch-et':
    case 'branch-ou':
      return { width: 50, height: 50 };
    default:
      return { width: 50, height: 50 };
  }
}

// Palette : drag custom
sidebar.querySelectorAll('.item').forEach(item => {
  item.addEventListener('mousedown', (e) => {
    e.preventDefault();
    draggedType = item.getAttribute('data-type');
    createGhost(draggedType, e.clientX, e.clientY);
    document.addEventListener('mousemove', moveGhost);
    document.addEventListener('mouseup', endGhostDrag);
  });
});

// Création du ghost
function createGhost(type, x, y) {
  removeGhost();
  ghost = document.createElement('div');
  ghost.classList.add('ghost-preview', 'placed-item', type);
  ghost.style.pointerEvents = 'none';
  ghost.style.position = 'fixed';
  ghost.style.opacity = '0.7';
  ghost.style.zIndex = '9999';
  ghost.style.userSelect = 'none';

  switch (type) {
    case 'initial': ghost.textContent = '0'; break;
    case 'step': ghost.textContent = 'X'; break;
    case 'action': ghost.textContent = 'Action'; break;
    case 'branch-et': ghost.textContent = 'ET'; break;
    case 'branch-ou': ghost.textContent = 'OU'; break;
    default: ghost.textContent = ''; break;
  }
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
  ghost.style.top = (y - dims.height) + 'px'; // coin inférieur gauche au pointeur
}

function endGhostDrag(e) {
  document.removeEventListener('mousemove', moveGhost);
  document.removeEventListener('mouseup', endGhostDrag);

  // Vérifier si la souris est sur l'éditeur
  const editorRect = editor.getBoundingClientRect();
  if (
    e.clientX >= editorRect.left && e.clientX <= editorRect.right &&
    e.clientY >= editorRect.top && e.clientY <= editorRect.bottom
  ) {
    // Position magnétisée du coin inférieur gauche
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

function addLinkListener(el) {
  el.addEventListener('mousedown', function(e) {
    if (!e.shiftKey) return;
    if (!(el.classList.contains('step') || el.classList.contains('initial'))) return;
    e.preventDefault();
    // 1er clic avec shift : on démarre une liaison
    if (!linkStart) {
      linkStart = el;
      showPreviewFollowMouse(el);
    }
    // 2e clic sur une étape différente
    else if (el !== linkStart) {
      drawLinkBetween(linkStart, el);
      linkStart = null;
      removePreview();
    }
  });
}

function createItem(type, x, y) {
  const el = document.createElement('div');
  el.classList.add('placed-item', type);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.position = 'absolute';
  el.style.userSelect = 'none';
  el.contentEditable = (type === 'step' || type === 'initial' || type === 'action');

  switch (type) {
    case 'initial': el.textContent = '0'; break;
    case 'step': el.textContent = 'X'; break;
    case 'action': el.textContent = 'Action'; break;
    case 'branch-et': el.textContent = 'ET'; break;
    case 'branch-ou': el.textContent = 'OU'; break;
    default: el.textContent = ''; break;
  }

  editor.appendChild(el);
  makeDraggable(el);
  addLinkListener(el);
}

// Déplacement objets déjà placés
function makeDraggable(el) {
  let offsetX, offsetY;
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
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
  }

  function stop() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', stop);
  }
}



// Gestion du clic pour la liaison
editor.addEventListener('mousedown', function(e) {
  if (!e.shiftKey) return;
  const target = e.target;
  if (!target.classList.contains('placed-item')) return;
  if (!(target.classList.contains('step') || target.classList.contains('initial'))) return;

  e.preventDefault();
  // 1er clic avec shift : on démarre une liaison
  if (!linkStart) {
    linkStart = target;
    showPreviewFollowMouse(target);
  }
  // 2e clic sur une étape différente
  else if (target !== linkStart) {
    drawLinkBetween(linkStart, target);
    linkStart = null;
    removePreview();
  }
});

function getCenterPos(el) {
  const editorRect = editor.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - editorRect.left + rect.width / 2,
    y: rect.top - editorRect.top + rect.height / 2
  };
}

function drawLinkBetween(el1, el2) {
  const a = getCenterPos(el1);
  const b = getCenterPos(el2);

  // Trait orthogonal : vertical d'abord, puis horizontal, ou inversement
  const points = [
    [a.x, a.y],
    [a.x, b.y], // Vertical puis horizontal
    [b.x, b.y]
  ];

  // Si les deux objets sont plus éloignés en X qu'en Y, on commence par horizontal
  if (Math.abs(b.x - a.x) > Math.abs(b.y - a.y)) {
    points[1] = [b.x, a.y];
  }

  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute('class', 'link-line');
  line.setAttribute('points', points.map(p => p.join(',')).join(' '));
  linkLayer.appendChild(line);
}

// Affiche un trait fantôme qui suit la souris
function showPreviewFollowMouse(startEl) {
  removePreview();
  previewLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  previewLine.setAttribute('class', 'link-line link-preview');
  linkLayer.appendChild(previewLine);

  function mousemove(e) {
    const a = getCenterPos(startEl);
    const editorRect = editor.getBoundingClientRect();
    // Coordonnées souris dans le repère de l'éditeur
    const mx = e.clientX - editorRect.left;
    const my = e.clientY - editorRect.top;

    // Orthogonal
    let points = [
      [a.x, a.y],
      [a.x, my],
      [mx, my]
    ];
    if (Math.abs(mx - a.x) > Math.abs(my - a.y)) {
      points[1] = [mx, a.y];
    }
    previewLine.setAttribute('points', points.map(p => p.join(',')).join(' '));
  }

  window.addEventListener('mousemove', mousemove);

  previewLine._removeEvents = () => {
    window.removeEventListener('mousemove', mousemove);
  };
}
function removePreview() {
  if (previewLine) {
    if (previewLine._removeEvents) previewLine._removeEvents();
    previewLine.remove();
    previewLine = null;
  }
}

// Annule la preview si on clique ailleurs sans finir la liaison
document.addEventListener('mousedown', function(e) {
  if (!e.shiftKey && linkStart) {
    linkStart = null;
    removePreview();
  }
});

