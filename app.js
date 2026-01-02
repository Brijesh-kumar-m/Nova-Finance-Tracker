/* --- Data Store --- */
const store = {
  transactions: JSON.parse(localStorage.getItem('nova_transactions')) || [],

  addTransaction(t) {
    this.transactions.push(t);
    this.save();
    updateUI();
  },

  deleteTransaction(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.save();
    updateUI();
  },

  updateTransaction(id, updatedData) {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      this.transactions[index] = { ...this.transactions[index], ...updatedData };
      this.save();
      updateUI();
    }
  },

  save() {
    localStorage.setItem('nova_transactions', JSON.stringify(this.transactions));
  }
};

/* --- Budget Store --- */
const budgetStore = {
  budgets: JSON.parse(localStorage.getItem('nova_budgets')) || {},

  setBudget(category, limit) {
    this.budgets[category] = limit;
    this.save();
    updateUI();
  },

  save() {
    localStorage.setItem('nova_budgets', JSON.stringify(this.budgets));
  }
};

/* --- DOM Elements --- */
const els = {
  input: document.getElementById('transaction-input'),
  sendBtn: document.getElementById('send-btn'),
  chatMessages: document.getElementById('chat-messages'),
  views: document.querySelectorAll('.view'),
  navItems: document.querySelectorAll('.nav-links li'),
  summary: {
    income: document.querySelector('.income'),
    expense: document.querySelector('.expense'),
    balance: document.querySelector('.balance')
  },
  lists: {
    history: document.getElementById('transaction-list')
  },
  periodSelect: document.getElementById('chart-period-select'),

  // Auth
  loginOverlay: document.getElementById('login-overlay'),
  pinInput: document.getElementById('pin-input'),
  loginBtn: document.getElementById('login-btn'),
  loginError: document.getElementById('login-error'),

  // Voice
  micBtn: document.getElementById('mic-btn'),

  // AI
  aiInsights: document.getElementById('ai-insights'),

  // Edit Modal
  editModal: document.getElementById('edit-modal'),
  editCategory: document.getElementById('edit-category'),
  editAmount: document.getElementById('edit-amount'),
  editType: document.getElementById('edit-type'),
  saveEditBtn: document.getElementById('save-edit-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),

  // Budget Modal
  budgetModal: document.getElementById('budget-modal'),
  budgetCategory: document.getElementById('budget-category'),
  budgetLimit: document.getElementById('budget-limit'),
  saveBudgetBtn: document.getElementById('save-budget-btn'),
  cancelBudgetBtn: document.getElementById('cancel-budget-btn'),
  budgetContainer: document.getElementById('budget-container'),

  // Change PIN Modal
  pinModal: document.getElementById('pin-modal'),
  oldPin: document.getElementById('old-pin'),
  newPin: document.getElementById('new-pin'),
  confirmPin: document.getElementById('confirm-new-pin'),
  savePinBtn: document.getElementById('save-pin-btn'),
  cancelPinBtn: document.getElementById('cancel-pin-btn')
};

/* --- State --- */
let currentEditId = null;
let OWNER_PIN = localStorage.getItem('nova_pin') || '1234'; // Dynamic PIN

/* --- Charts Instances --- */
// (Removed global variables - we use Chart.getChart(canvas) for robustness)

/* --- Initialization --- */
document.addEventListener('DOMContentLoaded', () => {
  // Auth Check
  checkAuth();

  // Recurring Check
  checkRecurring();

  // Core Event Listeners
  els.sendBtn.addEventListener('click', handleInput);
  els.input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleInput();
  });

  els.periodSelect.addEventListener('change', updateCharts);

  // Auth Listeners
  els.loginBtn.addEventListener('click', handleLogin);
  els.pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Edit Modal Listeners
  els.saveEditBtn.addEventListener('click', saveEdit);
  els.cancelEditBtn.addEventListener('click', closeEditModal);

  // PIN Modal Listeners
  els.savePinBtn.addEventListener('click', savePIN);
  els.cancelPinBtn.addEventListener('click', () => els.pinModal.style.display = 'none');

  // Voice Listener
  els.micBtn.addEventListener('click', toggleVoiceInput);

  // Budget Modal Listeners
  els.saveBudgetBtn.addEventListener('click', saveBudget);
  els.cancelBudgetBtn.addEventListener('click', () => els.budgetModal.style.display = 'none');

  // Initial UI Update (Run LAST to ensure listeners are valid even if this fails)
  try {
    updateUI();
  } catch (err) {
    console.error("UI Update failed:", err);
  }
});

/* --- Voice Input (Web Speech API) --- */
function toggleVoiceInput() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Voice input is not supported in this browser. Try Chrome/Edge.");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (els.micBtn.classList.contains('listening')) {
    // Manual Stop (if we had a persistent listener, but here we just toggle UI)
    return;
  }

  recognition.start();

  recognition.onstart = () => {
    els.micBtn.classList.add('listening');
    els.input.placeholder = "Listening...";
  };

  recognition.onend = () => {
    els.micBtn.classList.remove('listening');
    els.input.placeholder = "Type or say 'Spent 500 on Food'...";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    els.input.value = transcript;

    // Auto-send if it looks like a complete command
    setTimeout(() => handleInput(), 500);
  };

  recognition.onerror = (event) => {
    console.error("Speech verification error", event.error);
    els.micBtn.classList.remove('listening');
  };
}

/* --- Auth Logic --- */
function checkAuth() {
  // Determine if already logged in this session? 
  // For simplicity, we ask for PIN on every reload, or check sessionStorage
  if (sessionStorage.getItem('nova_auth') === 'true') {
    els.loginOverlay.classList.remove('active-overlay');
  }
}

function handleLogin() {
  const pin = els.pinInput.value;
  // Strict string comparison
  if (pin === OWNER_PIN) {
    sessionStorage.setItem('nova_auth', 'true');
    els.loginOverlay.classList.remove('active-overlay');
    els.loginError.textContent = '';
    els.pinInput.value = '';
  } else {
    els.loginError.textContent = 'Incorrect Password';
    els.pinInput.value = '';
    els.pinInput.focus();
  }
}

/* --- Navigation --- */
window.switchTab = (tabName) => {
  els.views.forEach(v => v.classList.remove('active-view'));

  const target = document.getElementById(`${tabName}-view`);
  if (target) target.classList.add('active-view');

  els.navItems.forEach(item => {
    if (item.getAttribute('onclick')?.includes(tabName)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (tabName === 'dashboard') {
    const mainC = Chart.getChart('mainChart');
    if (mainC) mainC.resize();
    const catC = Chart.getChart('categoryChart');
    if (catC) catC.resize();
  }
};

/* --- Chat Logic --- */
function handleInput() {
  const text = els.input.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  els.input.value = '';

  setTimeout(() => {
    processCommand(text);
  }, 600);
}

function addMessage(text, type) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${type}-message`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;

  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgDiv.appendChild(contentDiv);
  msgDiv.appendChild(timeDiv);
  els.chatMessages.appendChild(msgDiv);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function processCommand(text) {
  const isIncome = /income|salary|deposit|saved/i.test(text);
  const numbers = text.match(/(\d+[,\.]?)+/g);

  if (!numbers) {
    addMessage("I couldn't find an amount. Please try again (e.g., 'Taxi 200')", 'bot');
    return;
  }

  const rawAmount = numbers.map(n => parseFloat(n.replace(/,/g, ''))).sort((a, b) => b - a)[0];
  const amount = isIncome ? rawAmount : -Math.abs(rawAmount);

  let category = text.replace(numbers[0], '').trim();
  category = category.replace(/income|salary|deposit|saved/i, '').trim();
  if (category.length < 2) category = isIncome ? "Income" : "General";
  category = category.charAt(0).toUpperCase() + category.slice(1);

  const transaction = {
    id: Date.now(),
    date: new Date().toISOString(),
    text: text,
    category: category,
    amount: amount,
    type: isIncome ? 'income' : 'expense'
  };

  store.addTransaction(transaction);

  const reply = isIncome
    ? `Got it! Added +₹${Math.abs(amount)} as ${category}. 🤑`
    : `Noted. ₹${Math.abs(amount)} for ${category}.`;

  addMessage(reply, 'bot');
}

/* --- UI Updates --- */
function updateUI() {
  const txs = store.transactions;

  const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = income - expense;

  els.summary.income.textContent = formatMoney(income);
  els.summary.expense.textContent = formatMoney(expense);
  els.summary.balance.textContent = formatMoney(balance);

  // Dynamic Arrows Logic
  const incomeIcon = document.getElementById('income-icon');
  const expenseIcon = document.getElementById('expense-icon');

  if (income >= expense) {
    // Good State: Income Up, Expense Controlled
    if (incomeIcon) incomeIcon.textContent = '↑';
    if (expenseIcon) expenseIcon.textContent = '↓';
  } else {
    // Warning State: Income Down, Expense High
    if (incomeIcon) incomeIcon.textContent = '↓';
    if (expenseIcon) expenseIcon.textContent = '↑';
  }

  renderHistory();
  renderHistory();
  try {
    updateCharts();
  } catch (e) { console.warn("Chart update failed", e); }
  renderBudgets();
  generateInsights(txs);
}

function renderBudgets() {
  els.budgetContainer.innerHTML = '';
  const budgets = budgetStore.budgets;
  if (!Object.keys(budgets).length) return;

  const txs = store.transactions;
  const now = new Date();

  Object.keys(budgets).forEach(category => {
    const limit = budgets[category];
    const spent = txs
      .filter(t => t.type === 'expense' && t.category === category && new Date(t.date).getMonth() === now.getMonth())
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const percent = Math.min((spent / limit) * 100, 100);
    let color = '#4ade80'; // Green
    if (percent > 80) color = '#facc15'; // Yellow
    if (percent >= 100) color = '#f87171'; // Red

    const item = document.createElement('div');
    item.className = 'budget-item';
    item.innerHTML = `
      <div class="budget-header">
        <span>${category}</span>
        <span>${formatMoney(spent)} / ${formatMoney(limit)}</span>
      </div>
      <div class="budget-bar">
        <div class="budget-fill" style="width: ${percent}%; background: ${color}"></div>
      </div>
    `;
    els.budgetContainer.appendChild(item);
  });
}

function generateInsights(txs) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter Current Month Expenses
  const thisMonthExp = txs
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Filter Last Month Expenses
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const lastMonthExp = txs
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === lastMonth && new Date(t.date).getFullYear() === lastMonthYear)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  let tip = "";

  if (thisMonthExp === 0 && lastMonthExp === 0) {
    tip = "Start adding transactions to get AI insights! 💡";
  } else if (lastMonthExp === 0) {
    tip = `You've spent ${formatMoney(thisMonthExp)} this month. Keep tracking! 📊`;
  } else {
    // Compare
    const percentChange = ((thisMonthExp - lastMonthExp) / lastMonthExp) * 100;

    if (percentChange > 10) {
      tip = `Warning: Spending is up <b>${Math.round(percentChange)}%</b> vs last month. Watch your budget! ⚠️`;
    } else if (percentChange < -10) {
      tip = `Great job! Spending is down <b>${Math.abs(Math.round(percentChange))}%</b> vs last month. 🎉`;
    } else {
      tip = `Spending is stable. You're within <b>${Math.round(percentChange)}%</b> of last month. 👍`;
    }
  }

  if (tip) {
    els.aiInsights.style.display = 'flex';
    els.aiInsights.innerHTML = tip;
  } else {
    els.aiInsights.style.display = 'none';
  }
}

function renderHistory() {
  els.lists.history.innerHTML = '';
  const sorted = [...store.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(t => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const isExp = t.type === 'expense';
    const sign = isExp ? '-' : '+';
    const color = isExp ? 'var(--danger-color)' : 'var(--success-color)';

    item.innerHTML = `
            <div class="item-left">
                <div class="item-category">${t.category}</div>
                <div class="item-date">${new Date(t.date).toLocaleDateString()} • ${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style="display:flex; align-items:center; gap: 15px;">
                <div class="item-amount" style="color: ${color}">
                    ${sign}${formatMoney(Math.abs(t.amount))}
                </div>
                <div class="item-actions">
                    <button class="action-btn" onclick="openEditModal(${t.id})">✏️</button>
                    <button class="action-btn delete-btn" onclick="deleteItem(${t.id})">🗑️</button>
                </div>
            </div>
        `;
    els.lists.history.appendChild(item);
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/* --- Edit Features --- */
window.deleteItem = (id) => {
  if (confirm('Are you sure you want to delete this transaction?')) {
    store.deleteTransaction(id);
  }
};

window.openEditModal = (id) => {
  const t = store.transactions.find(t => t.id === id);
  if (!t) return;

  currentEditId = id;
  els.editCategory.value = t.category;
  els.editAmount.value = Math.abs(t.amount);
  els.editType.value = t.type;

  els.editModal.style.display = 'flex';
};

function closeEditModal() {
  els.editModal.style.display = 'none';
  currentEditId = null;
}

function saveEdit() {
  if (!currentEditId) return;

  const newCategory = els.editCategory.value.trim();
  const newAmount = parseFloat(els.editAmount.value);
  const newType = els.editType.value;

  if (!newCategory || isNaN(newAmount)) {
    alert("Please enter valid details");
    return;
  }

  const finalAmount = newType === 'income' ? Math.abs(newAmount) : -Math.abs(newAmount);

  // Recurring Update (Mock Implementation)
  // In a real app, we'd have a separate 'recurring' flag in the store. 
  // Here we just save it to the existing transaction for simplicity.
  const isRecurring = document.getElementById('edit-recurring').checked;
  store.updateTransaction(currentEditId, {
    category: newCategory,
    amount: finalAmount,
    type: newType,
    recurring: isRecurring
  });

  closeEditModal();
}

function checkRecurring() {
  const txs = store.transactions;
  const now = new Date();
  const currentMonth = now.getMonth();

  let added = false;

  txs.forEach(t => {
    if (t.recurring) {
      const tDate = new Date(t.date);
      // If recurring AND from a previous month (simple check)
      if (tDate.getMonth() !== currentMonth) {
        // Only add if we haven't already added this specifically for this month
        // (This is a basic check. Real apps need a 'nextRunDate' field)
        const existsForThisMonth = txs.some(
          x => x.text === t.text && x.amount === t.amount && new Date(x.date).getMonth() === currentMonth
        );

        if (!existsForThisMonth) {
          store.addTransaction({
            ...t,
            id: Date.now() + Math.random(), // Unique ID
            date: now.toISOString(), // Today
            text: t.text + " (Recurring)"
          });
          added = true;
        }
      }
    }
  });

  if (added) alert("Recurring transactions added for this month! 🔄");
}

/* --- Export Data --- */
window.exportData = () => {
  const txs = store.transactions;
  if (!txs.length) {
    alert("No data to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Date,Type,Category,Amount,Description\n";

  txs.forEach(t => {
    const row = [
      new Date(t.date).toLocaleDateString(),
      t.type,
      t.category,
      Math.abs(t.amount),
      t.text
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "nova_transactions.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* --- PIN Management --- */
window.openChangePinModal = () => {
  els.oldPin.value = '';
  els.newPin.value = '';
  els.confirmPin.value = '';
  els.pinModal.style.display = 'flex';
};

function savePIN() {
  const oldP = els.oldPin.value;
  const newP = els.newPin.value;
  const confirmP = els.confirmPin.value;

  if (oldP !== OWNER_PIN) {
    alert("Incorrect Current Password!");
    return;
  }

  // UPDATED VALIDATION: 6-8 characters
  if (newP.length < 6 || newP.length > 8) {
    alert("Password must be 6 to 8 characters long.");
    return;
  }

  if (newP !== confirmP) {
    alert("New Passwords do not match!");
    return;
  }

  if (confirm("Are you sure you want to change your Password?")) {
    localStorage.setItem('nova_pin', newP);
    OWNER_PIN = newP;
    alert("Password Updated Successfully! Redirecting to Home...");

    // REDIRECT LOGIC
    els.pinModal.style.display = 'none';
    switchTab('dashboard'); // Auto-redirect to dashboard
  }
  switchTab('dashboard'); // Auto-redirect to dashboard
}

/* --- Budget Logic --- */
window.openBudgetModal = () => {
  els.budgetLimit.value = '';
  els.budgetModal.style.display = 'flex';
};

function saveBudget() {
  const category = els.budgetCategory.value;
  const limit = parseFloat(els.budgetLimit.value);

  if (isNaN(limit) || limit <= 0) {
    alert("Please enter a valid limit amount.");
    return;
  }

  budgetStore.setBudget(category, limit);
  els.budgetModal.style.display = 'none';
  alert(`Budget set for ${category}: ${formatMoney(limit)}`);
}

/* --- Chart Logic --- */
function updateCharts() {
  const period = els.periodSelect.value;
  const now = new Date();

  // 1. Filter Data
  const filtered = store.transactions.filter(t => {
    const d = new Date(t.date);
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } else {
      return d.getFullYear() === now.getFullYear();
    }
  });

  // 2. Update Category Chart (Distribution)
  const categories = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
  });
  updateCategoryChart(categories);

  // 3. Prepare Line Chart Data
  const dataMap = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  filtered.forEach(t => {
    const d = new Date(t.date);
    // If 'year' view, group by Month Key (0-11)
    // If 'month' view, group by Day Key (1-31)
    const key = period === 'year' ? d.getMonth() : d.getDate();

    if (!dataMap[key]) dataMap[key] = { income: 0, expense: 0 };

    if (t.type === 'income') dataMap[key].income += t.amount;
    else dataMap[key].expense += Math.abs(t.amount);
  });

  // 4. Generate Sorted Labels
  // Sort numerical keys (days or month indices)
  const keys = Object.keys(dataMap).map(Number).sort((a, b) => a - b);

  let finalLabels = [];
  if (period === 'year') {
    finalLabels = keys.map(k => monthNames[k]);
  } else {
    finalLabels = keys.map(k => `${k}`); // Just the day number
  }

  const dataIncome = keys.map(k => dataMap[k].income);
  const dataExpense = keys.map(k => dataMap[k].expense);

  updateMainChart(finalLabels, dataIncome, dataExpense);
}

// Set Global Defaults for better visibility
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.font.size = 14;
Chart.defaults.color = '#94a3b8';

function updateCategoryChart(dataObj) {
  const canvas = document.getElementById('categoryChart');
  const ctx = canvas.getContext('2d');
  const labels = Object.keys(dataObj);
  const data = Object.values(dataObj);

  let chart = Chart.getChart(canvas);

  if (chart && chart.config.type === 'polarArea') {
    // Update existing chart
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  } else {
    // Destroy if exists (wrong type or corrupted)
    if (chart) chart.destroy();

    // Create new chart
    new Chart(ctx, {
      type: 'polarArea', // Next-Gen Polar Chart
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)', // Emerald
            'rgba(59, 130, 246, 0.7)', // Blue
            'rgba(245, 158, 11, 0.7)', // Amber
            'rgba(239, 68, 68, 0.7)',  // Red
            'rgba(139, 92, 246, 0.7)', // Violet
            'rgba(236, 72, 153, 0.7)'  // Pink
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, /* Critical for Fixed Height */
        scales: {
          r: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { display: false, backdropColor: 'transparent' }
          }
        },
        plugins: {
          legend: { display: false } // Disable native legend
        }
      }
    });
  }

  // --- Generate Custom HTML Legend ---
  const legendContainer = document.getElementById('categoryLegend');
  legendContainer.innerHTML = ''; // Clear previous

  const colors = [
    'rgba(16, 185, 129, 0.7)', // Emerald
    'rgba(59, 130, 246, 0.7)', // Blue
    'rgba(245, 158, 11, 0.7)', // Amber
    'rgba(239, 68, 68, 0.7)',  // Red
    'rgba(139, 92, 246, 0.7)', // Violet
    'rgba(236, 72, 153, 0.7)'  // Pink
  ];

  labels.forEach((label, index) => {
    const value = data[index];
    const color = colors[index % colors.length];

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-color" style="background: ${color}"></div>
      <span class="legend-label">${label}</span>
      <span class="legend-value">${formatMoney(value)}</span>
    `;
    legendContainer.appendChild(item);
  });
}

function updateMainChart(labels, income, expense) {
  const canvas = document.getElementById('mainChart');
  const ctx = canvas.getContext('2d');

  let chart = Chart.getChart(canvas);

  if (chart && chart.config.type === 'line') {
    // Update existing chart
    chart.data.labels = labels;
    chart.data.datasets[0].data = income;
    chart.data.datasets[1].data = expense;
    chart.update();
  } else {
    // Destroy if exists
    if (chart) chart.destroy();

    // Gradients
    const gradIncome = ctx.createLinearGradient(0, 0, 0, 400);
    gradIncome.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // Emerald Glow
    gradIncome.addColorStop(1, 'rgba(16, 185, 129, 0)');

    const gradExpense = ctx.createLinearGradient(0, 0, 0, 400);
    gradExpense.addColorStop(0, 'rgba(248, 113, 113, 0.5)'); // Red Glow
    gradExpense.addColorStop(1, 'rgba(248, 113, 113, 0)');

    new Chart(ctx, {
      type: 'line', // Smooth Line Chart
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Income',
            data: income,
            borderColor: '#10b981',
            backgroundColor: gradIncome,
            fill: true,
            tension: 0.4, // Smooth curve
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Expense',
            data: expense,
            borderColor: '#f87171',
            backgroundColor: gradExpense,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
      }
    });
  }
}
