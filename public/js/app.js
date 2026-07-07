const STORAGE_KEY = 'car-ledger-data';

const MAINT_LABELS = {
  oil: '윤활유 교환',
  tire: '타이어 정비',
  brake: '브레이크',
  filter: '필터 교환',
  wash: '세차/코팅',
  etc: '기타',
};

const FUEL_LABELS = { B027: '휘발유', D047: '경유' };

const REGION_CENTERS = {
  '01': { x: 309945, y: 552095, name: '서울' },
  '02': { x: 291488, y: 529766, name: '경기' },
  '03': { x: 336182, y: 512820, name: '강원' },
  '04': { x: 327264, y: 488184, name: '충북' },
  '05': { x: 305058, y: 445662, name: '충남' },
  '06': { x: 275126, y: 401734, name: '전북' },
  '08': { x: 370164, y: 401734, name: '경북' },
  '09': { x: 360692, y: 339713, name: '경남' },
  '10': { x: 387644, y: 186792, name: '부산' },
  '11': { x: 168907, y: 152050, name: '제주' },
  '14': { x: 370164, y: 258912, name: '대구' },
  '15': { x: 285177, y: 451932, name: '인천' },
  '17': { x: 305058, y: 445662, name: '대전' },
  '18': { x: 412421, y: 258912, name: '울산' },
  '19': { x: 316230, y: 468454, name: '세종' },
  '20': { x: 275126, y: 339713, name: '전남/광주' },
};

let opinetReady = false;

let state = loadData();
let selectedStation = null;
let selectedFuelType = 'B027';
let selectedMaintCat = 'oil';
let nearbyStations = [];
let monthlyChart = null;

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.deletedIds = data.deletedIds || [];
      data.settings = data.settings || { apiKey: '' };
      return data;
    }
  } catch (_) {}
  return { entries: [], settings: { apiKey: '' }, deletedIds: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (window.Sync?.isLoggedIn()) window.Sync.schedulePush();
}

function touchEntry(entry) {
  entry.updatedAt = new Date().toISOString();
  if (!entry.createdAt) entry.createdAt = entry.updatedAt;
  return entry;
}

function applySyncData(data) {
  state.entries = data.entries || [];
  state.deletedIds = data.deletedIds || [];
  state.settings = { ...state.settings, ...(data.settings || {}) };
  if (data.settingsUpdatedAt) state.settingsUpdatedAt = data.settingsUpdatedAt;
  saveDataLocalOnly();
}

function saveDataLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderHome();
  renderHistory();
  document.getElementById('api-key').value = state.settings.apiKey || '';
}

function removeEntry(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  if (!state.deletedIds.includes(id)) state.deletedIds.push(id);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatMoney(n) {
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

function formatDate(d) {
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

async function checkOpinetReady() {
  try {
    const res = await fetch('/api/opinet/status');
    const data = await res.json();
    opinetReady = Boolean(state.settings.apiKey) || data.configured;
    const hint = document.getElementById('fuel-api-hint');
    if (hint) {
      if (opinetReady) {
        hint.textContent = '📍 내 주변 또는 지역 검색 후 이름으로 필터할 수 있습니다.';
      } else {
        hint.innerHTML = '⚠️ <a href="https://www.opinet.co.kr/user/custapi/openApiNew.do" target="_blank" rel="noopener">오피넷</a> API 키를 설정 탭에 입력해야 검색이 됩니다.';
      }
    }
    return opinetReady;
  } catch {
    opinetReady = Boolean(state.settings.apiKey);
    return opinetReady;
  }
}

async function opinetFetch(endpoint, params = {}) {
  const key = state.settings.apiKey;
  if (!key && !opinetReady) {
    const ready = await checkOpinetReady();
    if (!ready) throw new Error('오피넷 API 키를 설정에서 입력해주세요.');
  }

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  if (key) qs.set('certkey', key);

  const res = await fetch(`/api/opinet/${endpoint}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API 요청 실패');
  return data;
}

function parseOilList(data) {
  if (!data) return [];
  const oil = data.RESULT?.OIL ?? data.OIL;
  if (!oil) return [];
  return Array.isArray(oil) ? oil : [oil];
}

function mergeStations(...lists) {
  const map = new Map();
  lists.flat().forEach((s) => {
    if (s?.UNI_ID) map.set(s.UNI_ID, s);
  });
  return Array.from(map.values());
}

function parsePrices(data) {
  const prices = { B027: null, D047: null };
  const oil = data.RESULT?.OIL || data.OIL;
  if (!oil) return prices;

  const list = oil.OIL_PRICE
    ? Array.isArray(oil.OIL_PRICE) ? oil.OIL_PRICE : [oil.OIL_PRICE]
    : [];

  list.forEach((p) => {
    if (p.PRODCD === 'B027') prices.B027 = Number(p.PRICE);
    if (p.PRODCD === 'D047') prices.D047 = Number(p.PRICE);
  });
  return prices;
}

// --- Navigation ---

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (page) {
    page.classList.add('active');
    document.getElementById('page-title').textContent = page.dataset.title;
    document.getElementById('page-sub').textContent = page.dataset.sub;
  }
  if (nav) nav.classList.add('active');

  if (pageId === 'home') renderHome();
  if (pageId === 'history') renderHistory();
  if (pageId === 'fuel') checkOpinetReady();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

// --- Station search ---

async function loadStationsAround(x, y, radius = 5000) {
  const data = await opinetFetch('aroundAll', {
    x, y, radius, prodcd: 'B027', sort: 1,
  });
  return parseOilList(data);
}

async function searchNearbyStations() {
  if (!await checkOpinetReady()) return;

  if (!navigator.geolocation) {
    showToast('위치 정보를 사용할 수 없습니다. 지역 검색을 이용하세요.', true);
    return;
  }

  showToast('주변 주유소를 검색 중...');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { x, y } = wgs84ToKatec(pos.coords.latitude, pos.coords.longitude);
        nearbyStations = await loadStationsAround(x, y, 5000);
        document.getElementById('region-select').value = '';
        document.getElementById('station-search').value = '';
        renderStationResults('');
        if (nearbyStations.length === 0) {
          showToast('주변에 주유소가 없습니다. 지역 검색을 시도해보세요.', true);
        } else {
          showToast(`${nearbyStations.length}개 주유소를 찾았습니다.`);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    },
    (err) => {
      const msgs = {
        1: '위치 권한이 거부되었습니다. 지역 검색을 이용하세요.',
        2: '위치를 확인할 수 없습니다. 지역 검색을 이용하세요.',
        3: '위치 요청 시간이 초과되었습니다.',
      };
      showToast(msgs[err.code] || '위치 권한이 필요합니다.', true);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

async function searchByRegion() {
  const area = document.getElementById('region-select').value;

  if (!area) {
    nearbyStations = [];
    renderStationResults('');
    return;
  }

  if (!await checkOpinetReady()) return;

  const center = REGION_CENTERS[area];
  showToast(`${center.name} 주유소 목록 불러오는 중...`);

  try {
    const data = await opinetFetch('lowTop10', { area, prodcd: 'B027', cnt: 20 });
    nearbyStations = parseOilList(data).filter((s) => s.UNI_ID && s.OS_NM);
    document.getElementById('station-search').value = '';
    renderStationResults('');

    if (nearbyStations.length === 0) {
      showToast('해당 지역 주유소를 찾지 못했습니다.', true);
    } else {
      showToast(`${nearbyStations.length}개 주유소 — 목록에서 선택하세요.`);
    }
  } catch (err) {
    nearbyStations = [];
    renderStationResults('');
    showToast(err.message, true);
  }
}

function renderStationResults(query = '') {
  const container = document.getElementById('station-results');
  const countEl = document.getElementById('station-count');
  const q = query.trim().toLowerCase();
  const area = document.getElementById('region-select').value;

  const filtered = nearbyStations.filter((s) => {
    if (!q) return true;
    const name = (s.OS_NM || '').toLowerCase();
    const addr = (s.NEW_ADR || s.VAN_ADR || '').toLowerCase();
    return name.includes(q) || addr.includes(q);
  });

  if (countEl) {
    countEl.textContent = filtered.length > 0 ? `(${filtered.length}곳)` : '';
  }

  if (filtered.length === 0) {
    const emptyMsg = area
      ? (q ? '검색어와 일치하는 주유소가 없습니다.' : '주유소 목록을 불러오지 못했습니다.')
      : '지역을 선택하면 주유소 목록이 표시됩니다.';
    container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
    return;
  }

  container.innerHTML = filtered.map((s) => {
    const addr = s.NEW_ADR || s.VAN_ADR || '';
    const price = s.PRICE ? `${Number(s.PRICE).toLocaleString()}원/L` : '';
    const dist = s.DISTANCE ? `${Math.round(s.DISTANCE)}m` : '';
    return `
      <button type="button" class="station-item" data-id="${s.UNI_ID}">
        <div class="station-item-top">
          <div class="station-item-name">${esc(s.OS_NM)}</div>
          ${price ? `<div class="station-item-price">${price}</div>` : ''}
        </div>
        <div class="station-item-meta">${esc(addr)}${dist ? ` · ${dist}` : ''}</div>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.station-item').forEach((el) => {
    el.addEventListener('click', () => selectStation(el.dataset.id));
  });
}

async function selectStation(id) {
  try {
    showToast('유가 정보를 불러오는 중...');
    const data = await opinetFetch('detailById', { id });
    const raw = data.RESULT?.OIL || data.OIL;
    const oil = Array.isArray(raw) ? raw[0] : raw;
    if (!oil?.UNI_ID) throw new Error('주유소 정보를 찾을 수 없습니다.');

    const prices = parsePrices({ RESULT: { OIL: oil } });
    if (!prices.B027 && oil.PRICE) prices.B027 = Number(oil.PRICE);

    selectedStation = {
      id: oil.UNI_ID,
      name: oil.OS_NM,
      addr: oil.NEW_ADR || oil.VAN_ADR || '',
      prices,
    };

    document.getElementById('sel-station-name').textContent = selectedStation.name;
    document.getElementById('sel-station-addr').textContent = selectedStation.addr;
    document.getElementById('price-gasoline').textContent =
      prices.B027 ? prices.B027.toLocaleString() + '원/L' : '정보없음';
    document.getElementById('price-diesel').textContent =
      prices.D047 ? prices.D047.toLocaleString() + '원/L' : '정보없음';

    document.getElementById('selected-station').classList.remove('hidden');
    updateFuelCalc();
    showToast('주유소가 선택되었습니다.');
  } catch (err) {
    showToast(err.message, true);
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.getElementById('btn-nearby').addEventListener('click', searchNearbyStations);
document.getElementById('region-select').addEventListener('change', searchByRegion);

let searchTimer;
document.getElementById('station-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderStationResults(e.target.value), 150);
});

// --- Fuel type chips ---

document.querySelectorAll('#fuel-type-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#fuel-type-chips .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    selectedFuelType = chip.dataset.type;
    updateFuelCalc();
  });
});

function updateFuelCalc() {
  const liters = parseFloat(document.getElementById('fuel-liters').value) || 0;
  const price = selectedStation?.prices?.[selectedFuelType] || 0;
  const amount = Math.round(liters * price);
  document.getElementById('fuel-amount').textContent = formatMoney(amount);
}

document.getElementById('fuel-liters').addEventListener('input', updateFuelCalc);

document.getElementById('btn-save-fuel').addEventListener('click', () => {
  const date = document.getElementById('fuel-date').value;
  const liters = parseFloat(document.getElementById('fuel-liters').value);
  const distance = parseFloat(document.getElementById('fuel-distance').value) || null;

  if (!date) return showToast('날짜를 선택해주세요.', true);
  if (!selectedStation) return showToast('주유소를 선택해주세요.', true);
  if (!liters || liters <= 0) return showToast('주유량을 입력해주세요.', true);

  const pricePerLiter = selectedStation.prices[selectedFuelType];
  if (!pricePerLiter) return showToast('선택한 유종의 유가 정보가 없습니다.', true);

  const amount = Math.round(liters * pricePerLiter);

  state.entries.unshift(touchEntry({
    id: uid(),
    type: 'fuel',
    date,
    stationId: selectedStation.id,
    stationName: selectedStation.name,
    fuelType: selectedFuelType,
    liters,
    pricePerLiter,
    amount,
    distance,
  }));

  if (distance) upsertDistance(date, distance);

  saveData();
  resetFuelForm();
  showToast('주유 기록이 저장되었습니다.');
  renderHome();
});

function resetFuelForm() {
  document.getElementById('fuel-liters').value = '';
  document.getElementById('fuel-distance').value = '';
  document.getElementById('fuel-amount').textContent = '0원';
}

// --- Maintenance ---

document.querySelectorAll('#maint-category-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#maint-category-chips .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    selectedMaintCat = chip.dataset.cat;
  });
});

document.getElementById('btn-save-maint').addEventListener('click', () => {
  const date = document.getElementById('maint-date').value;
  const desc = document.getElementById('maint-desc').value.trim();
  const amount = parseFloat(document.getElementById('maint-amount').value);
  const distance = parseFloat(document.getElementById('maint-distance').value) || null;

  if (!date) return showToast('날짜를 선택해주세요.', true);
  if (!amount || amount <= 0) return showToast('금액을 입력해주세요.', true);

  state.entries.unshift(touchEntry({
    id: uid(),
    type: 'maintenance',
    date,
    category: selectedMaintCat,
    description: desc || MAINT_LABELS[selectedMaintCat],
    amount,
    distance,
  }));

  if (distance) upsertDistance(date, distance);

  saveData();
  document.getElementById('maint-desc').value = '';
  document.getElementById('maint-amount').value = '';
  document.getElementById('maint-distance').value = '';
  showToast('정비 기록이 저장되었습니다.');
  renderHome();
});

function upsertDistance(date, km) {
  const existing = state.entries.find((e) => e.type === 'distance' && e.date === date);
  if (existing) {
    existing.km = km;
    touchEntry(existing);
  } else {
    state.entries.push(touchEntry({
      id: uid(),
      type: 'distance',
      date,
      km,
    }));
  }
}

// --- Render ---

function getMonthEntries(month) {
  return state.entries.filter((e) => e.type !== 'distance' && e.date.startsWith(month));
}

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function getMonthlyExpense(month) {
  const entries = getMonthEntries(month);
  const fuel = entries.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.amount, 0);
  const maint = entries.filter((e) => e.type === 'maintenance').reduce((s, e) => s + e.amount, 0);
  return { fuel, maint, total: fuel + maint };
}

function renderMonthlyChart() {
  const months = getLast12Months();
  const expenses = months.map(getMonthlyExpense);
  const yearTotal = expenses.reduce((s, e) => s + e.total, 0);

  const yearEl = document.getElementById('chart-year-total');
  if (yearEl) {
    yearEl.innerHTML = yearTotal > 0
      ? `12개월 합계 <strong>${formatMoney(yearTotal)}</strong>`
      : '기록이 쌓이면 월별 지출이 표시됩니다.';
  }

  const canvas = document.getElementById('monthly-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = months.map((m) => {
    const [y, mm] = m.split('-');
    const isCurrent = m === currentMonth();
    return isCurrent ? `${parseInt(mm, 10)}월` : `${y.slice(2)}.${parseInt(mm, 10)}`;
  });

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '주유',
          data: expenses.map((e) => e.fuel),
          backgroundColor: 'rgba(245, 158, 11, 0.9)',
          borderRadius: { topLeft: 0, topRight: 0 },
          borderSkipped: false,
        },
        {
          label: '정비',
          data: expenses.map((e) => e.maint),
          backgroundColor: 'rgba(16, 185, 129, 0.9)',
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 12, family: "'Noto Sans KR', sans-serif" } },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          padding: 10,
          titleFont: { size: 13, family: "'Noto Sans KR', sans-serif" },
          bodyFont: { size: 12, family: "'Noto Sans KR', sans-serif" },
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`;
            },
            footer(items) {
              const sum = items.reduce((s, i) => s + i.parsed.y, 0);
              return sum > 0 ? `합계: ${formatMoney(sum)}` : '';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 10, family: "'Noto Sans KR', sans-serif" }, maxRotation: 45, minRotation: 0 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            font: { size: 10, family: "'Noto Sans KR', sans-serif" },
            callback(value) {
              if (value >= 10000) return `${Math.round(value / 10000)}만`;
              if (value >= 1000) return `${Math.round(value / 1000)}천`;
              return value;
            },
          },
        },
      },
    },
  });
}

function getMonthDistance(month) {
  const distanceEntries = state.entries.filter(
    (e) => e.type === 'distance' && e.date.startsWith(month)
  );
  const fromDedicated = distanceEntries.reduce((s, e) => s + e.km, 0);
  const datesWithDedicated = new Set(distanceEntries.map((e) => e.date));
  const fromOther = state.entries
    .filter(
      (e) =>
        e.type !== 'distance' &&
        e.distance &&
        e.date.startsWith(month) &&
        !datesWithDedicated.has(e.date)
    )
    .reduce((s, e) => s + e.distance, 0);
  return fromDedicated + fromOther;
}

function renderHome() {
  const month = currentMonth();
  const entries = getMonthEntries(month);

  const fuelTotal = entries.filter((e) => e.type === 'fuel').reduce((s, e) => s + e.amount, 0);
  const maintTotal = entries.filter((e) => e.type === 'maintenance').reduce((s, e) => s + e.amount, 0);
  const distTotal = getMonthDistance(month);

  document.getElementById('sum-fuel').textContent = formatMoney(fuelTotal);
  document.getElementById('sum-maint').textContent = formatMoney(maintTotal);
  document.getElementById('sum-dist').textContent = distTotal.toLocaleString() + ' km';
  document.getElementById('sum-total').textContent = formatMoney(fuelTotal + maintTotal);

  renderMonthlyChart();

  const recent = state.entries
    .filter((e) => e.type !== 'distance')
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 5);

  const list = document.getElementById('recent-list');
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state">아직 기록이 없습니다.<br>주유 또는 정비 탭에서 추가해보세요.</div>';
    return;
  }

  list.innerHTML = recent.map((e) => entryHtml(e, false)).join('');
  bindDeleteButtons(list);
}

function renderHistory() {
  const month = document.getElementById('history-month').value || currentMonth();
  const filter = document.getElementById('history-filter').value;

  let entries = state.entries
    .filter((e) => e.type !== 'distance' && e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (filter !== 'all') entries = entries.filter((e) => e.type === filter);

  const container = document.getElementById('history-list');

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">해당 기간의 기록이 없습니다.</div>';
    return;
  }

  const grouped = {};
  entries.forEach((e) => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  const distMap = {};
  state.entries.filter((e) => e.type === 'distance' && e.date.startsWith(month)).forEach((e) => {
    distMap[e.date] = e.km;
  });

  container.innerHTML = Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map((date) => {
    const dist = distMap[date] || grouped[date].find((e) => e.distance)?.distance;
    const distLabel = dist ? `<span style="color:var(--dist);font-size:12px;margin-left:8px">${dist}km</span>` : '';
    return `
      <div class="history-date">${formatDate(date)}${distLabel}</div>
      ${grouped[date].map((e) => entryHtml(e, true)).join('')}
    `;
  }).join('');

  bindDeleteButtons(container);
}

function entryHtml(e, showDelete) {
  if (e.type === 'fuel') {
    return `
      <div class="entry-item" data-id="${e.id}">
        <div class="entry-left">
          <span class="entry-type fuel">주유</span>
          <div class="entry-title">${esc(e.stationName)}</div>
          <div class="entry-detail">${FUEL_LABELS[e.fuelType]} ${e.liters}L · ${e.pricePerLiter.toLocaleString()}원/L${e.distance ? ' · ' + e.distance + 'km' : ''}</div>
        </div>
        <div class="entry-amount">${formatMoney(e.amount)}</div>
        ${showDelete ? `<button class="entry-delete" data-id="${e.id}">×</button>` : ''}
      </div>
    `;
  }

  return `
    <div class="entry-item" data-id="${e.id}">
      <div class="entry-left">
        <span class="entry-type maintenance">정비</span>
        <div class="entry-title">${esc(e.description)}</div>
        <div class="entry-detail">${MAINT_LABELS[e.category] || e.category}${e.distance ? ' · ' + e.distance + 'km' : ''}</div>
      </div>
      <div class="entry-amount">${formatMoney(e.amount)}</div>
      ${showDelete ? `<button class="entry-delete" data-id="${e.id}">×</button>` : ''}
    </div>
  `;
}

function bindDeleteButtons(container) {
  container.querySelectorAll('.entry-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('이 기록을 삭제할까요?')) return;
      removeEntry(btn.dataset.id);
      saveData();
      renderHistory();
      renderHome();
      showToast('삭제되었습니다.');
    });
  });
}

document.getElementById('history-month').addEventListener('change', renderHistory);
document.getElementById('history-filter').addEventListener('change', renderHistory);

// --- Settings ---

document.getElementById('api-key').value = state.settings.apiKey || '';

document.getElementById('btn-save-key').addEventListener('click', async () => {
  state.settings.apiKey = document.getElementById('api-key').value.trim();
  state.settingsUpdatedAt = new Date().toISOString();
  saveData();
  await checkOpinetReady();
  showToast('API 키가 저장되었습니다.');
});

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `car-ledger-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('데이터를보냈습니다.');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('모든 기록을 삭제합니다. 계속할까요?')) return;
  const allIds = state.entries.map((e) => e.id);
  state.entries = [];
  state.deletedIds = [...new Set([...(state.deletedIds || []), ...allIds])];
  saveData();
  renderAll();
  showToast('모든 기록이 삭제되었습니다.');
});

window.CarLedger = { state, applySyncData, renderAll, showToast };

// --- Init ---

document.getElementById('fuel-date').value = today();
document.getElementById('maint-date').value = today();
document.getElementById('history-month').value = currentMonth();
document.getElementById('api-key').value = state.settings.apiKey || '';
renderHome();
checkOpinetReady();

window.addEventListener('load', () => {
  if (typeof initKatecProj === 'function') initKatecProj();
  if (window.Sync) window.Sync.init();
});