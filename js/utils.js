// ===== js/utils.js =====

// ===== TOAST NOTIFICATIONS =====
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = { success: '✓', error: '✕', info: 'ℹ' }[type] || 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== MODAL =====
export function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

export function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

export function setupModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    overlay.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('open'));
    });
  });
}

// ===== FORMATTING =====
export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'object' ? ts : ts);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fullName(p) {
  if (!p) return '';
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

export function shortName(p) {
  if (!p) return '';
  const last = p.lastName || '';
  const fi = p.firstName ? p.firstName[0] + '.' : '';
  const mi = p.middleName ? p.middleName[0] + '.' : '';
  return [last, fi + mi].filter(Boolean).join(' ');
}

// ===== PLACE BADGE HTML =====
export function placeBadgeHtml(place) {
  if (!place) return '<span class="text-muted">—</span>';
  const cls = place === 1 ? 'place-1' : place === 2 ? 'place-2' : place === 3 ? 'place-3' : 'place-other';
  return `<span class="place-badge ${cls}">${place}</span>`;
}

// ===== DOCX EXPORT =====
// Используем библиотеку docx (подключается через CDN в HTML)
export async function exportToDocx(raceData, eventInfo) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, WidthType, BorderStyle, HeadingLevel
  } = window.docx;

  const rows = [
    // Заголовок таблицы
    new TableRow({
      tableHeader: true,
      children: [
        '№ уч.', 'Фамилия, Имя', 'Организация', 'Старт. позиции',
        'Мото 1', 'Мото 2', 'Мото 3', 'Очки', 'Место'
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
        shading: { fill: 'F0F0F0' }
      }))
    }),
    // Данные
    ...raceData.participants.map(p => new TableRow({
      children: [
        p.number, p.name, p.organization,
        (p.positions || []).join(' / '),
        p.moto1 || '—', p.moto2 || '—', p.moto3 || '—',
        p.total != null ? String(p.total) : '—',
        p.place != null ? String(p.place) : '—'
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18 })] })]
      }))
    }))
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'ПРОТОКОЛ СОРЕВНОВАНИЙ',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: `Место проведения: ${eventInfo.location || ''}`, spacing: { after: 100 } }),
        new Paragraph({ text: `Дата: ${eventInfo.date || ''}`, spacing: { after: 100 } }),
        new Paragraph({ text: `Дисциплина: ${raceData.name || 'Классик'}`, spacing: { after: 200 } }),
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: `Гл. судья: ${eventInfo.headJudge || ''}`, spacing: { before: 300 } }),
        new Paragraph({ text: `Гл. секретарь: ${eventInfo.secretary || ''}` }),
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `BMX_Протокол_${Date.now()}.docx`);
}

// ===== PDF EXPORT (через window.print или html2pdf) =====
export function exportToPdf(raceData, eventInfo) {
  const win = window.open('', '_blank', 'width=900,height=700');
  const rows = raceData.participants.map((p, i) => `
    <tr>
      <td>${p.number || ''}</td>
      <td style="text-align:left">${p.name || ''}</td>
      <td style="text-align:left">${p.organization || ''}</td>
      <td>${(p.positions || []).join(' / ')}</td>
      <td>${p.moto1 || '—'}</td>
      <td>${p.moto2 || '—'}</td>
      <td>${p.moto3 || '—'}</td>
      <td><b>${p.total != null ? p.total : '—'}</b></td>
      <td><b>${p.place != null ? p.place : '—'}</b></td>
    </tr>
  `).join('');

  win.document.write(`
    <!DOCTYPE html><html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Протокол BMX</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12px; margin: 20px; color: #000; }
        h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
        h2 { text-align: center; font-size: 13px; margin-bottom: 16px; }
        .meta { margin-bottom: 16px; }
        .meta p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #666; padding: 5px 8px; text-align: center; }
        th { background: #eee; font-weight: bold; }
        .footer { margin-top: 30px; }
        .footer p { margin: 6px 0; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>ПРОТОКОЛ СОРЕВНОВАНИЙ</h1>
      <h2>Велосипедный спорт BMX — Гонка "${raceData.name || 'Классик'}"</h2>
      <div class="meta">
        <p><b>Место проведения:</b> ${eventInfo.location || ''}</p>
        <p><b>Дата:</b> ${eventInfo.date || ''}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>№ уч.</th><th>Фамилия, Имя</th><th>Организация</th>
            <th>Старт. позиции</th><th>Мото 1</th><th>Мото 2</th><th>Мото 3</th>
            <th>Очки</th><th>Место</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <p>Гл. судья: ${eventInfo.headJudge || '_______________'}</p>
        <p>Гл. секретарь: ${eventInfo.secretary || '_______________'}</p>
        <p>Судья на финише: ${eventInfo.finishJudge || '_______________'}</p>
      </div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ===== DEBOUNCE =====
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ===== GENERATE ID =====
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
