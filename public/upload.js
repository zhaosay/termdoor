// Drag a file onto the terminal area to upload it to this machine.
// Classic script: app.js calls wireDrop() once the app is up.
function wireDrop({ panesEl, hint, authQuery, currentSession, t }) {
  let depth = 0;
  panesEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (++depth === 1) hint.classList.add('show');
  });
  panesEl.addEventListener('dragover', (e) => e.preventDefault());
  panesEl.addEventListener('dragleave', () => {
    if (--depth <= 0) { depth = 0; hint.classList.remove('show'); }
  });
  panesEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    hint.classList.remove('show');
    for (const file of [...(e.dataTransfer.files || [])]) {
      const session = currentSession();
      try {
        const res = await fetch(`/api/upload?${authQuery}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-webcli-filename': encodeURIComponent(file.name),
          },
          body: file,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'failed');
        if (session) session.term.write(`\r\n\x1b[36m[${t('uploaded')}] ${data.path}\x1b[0m\r\n`);
      } catch (err) {
        if (session) session.term.write(`\r\n\x1b[31m[${t('uploadFailed')}] ${err.message}\x1b[0m\r\n`);
      }
    }
  });
}
