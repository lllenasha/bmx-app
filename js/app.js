// ===== js/app.js =====
// Главный модуль приложения

import { ParticipantsDB, RacesDB, EventsDB } from './firebase-config.js';
import { calcPlaces, calcParticipantScore, STANDARD_POSITIONS_8, STANDARD_POSITIONS_4, placeLabel, placeBadgeClass } from './scoring.js';
import { showToast, openModal, closeModal, setupModalClose, formatDate, fullName, shortName, placeBadgeHtml, exportToDocx, exportToPdf, debounce } from './utils.js';

// ===== APP STATE =====
const App = {
  participants: {},      // { id: { ...participantData } }
  races: {},      // { id: { ...raceData } }
  events: {},      // { id: { ...eventData } }
  currentRaceId: null,
  currentEventId: null,
  unsubscribers: [],     // Firebase onValue unsubscribers
  filters: {
    participants: '',
  }
};

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.querySelector(`[data-page="${page}"]`);

  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  // Re-render on navigate
  const renderers = {
    dashboard: renderDashboard,
    participants: renderParticipants,
    races: renderRaceList,
    results: renderResults,
    protocols: renderProtocols,
  };

  if (renderers[page]) renderers[page]();
}

// ===== REAL-TIME SUBSCRIPTIONS =====
function startSubscriptions() {
  // Участники
  const unsubPart = ParticipantsDB.subscribe(data => {
    App.participants = data || {};
    updateStatusBar();
    // Re-render current page if needed
    if (document.getElementById('page-participants')?.classList.contains('active')) {
      renderParticipants();
    }
    if (document.getElementById('page-dashboard')?.classList.contains('active')) {
      renderDashboard();
    }
  });

  // Заезды
  const unsubRaces = RacesDB.subscribe(data => {
    App.races = data || {};
    if (document.getElementById('page-races')?.classList.contains('active')) {
      renderRaceList();
    }
    if (document.getElementById('page-results')?.classList.contains('active')) {
      renderResults();
    }
    // Если открыт активный заезд — обновляем таблицу в реальном времени
    if (App.currentRaceId && App.races[App.currentRaceId]) {
      renderRaceTable(App.currentRaceId);
    }
  });

  App.unsubscribers.push(unsubPart, unsubRaces);
}

function updateStatusBar() {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (dot && label) {
    dot.className = 'status-dot online';
    label.textContent = 'ОНЛАЙН';
  }
}

// ===== DASHBOARD =====
function renderDashboard() {
  const parts = Object.values(App.participants);
  const races = Object.values(App.races);

  document.getElementById('stat-participants').textContent = parts.length;
  document.getElementById('stat-races').textContent = races.length;
  document.getElementById('stat-active').textContent =
    races.filter(r => r.status === 'active').length;
  document.getElementById('stat-finished').textContent =
    races.filter(r => r.status === 'finished').length;

  // Последние заезды
  const recentEl = document.getElementById('recent-races');
  const sorted = races.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);

  if (!sorted.length) {
    recentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏁</div>
        <div class="empty-state-text">Заездов пока нет. Создайте первый!</div>
      </div>`;
    return;
  }

  recentEl.innerHTML = sorted.map(r => `
    <div class="race-card" onclick="App.openRace('${r.id}')">
      <div class="race-card-num">${r.number || '?'}</div>
      <div class="race-card-info">
        <div class="race-card-title">${r.name || 'Без названия'}</div>
        <div class="race-card-meta">${r.category || ''} · ${r.date || ''}</div>
      </div>
      <span class="race-card-status status-${r.status || 'planned'}">
        ${{ planned: 'ПЛАН', active: 'АКТИВЕН', finished: 'ФИНИШ' }[r.status] || 'ПЛАН'}
      </span>
    </div>
  `).join('');
}

// ===== PARTICIPANTS PAGE =====
function renderParticipants() {
  const filter = App.filters.participants.toLowerCase();
  let parts = Object.values(App.participants);

  if (filter) {
    parts = parts.filter(p =>
      fullName(p).toLowerCase().includes(filter) ||
      (p.uniqueNumber || '').toLowerCase().includes(filter) ||
      (p.sportsOrganization || '').toLowerCase().includes(filter)
    );
  }

  parts.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'ru'));

  const tbody = document.getElementById('participants-tbody');
  if (!tbody) return;

  if (!parts.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">👤</div>
          <div class="empty-state-text">${filter ? 'Ничего не найдено' : 'Участников пока нет'}</div>
        </div>
      </td></tr>`;
    document.getElementById('participants-count').textContent = '0 участников';
    return;
  }

  document.getElementById('participants-count').textContent =
    `${parts.length} участник${n_suffix(parts.length)}`;

  tbody.innerHTML = parts.map(p => `
    <tr>
      <td><span class="participant-number">${p.uniqueNumber || '—'}</span></td>
      <td>
        <div style="font-weight:600">${p.lastName || ''} ${p.firstName || ''}</div>
        <div class="text-muted" style="font-size:12px">${p.middleName || ''}</div>
      </td>
      <td class="text-mono" style="font-size:12px">${p.sportsOrganization || '—'}</td>
      <td class="text-muted text-mono" style="font-size:11px">${formatDate(p.createdAt)}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditParticipant('${p.id}')" title="Редактировать">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteParticipant('${p.id}')" title="Удалить">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function n_suffix(n) {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 19) return 'ов';
  if (abs % 10 === 1) return '';
  if (abs % 10 >= 2 && abs % 10 <= 4) return 'а';
  return 'ов';
}

// ===== ADD / EDIT PARTICIPANT =====
window.openAddParticipant = function () {
  document.getElementById('participant-modal-title').textContent = 'Добавить участника';
  // Очищаем поля вручную (в модалке нет тега <form>)
  document.getElementById('participant-id').value = '';
  document.getElementById('p-unique-number').value = '';
  document.getElementById('p-last-name').value = '';
  document.getElementById('p-first-name').value = '';
  document.getElementById('p-middle-name').value = '';
  document.getElementById('p-org').value = '';
  openModal('participant-modal');
};

window.openEditParticipant = function (id) {
  const p = App.participants[id];
  if (!p) return;
  document.getElementById('participant-modal-title').textContent = 'Редактировать участника';
  document.getElementById('participant-id').value = id;
  document.getElementById('p-unique-number').value = p.uniqueNumber || '';
  document.getElementById('p-last-name').value = p.lastName || '';
  document.getElementById('p-first-name').value = p.firstName || '';
  document.getElementById('p-middle-name').value = p.middleName || '';
  document.getElementById('p-org').value = p.sportsOrganization || '';
  openModal('participant-modal');
};

window.saveParticipant = async function () {
  const id = document.getElementById('participant-id').value;
  const number = document.getElementById('p-unique-number').value.trim();
  const last = document.getElementById('p-last-name').value.trim();
  const first = document.getElementById('p-first-name').value.trim();

  if (!number || !last || !first) {
    showToast('Заполните обязательные поля: номер, фамилия, имя', 'error');
    return;
  }

  // Проверка уникальности номера
  const existing = Object.values(App.participants).find(
    p => p.uniqueNumber === number && p.id !== id
  );
  if (existing) {
    showToast(`Номер ${number} уже занят участником ${fullName(existing)}`, 'error');
    return;
  }

  const data = {
    uniqueNumber: number,
    lastName: last,
    firstName: first,
    middleName: document.getElementById('p-middle-name').value.trim(),
    sportsOrganization: document.getElementById('p-org').value.trim(),
  };

  try {
    if (id) {
      await ParticipantsDB.update(id, data);
      showToast('Участник обновлён', 'success');
    } else {
      await ParticipantsDB.add(data);
      showToast('Участник добавлен', 'success');
    }
    closeModal('participant-modal');
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
};

window.deleteParticipant = async function (id) {
  const p = App.participants[id];
  if (!p) return;
  if (!confirm(`Удалить участника ${fullName(p)}?`)) return;
  try {
    await ParticipantsDB.delete(id);
    showToast('Участник удалён', 'success');
  } catch (e) {
    showToast('Ошибка удаления: ' + e.message, 'error');
  }
};

// ===== RACE LIST PAGE =====
function renderRaceList() {
  const container = document.getElementById('race-list-container');
  if (!container) return;

  const races = Object.values(App.races).sort((a, b) =>
    (b.createdAt || 0) - (a.createdAt || 0)
  );

  if (!races.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px 20px">
        <div class="empty-state-icon">🏁</div>
        <div class="empty-state-text">Заездов нет. Создайте первый!</div>
      </div>`;
    return;
  }

  container.innerHTML = races.map(r => {
    const pCount = Object.keys(r.participants || {}).filter(
      k => r.participants[k]?.number
    ).length;
    const statusLabel = { planned: 'ПЛАН', active: 'АКТИВЕН', finished: 'ФИНИШ' }[r.status] || 'ПЛАН';

    return `
      <div class="race-card ${r.status === 'active' ? 'active-race' : ''}" onclick="App.openRace('${r.id}')">
        <div class="race-card-num">${r.number || '?'}</div>
        <div class="race-card-info">
          <div class="race-card-title">${r.name || 'Без названия'}</div>
          <div class="race-card-meta">
            ${r.category || ''} · ${r.date || ''} · участников: ${pCount}
          </div>
        </div>
        <div class="flex gap-8 items-center">
          <span class="race-card-status status-${r.status || 'planned'}">${statusLabel}</span>
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteRace('${r.id}')" title="Удалить">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== CREATE RACE =====
window.openCreateRace = function () {
  document.getElementById('race-form').reset();
  // Генерируем номер заезда
  const existing = Object.values(App.races).map(r => parseInt(r.number) || 0);
  const nextNum = existing.length ? Math.max(...existing) + 1 : 1;
  document.getElementById('r-number').value = nextNum;
  openModal('race-modal');
};

window.saveRace = async function () {
  const number = document.getElementById('r-number').value.trim();
  const name = document.getElementById('r-name').value.trim();
  const category = document.getElementById('r-category').value.trim();
  const date = document.getElementById('r-date').value;
  const slots = parseInt(document.getElementById('r-slots').value) || 8;

  if (!name) { showToast('Введите название заезда', 'error'); return; }

  // Создаём слоты участников
  const participants = {};
  const positions = slots === 8 ? STANDARD_POSITIONS_8 : STANDARD_POSITIONS_4;
  for (let i = 0; i < slots; i++) {
    participants[i] = {
      slot: i,
      number: '',
      name: '',
      organization: '',
      positions: positions[i] || [],
      moto1: '', moto2: '', moto3: '',
      total: null, place: null
    };
  }

  try {
    const id = await RacesDB.create({
      number, name, category, date,
      slots, participants, status: 'planned'
    });
    showToast('Заезд создан', 'success');
    closeModal('race-modal');
    App.openRace(id);
    navigate('races');
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
};

window.deleteRace = async function (id) {
  if (!confirm('Удалить заезд?')) return;
  try {
    await RacesDB.delete(id);
    showToast('Заезд удалён', 'success');
  } catch (e) {
    showToast('Ошибка: ' + e.message, 'error');
  }
};

// ===== OPEN RACE (RACE TABLE PAGE) =====
App.openRace = function (id) {
  App.currentRaceId = id;
  navigate('race-detail');
  renderRaceTable(id);
};

function renderRaceTable(raceId) {
  const race = App.races[raceId];
  if (!race) return;

  const page = document.getElementById('page-race-detail');
  if (!page) return;

  // Update header
  const rTitle = page.querySelector('.race-detail-title');
  const rMeta = page.querySelector('.race-detail-meta');
  if (rTitle) rTitle.textContent = race.name || 'Заезд';
  if (rMeta) rMeta.textContent = `${race.category || ''} · ${race.date || ''} · ${race.slots || 8} участников`;

  // Status button
  const statusBtn = document.getElementById('race-status-btn');
  if (statusBtn) {
    const next = { planned: 'active', active: 'finished', finished: 'planned' }[race.status] || 'active';
    const labels = { planned: '▶ Начать заезд', active: '⏹ Завершить', finished: '↺ Сбросить' };
    statusBtn.textContent = labels[race.status] || labels.planned;
    statusBtn.dataset.next = next;
  }

  const tbody = document.getElementById('race-tbody');
  if (!tbody) return;

  const slots = Object.values(race.participants || {}).sort((a, b) => a.slot - b.slot);

  // Пересчитываем места на основе текущих данных
  const computed = calcPlaces(slots);

  tbody.innerHTML = computed.map((p, i) => {
    const posHtml = (p.positions || [])
      .map(pos => `<span class="pos-badge">${pos}</span>`)
      .join('');

    const motoHtml = ['moto1', 'moto2', 'moto3'].map(m => `
      <input
        class="race-input ${p[m] ? 'has-value' : ''}"
        type="number" min="1" max="8"
        value="${p[m] || ''}"
        placeholder="—"
        ${race.status === 'finished' ? 'readonly' : ''}
        onchange="updateMoto('${raceId}', ${p.slot}, '${m}', this.value)"
        oninput="this.classList.toggle('has-value', !!this.value)"
      />
    `).join('');

    const placeHtml = p.hasData
      ? `<span class="place-badge ${placeBadgeClass(p.place)}">${p.place || '—'}</span>`
      : `<span class="text-muted">—</span>`;

    return `
      <tr>
        <td>
          <input class="number-input" type="text"
            value="${p.number || ''}"
            placeholder="№"
            ${race.status === 'finished' ? 'readonly' : ''}
            onchange="updateSlotNumber('${raceId}', ${p.slot}, this.value)"
          />
        </td>
        <td>
          <div style="font-weight:500;font-size:13px">${p.name || '<span class="text-muted">—</span>'}</div>
          <div class="text-muted" style="font-size:11px;font-family:var(--mono)">${p.organization || ''}</div>
        </td>
        <td><div class="positions-cell">${posHtml}</div></td>
        <td>${motoHtml}</td>
        <td class="text-mono text-accent" style="font-size:16px;font-weight:600">
          ${p.hasData ? (p.scoredMoto || []).reduce((a, b) => a + b, 0) : '—'}
        </td>
        <td>${placeHtml}</td>
      </tr>
    `;
  }).join('');
}

// ===== UPDATE MOTO RESULT =====
window.updateMoto = debounce(async function (raceId, slot, field, value) {
  const race = App.races[raceId];
  if (!race) return;

  const val = value.trim() === '' ? '' : String(parseInt(value, 10) || '');

  // Update local state immediately
  if (!race.participants[slot]) race.participants[slot] = {};
  race.participants[slot][field] = val;

  // Recalculate
  const slots = Object.values(race.participants).sort((a, b) => a.slot - b.slot);
  const computed = calcPlaces(slots);

  // Persist to Firebase
  const updates = {};
  computed.forEach(p => {
    updates[`races/${raceId}/participants/${p.slot}/moto1`] = p.moto1 || '';
    updates[`races/${raceId}/participants/${p.slot}/moto2`] = p.moto2 || '';
    updates[`races/${raceId}/participants/${p.slot}/moto3`] = p.moto3 || '';
    updates[`races/${raceId}/participants/${p.slot}/total`] = p.total || null;
    updates[`races/${raceId}/participants/${p.slot}/place`] = p.place || null;
  });

  // Only update the changed field + computed results
  await RacesDB.updateParticipantResult(raceId, slot, {
    [field]: val
  });

  // Update places for all participants
  computed.forEach(async p => {
    if (p.slot !== slot) {
      await RacesDB.updateParticipantResult(raceId, p.slot, {
        total: p.hasData ? p.total : null,
        place: p.hasData ? p.place : null,
      });
    } else {
      await RacesDB.updateParticipantResult(raceId, slot, {
        total: p.hasData ? p.total : null,
        place: p.hasData ? p.place : null,
      });
    }
  });

  renderRaceTable(raceId);
}, 400);

// ===== UPDATE SLOT NUMBER (поиск участника) =====
window.updateSlotNumber = debounce(async function (raceId, slot, numberVal) {
  const number = numberVal.trim();
  const participant = number
    ? Object.values(App.participants).find(p => p.uniqueNumber === number)
    : null;

  const updateData = {
    number,
    name: participant ? `${participant.lastName} ${participant.firstName}` : (number ? 'Не найден' : ''),
    organization: participant ? (participant.sportsOrganization || '') : '',
  };

  if (!participant && number) {
    showToast(`Участник № ${number} не найден в базе`, 'error');
  } else if (participant) {
    showToast(`${fullName(participant)} добавлен в заезд`, 'success');
  }

  await RacesDB.updateParticipantResult(raceId, slot, updateData);
  renderRaceTable(raceId);
}, 500);

// ===== RACE STATUS =====
window.changeRaceStatus = async function (raceId) {
  const race = App.races[raceId];
  if (!race) return;
  const next = { planned: 'active', active: 'finished', finished: 'planned' }[race.status] || 'active';
  await RacesDB.update(raceId, { status: next });
  showToast({ active: 'Заезд начат!', finished: 'Заезд завершён!', planned: 'Статус сброшен' }[next], 'success');
};

// ===== RESULTS PAGE =====
function renderResults() {
  const container = document.getElementById('results-container');
  if (!container) return;

  const finished = Object.values(App.races).filter(r => r.status === 'finished');

  if (!finished.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-text">Нет завершённых заездов</div>
      </div>`;
    return;
  }

  container.innerHTML = finished.map(race => {
    const slots = Object.values(race.participants || {}).sort((a, b) => a.slot - b.slot);
    const computed = calcPlaces(slots).filter(p => p.hasData && p.number);
    computed.sort((a, b) => (a.place || 99) - (b.place || 99));

    const rows = computed.map(p => `
      <tr>
        <td>${placeBadgeHtml(p.place)}</td>
        <td><span class="participant-number">${p.number}</span></td>
        <td style="font-weight:600">${p.name || '—'}</td>
        <td class="text-muted" style="font-size:12px">${p.organization || ''}</td>
        <td class="text-mono">${p.moto1 || '—'}</td>
        <td class="text-mono">${p.moto2 || '—'}</td>
        <td class="text-mono">${p.moto3 || '—'}</td>
        <td class="text-accent text-mono" style="font-weight:700;font-size:16px">${p.total}</td>
      </tr>
    `).join('');

    return `
      <div class="card mb-16">
        <div class="card-header">
          <span class="card-title">${race.name} · ${race.date || ''}</span>
          <div class="flex gap-8">
            <button class="btn btn-ghost btn-sm" onclick="downloadPdf('${race.id}')">PDF</button>
            <button class="btn btn-secondary btn-sm" onclick="downloadDocx('${race.id}')">DOCX</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Место</th><th>№</th><th>Участник</th><th>Организация</th>
                <th>Мото 1</th><th>Мото 2</th><th>Мото 3</th><th>Очки</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:20px">Нет данных</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

// ===== PROTOCOLS PAGE =====
function renderProtocols() {
  const container = document.getElementById('protocols-list');
  if (!container) return;

  const races = Object.values(App.races).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  container.innerHTML = races.map(r => `
    <div class="race-card">
      <div class="race-card-num">${r.number || '?'}</div>
      <div class="race-card-info">
        <div class="race-card-title">${r.name || 'Без названия'}</div>
        <div class="race-card-meta">${r.category || ''} · ${r.date || ''}</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-ghost btn-sm" onclick="downloadPdf('${r.id}')">📄 PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadDocx('${r.id}')">📝 DOCX</button>
      </div>
    </div>
  `).join('') || '<div class="empty-state"><div class="empty-state-text">Заездов нет</div></div>';
}

// ===== EXPORT =====
function getEventInfo() {
  return {
    location: 'Г. Омск, Молдова 20/1',
    date: new Date().toLocaleDateString('ru-RU'),
    headJudge: 'О.Г. Кононенко',
    secretary: 'О.В. Молдованова',
    finishJudge: 'Д.Е. Костин',
  };
}

function buildRaceExportData(raceId) {
  const race = App.races[raceId];
  if (!race) return null;
  const slots = Object.values(race.participants || {}).sort((a, b) => a.slot - b.slot);
  const computed = calcPlaces(slots);
  return {
    name: race.name,
    participants: computed.map(p => ({
      number: p.number || '',
      name: p.name || '',
      organization: p.organization || '',
      positions: p.positions || [],
      moto1: p.moto1 || '',
      moto2: p.moto2 || '',
      moto3: p.moto3 || '',
      total: p.hasData ? p.total : null,
      place: p.hasData ? p.place : null,
    }))
  };
}

window.downloadPdf = function (raceId) {
  const data = buildRaceExportData(raceId);
  if (!data) return;
  exportToPdf(data, getEventInfo());
};

window.downloadDocx = async function (raceId) {
  const data = buildRaceExportData(raceId);
  if (!data) return;
  if (!window.docx) {
    showToast('Библиотека DOCX загружается...', 'info');
    return;
  }
  await exportToDocx(data, getEventInfo());
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupModalClose();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) navigate(page);
    });
  });

  // Participant search
  const searchInput = document.getElementById('participant-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      App.filters.participants = e.target.value;
      renderParticipants();
    }, 250));
  }

  // Status connection indicator
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  if (dot) dot.className = 'status-dot offline';
  if (label) label.textContent = 'ПОДКЛЮЧЕНИЕ...';

  // Start Firebase subscriptions
  startSubscriptions();

  // Initial page
  navigate('dashboard');
});

// Expose App globally
window.App = App;