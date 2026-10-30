export function setupWorkspacePanel() {
  const main = document.querySelector('main');
  const panel = document.getElementById('workspace-pane');
  const toggle = document.getElementById('workspace-toggle');
  const close = document.getElementById('workspace-close');
  const backdrop = document.getElementById('workspace-backdrop');
  const divider = document.getElementById('pane-divider');
  const conversation = document.getElementById('conversation-pane');
  const narrow = matchMedia('(max-width: 600px)');
  const key = 'companion-workspace-open';
  let open = false;
  try { open = localStorage.getItem(key) === 'true'; } catch { /* Optional preference. */ }

  function render() {
    main.classList.toggle('workspace-hidden', !open);
    panel.hidden = !open;
    divider.hidden = !open || narrow.matches;
    backdrop.hidden = !open || !narrow.matches;
    conversation.inert = open && narrow.matches;
    toggle.setAttribute('aria-expanded', String(open));
  }
  function setOpen(value) {
    open = value;
    render();
    try { localStorage.setItem(key, String(open)); } catch { /* Keep working without storage. */ }
    (open ? close : toggle).focus();
  }
  toggle.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open && !event.defaultPrevented) {
      event.preventDefault();
      setOpen(false);
    }
  });
  narrow.addEventListener('change', () => {
    render();
    if (open && narrow.matches && conversation.contains(document.activeElement)) close.focus();
  });
  render();
}
