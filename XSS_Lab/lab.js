// Selección de elementos del DOM
const input = document.getElementById('comment');
const wall = document.getElementById('wall');
const unsafeBtn = document.getElementById('unsafeBtn');
const safeBtn = document.getElementById('safeBtn');

// 1. Función para agregar comentarios dinamizada
function addComment(content, isSafe) {
  // Eliminar el mensaje inicial de "Your comments will appear here" si existe
  const initialNote = wall.querySelector('.note');
  if (initialNote && wall.children.length === 1) {
    initialNote.remove();
  }

  // Crear contenedor del comentario
  const item = document.createElement('div');
  item.className = 'comment';
  item.style.marginBottom = '12px';
  item.style.padding = '12px';
  item.style.borderRadius = '8px';
  item.style.background = '#0d1829';
  item.style.borderLeft = isSafe ? '4px solid var(--green)' : '4px solid var(--red)';

  // Crear una etiqueta visual (Badge)
  const badge = document.createElement('span');
  badge.textContent = isSafe ? ' [SAFE / textContent] ' : ' [UNSAFE / innerHTML] ';
  badge.style.fontSize = '0.75rem';
  badge.style.fontWeight = 'bold';
  badge.style.padding = '2px 6px';
  badge.style.borderRadius = '4px';
  badge.style.marginRight = '8px';
  badge.style.color = isSafe ? 'var(--green)' : 'var(--red)';
  badge.style.background = 'rgba(255,255,255,0.05)';

  // Crear contenedor de texto del comentario
  const textContainer = document.createElement('span');

  if (isSafe) {
    // SEGURO: Trata la entrada como texto plano. Los scripts NO se ejecutan.
    textContainer.textContent = content;
  } else {
    // INSEGURO: Trata la entrada como HTML. Permite inyección de código (XSS).
    // INTENTIONALLY VULNERABLE: solo para demostración educativa local.
    textContainer.innerHTML = content;
  }

  // Ensamblar el comentario y agregarlo al muro
  item.appendChild(badge);
  item.appendChild(textContainer);
  wall.insertBefore(item, wall.firstChild); // Muestra el más reciente arriba

  // Limpiar el textarea y devolver el foco
  input.value = '';
  input.focus();
}

// 2. Manejadores de eventos de los botones
unsafeBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  addComment(text, false);
});

safeBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  addComment(text, true);
});

// 3. Mejora de UX: Permitir enviar con Enter (Shift+Enter para salto de línea)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    safeBtn.click(); // Por defecto envía de forma segura con Ctrl+Enter
  }
});