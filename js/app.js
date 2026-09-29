/**
 * app.js — Dashboard Pelacak Kebiasaan Harian
 * Stack: Vanilla JS + Chart.js + Tailwind CSS
 * Data source: data/habits.json
 */

// ─── State ────────────────────────────────────────────────────────────────────
let habitData   = null;   // raw JSON
let filterState = { period: 14, category: 'all', habitId: 'all' };

// Chart instances (kept so we can destroy/re-render on filter change)
let lineChartInst   = null;
let donutChartInst  = null;
let barChartInst    = null;
let weeklyChartInst = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  fetch('data/habits.json')
    .then(r => r.json())
    .then(data => {
      habitData = data;
      initUser(data.user);
      populateHabitFilter(data.habits);
      render();
      bindFilters();
    })
    .catch(err => console.error('Gagal memuat data:', err));
});

// ─── Init helpers ─────────────────────────────────────────────────────────────
function initDate() {
  const el = document.getElementById('currentDate');
  el.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function initUser(user) {
  document.getElementById('userAvatar').textContent = user.avatar;
  document.getElementById('userName').textContent   = user.name;
}

function populateHabitFilter(habits) {
  const sel = document.getElementById('filterHabit');
  habits.forEach(h => {
    const opt = document.createElement('option');
    opt.value       = h.id;
    opt.textContent = `${h.icon} ${h.name}`;
    sel.appendChild(opt);
  });
}

// ─── Filter bindings ──────────────────────────────────────────────────────────
function bindFilters() {
  document.getElementById('filterPeriod').addEventListener('change', e => {
    filterState.period = Number(e.target.value);
    render();
  });
  document.getElementById('filterCategory').addEventListener('change', e => {
    filterState.category = e.target.value;
    render();
  });
  document.getElementById('filterHabit').addEventListener('change', e => {
    filterState.habitId = e.target.value === 'all' ? 'all' : Number(e.target.value);
    render();
  });
  document.getElementById('resetFilter').addEventListener('click', () => {
    filterState = { period: 14, category: 'all', habitId: 'all' };
    document.getElementById('filterPeriod').value   = '14';
    document.getElementById('filterCategory').value = 'all';
    document.getElementById('filterHabit').value    = 'all';
    render();
  });
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/** Returns the last N calendar dates (YYYY-MM-DD) ending today (or last log date). */
function getDateRange(n) {
  const dates = [];
  const allDates = habitData.logs.map(l => l.date).sort();
  const lastDate = allDates[allDates.length - 1] || new Date().toISOString().slice(0, 10);
  const end = new Date(lastDate);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Filter logs by current filterState. */
function getFilteredLogs() {
  const dates = getDateRange(filterState.period);
  return habitData.logs.filter(log => {
    const inPeriod   = dates.includes(log.date);
    const habit      = habitData.habits.find(h => h.id === log.habitId);
    const inCategory = filterState.category === 'all' || habit?.category === filterState.category;
    const inHabit    = filterState.habitId === 'all' || log.habitId === filterState.habitId;
    return inPeriod && inCategory && inHabit;
  });
}

/** Filter habits by category (and habit) filter. */
function getFilteredHabits() {
  return habitData.habits.filter(h => {
    const inCategory = filterState.category === 'all' || h.category === filterState.category;
    const inHabit    = filterState.habitId === 'all' || h.id === filterState.habitId;
    return inCategory && inHabit;
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  const logs   = getFilteredLogs();
  const habits = getFilteredHabits();
  const dates  = getDateRange(filterState.period);

  renderKPIs(logs, habits, dates);
  renderLineChart(logs, habits, dates);
  renderDonutChart(logs, habits);
  renderBarChart(logs, habits, dates);
  renderWeeklyChart(logs, habits, dates);
  renderTable(logs, habits, dates);
  renderRecentLogs(logs, habits);
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function renderKPIs(logs, habits, dates) {
  const grid = document.getElementById('kpiGrid');

  const totalCompleted = logs.filter(l => l.completed).length;
  const totalPossible  = habits.length * dates.length;
  const overallRate    = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  // Perfect days: days where ALL filtered habits were completed
  const perfectDays = dates.filter(date => {
    const dayLogs = logs.filter(l => l.date === date);
    return habits.length > 0 && dayLogs.filter(l => l.completed).length === habits.length;
  }).length;

  // Best habit
  let bestHabit = { name: '—', rate: 0, icon: '🏅' };
  habits.forEach(h => {
    const hLogs   = logs.filter(l => l.habitId === h.id);
    const hDone   = hLogs.filter(l => l.completed).length;
    const hRate   = dates.length > 0 ? Math.round((hDone / dates.length) * 100) : 0;
    if (hRate > bestHabit.rate) bestHabit = { name: h.name, rate: hRate, icon: h.icon };
  });

  // Current streak (consecutive days ending at last date where ≥1 habit completed)
  const streak = calcStreak(logs, dates);

  const kpis = [
    {
      icon: '🎯', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
      value: `${overallRate}%`,
      label: 'Tingkat Keberhasilan',
      trend: overallRate >= 75 ? '↑ Luar biasa!' : overallRate >= 50 ? '→ Cukup baik' : '↓ Perlu ditingkatkan',
      trendClass: overallRate >= 75 ? 'up' : overallRate >= 50 ? 'flat' : 'down'
    },
    {
      icon: '✅', iconBg: 'bg-green-100', iconColor: 'text-green-600',
      value: totalCompleted,
      label: 'Total Kebiasaan Selesai',
      trend: `dari ${totalPossible} sesi`,
      trendClass: 'flat'
    },
    {
      icon: '🌟', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600',
      value: perfectDays,
      label: 'Hari Sempurna',
      trend: `dari ${dates.length} hari`,
      trendClass: perfectDays > 0 ? 'up' : 'flat'
    },
    {
      icon: '🔥', iconBg: 'bg-red-100', iconColor: 'text-red-600',
      value: streak,
      label: 'Streak Saat Ini (hari)',
      trend: streak >= 7 ? '↑ Pertahankan!' : streak >= 3 ? '→ Bagus' : '↓ Mulai lagi!',
      trendClass: streak >= 7 ? 'up' : streak >= 3 ? 'flat' : 'down'
    }
  ];

  grid.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="flex items-center justify-between">
        <div class="kpi-icon ${k.iconBg} ${k.iconColor}">${k.icon}</div>
      </div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-trend ${k.trendClass}">${k.trend}</div>
    </div>
  `).join('');
}

function calcStreak(logs, dates) {
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const dayLogs = logs.filter(l => l.date === dates[i] && l.completed);
    if (dayLogs.length > 0) streak++;
    else break;
  }
  return streak;
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function renderLineChart(logs, habits, dates) {
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChartInst) lineChartInst.destroy();

  const data = dates.map(date => {
    const dayLogs  = logs.filter(l => l.date === date);
    const done     = dayLogs.filter(l => l.completed).length;
    const possible = habits.length;
    return possible > 0 ? Math.round((done / possible) * 100) : 0;
  });

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => formatDateShort(d)),
      datasets: [{
        label: 'Tingkat Penyelesaian (%)',
        data,
        fill: true,
        tension: 0.4,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function renderDonutChart(logs, habits) {
  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChartInst) donutChartInst.destroy();

  const categories = [...new Set(habits.map(h => h.category))];
  const catColors  = { Kesehatan: '#3b82f6', Edukasi: '#8b5cf6', Mental: '#10b981' };

  const catData = categories.map(cat => {
    const catHabits = habits.filter(h => h.category === cat);
    return logs.filter(l => l.completed && catHabits.find(h => h.id === l.habitId)).length;
  });

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: catData,
        backgroundColor: categories.map(c => catColors[c] || '#94a3b8'),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
        tooltip: tooltipStyle()
      }
    }
  });
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function renderBarChart(logs, habits, dates) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChartInst) barChartInst.destroy();

  const labels   = habits.map(h => h.icon + ' ' + h.name);
  const done     = habits.map(h => logs.filter(l => l.habitId === h.id && l.completed).length);
  const possible = habits.map(() => dates.length);

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Selesai',
          data: done,
          backgroundColor: habits.map(h => h.color + 'cc'),
          borderColor: habits.map(h => h.color),
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Target Hari',
          data: possible,
          backgroundColor: '#f3f4f6',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { font: { size: 11 }, boxWidth: 12 } }, tooltip: tooltipStyle() },
      scales: {
        y: { ticks: { font: { size: 11 }, stepSize: 1 }, grid: { color: '#f3f4f6' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// ─── Weekly Consistency Chart ─────────────────────────────────────────────────
function renderWeeklyChart(logs, habits, dates) {
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  if (weeklyChartInst) weeklyChartInst.destroy();

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const dayCounts    = new Array(7).fill(0);
  const dayPossibles = new Array(7).fill(0);

  dates.forEach(date => {
    const dow    = new Date(date).getDay();
    const done   = logs.filter(l => l.date === date && l.completed).length;
    dayCounts[dow]    += done;
    dayPossibles[dow] += habits.length;
  });

  const rates = dayCounts.map((c, i) =>
    dayPossibles[i] > 0 ? Math.round((c / dayPossibles[i]) * 100) : 0
  );

  weeklyChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayNames,
      datasets: [{
        label: 'Tingkat Penyelesaian (%)',
        data: rates,
        backgroundColor: rates.map(r =>
          r >= 80 ? '#10b981cc' : r >= 50 ? '#f59e0bcc' : '#ef4444cc'
        ),
        borderRadius: 8,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipStyle() },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        x: { ticks: { font: { size: 12 } }, grid: { display: false } }
      }
    }
  });
}

// ─── Habit Detail Table ───────────────────────────────────────────────────────
function renderTable(logs, habits, dates) {
  const tbody = document.getElementById('habitTableBody');

  if (habits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400 text-sm">Tidak ada data untuk filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = habits.map(h => {
    const hLogs   = logs.filter(l => l.habitId === h.id);
    const done    = hLogs.filter(l => l.completed).length;
    const total   = dates.length;
    const rate    = total > 0 ? Math.round((done / total) * 100) : 0;

    let statusClass = 'badge-red';
    let statusText  = 'Perlu Perhatian';
    if (rate >= 80) { statusClass = 'badge-green';  statusText = 'Sangat Baik'; }
    else if (rate >= 50) { statusClass = 'badge-yellow'; statusText = 'Cukup Baik'; }

    return `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <span class="text-base">${h.icon}</span>
            <span class="font-medium text-gray-700">${h.name}</span>
          </div>
        </td>
        <td>
          <span class="badge" style="background:${h.color}22;color:${h.color}">${h.category}</span>
        </td>
        <td class="text-center font-semibold text-gray-800">${done}</td>
        <td class="text-center text-gray-500">${total}</td>
        <td class="text-center font-bold" style="color:${h.color}">${rate}%</td>
        <td>
          <div class="flex items-center gap-2">
            <div class="progress-track">
              <div class="progress-fill" style="width:${rate}%;background:${h.color}"></div>
            </div>
            <span class="text-xs text-gray-400 w-8 text-right">${rate}%</span>
          </div>
        </td>
        <td class="text-center"><span class="badge ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

// ─── Recent Logs ──────────────────────────────────────────────────────────────
function renderRecentLogs(logs, habits) {
  const container = document.getElementById('recentLogs');
  const recent    = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);

  if (recent.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">Tidak ada log untuk filter ini.</p>`;
    return;
  }

  container.innerHTML = recent.map(log => {
    const habit = habits.find(h => h.id === log.habitId);
    if (!habit) return '';
    const statusText  = log.completed ? '✅ Selesai' : '❌ Belum selesai';
    const statusColor = log.completed ? '#10b981' : '#ef4444';
    return `
      <div class="log-item">
        <div class="log-dot" style="background:${habit.color}"></div>
        <span class="text-gray-500 w-24 flex-shrink-0">${formatDateShort(log.date)}</span>
        <span class="text-base">${habit.icon}</span>
        <span class="font-medium text-gray-700 flex-1">${habit.name}</span>
        <span class="text-gray-400 text-xs">${log.value} ${habit.unit}</span>
        <span class="text-xs font-semibold" style="color:${statusColor}">${statusText}</span>
      </div>
    `;
  }).join('');
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function tooltipStyle() {
  return {
    backgroundColor: '#1f2328',
    titleColor: '#e5e7eb',
    bodyColor: '#d1d5db',
    padding: 10,
    cornerRadius: 8,
    titleFont: { size: 11 },
    bodyFont: { size: 11 }
  };
}
