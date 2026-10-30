export function setupPaneResize() {
  const main = document.querySelector('main');
  const divider = document.getElementById('pane-divider');
  const key = 'companion-pane-width';
  let preferred = 58;
  let dragging = false;
  try {
    const saved = Number(localStorage.getItem(key));
    if (saved > 0 && saved < 100) preferred = saved;
  } catch { /* Resizing still works without browser storage. */ }

  function render() {
    const width = main.getBoundingClientRect().width;
    if (width <= 600) return;
    const min = 280 / width * 100;
    const max = (width - 288) / width * 100;
    const ratio = Math.min(max, Math.max(min, preferred));
    main.style.setProperty('--conversation-width', `${ratio}%`);
    divider.setAttribute('aria-valuemin', String(Math.round(min)));
    divider.setAttribute('aria-valuemax', String(Math.round(max)));
    divider.setAttribute('aria-valuenow', String(Math.round(ratio)));
    divider.setAttribute('aria-valuetext', `Conversation ${Math.round(ratio)} percent`);
  }
  function resize(value) {
    const width = main.getBoundingClientRect().width;
    preferred = Math.min((width - 288) / width * 100, Math.max(280 / width * 100, value));
    render();
    try { localStorage.setItem(key, String(preferred)); } catch { /* Optional preference. */ }
  }
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = true;
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-panes');
    event.preventDefault();
  });
  divider.addEventListener('pointermove', event => {
    if (!dragging) return;
    const rect = main.getBoundingClientRect();
    resize((event.clientX - rect.left) / rect.width * 100);
  });
  const stop = () => { dragging = false; document.body.classList.remove('resizing-panes'); };
  divider.addEventListener('pointerup', stop);
  divider.addEventListener('pointercancel', stop);
  divider.addEventListener('lostpointercapture', stop);
  divider.addEventListener('dblclick', () => resize(58));
  divider.addEventListener('keydown', event => {
    const current = Number(divider.getAttribute('aria-valuenow'));
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); resize(current + (event.key === 'ArrowLeft' ? -2 : 2));
    } else if (event.key === 'Home') {
      event.preventDefault(); resize(58);
    }
  });
  new ResizeObserver(render).observe(main);
  render();
}
