// BS Calendar Logic
const BS_MONTHS = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const BS_DATA = {2000:[30,32,31,32,31,30,30,30,29,30,29,31],2001:[31,31,32,31,31,31,30,29,30,29,30,30],2002:[31,31,32,32,31,30,30,29,30,29,30,30],2003:[31,32,31,32,31,30,30,30,29,29,30,31],2004:[30,32,31,32,31,30,30,30,29,30,29,31],2005:[31,31,32,31,31,31,30,29,30,29,30,30],2006:[31,31,32,32,31,30,30,29,30,29,30,30],2007:[31,32,31,32,31,30,30,30,29,29,30,31],2008:[31,31,31,32,31,31,29,30,30,29,29,31],2009:[31,31,32,31,31,31,30,29,30,29,30,30],2010:[31,31,32,32,31,30,30,29,30,29,30,30],2011:[31,32,31,32,31,30,30,30,29,29,30,31],2012:[31,31,31,32,31,31,29,30,30,29,30,30],2013:[31,31,32,31,31,31,30,29,30,29,30,30],2014:[31,31,32,32,31,30,30,29,30,29,30,30],2015:[31,32,31,32,31,30,30,30,29,29,30,31],2016:[31,31,31,32,31,31,29,30,30,29,30,30],2017:[31,31,32,31,31,31,30,29,30,29,30,30],2018:[31,31,32,32,31,30,30,29,30,29,30,30],2019:[31,32,31,32,31,30,30,30,29,29,30,31],2020:[31,31,31,32,31,31,29,30,30,29,30,30],2021:[31,31,32,31,31,31,30,29,30,29,30,30],2022:[31,31,32,32,31,30,30,29,30,29,30,30],2023:[31,32,31,32,31,30,30,30,29,29,30,31],2024:[31,31,31,32,31,31,29,30,30,29,30,30],2025:[31,31,32,31,31,31,30,29,30,29,30,30],2026:[31,31,32,32,31,30,30,29,30,29,30,30],2027:[31,32,31,32,31,30,30,30,29,29,30,32],2028:[30,32,31,32,31,30,30,30,29,30,29,31],2029:[31,31,32,31,31,31,30,29,30,29,30,30],2030:[31,31,32,32,31,30,30,29,30,29,30,30],2031:[31,32,31,32,31,30,30,30,29,29,30,31],2032:[30,32,31,32,31,30,30,30,29,30,29,31],2033:[31,31,32,31,31,31,30,29,30,29,30,30],2034:[31,31,32,32,31,30,30,29,30,29,30,30],2035:[31,32,31,32,31,30,30,30,29,29,30,31],2036:[31,31,31,32,31,31,29,30,30,29,30,30],2037:[31,31,32,31,31,31,30,29,30,29,30,30],2038:[31,31,32,32,31,30,30,29,30,29,30,30],2039:[31,32,31,32,31,30,30,30,29,29,30,31],2040:[31,31,31,32,31,31,29,30,30,29,30,30],2041:[31,31,32,31,31,31,30,29,30,29,30,30],2042:[31,31,32,32,31,30,30,29,30,29,30,30],2043:[31,32,31,32,31,30,30,30,29,29,30,31],2044:[30,32,31,32,31,30,30,30,29,30,29,31],2082:[31,31,32,31,31,31,30,29,30,29,30,30]};

function adToBS(ad) {
    const ref = new Date(1944, 0, 1);
    const target = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate());
    let days = Math.round((target - ref) / 86400000);
    let y = 2000, m = 9, d = 17;
    while (days > 0) {
        const mdays = (BS_DATA[y] || BS_DATA[2082])[m - 1];
        const rem = mdays - d;
        if (days <= rem) { d += days; days = 0; }
        else { days -= (rem + 1); d = 1; m++; if (m > 12) { m = 1; y++; } }
    }
    return { y, m, d };
}

let state = {
    transactions: [],
    activeTab: 'all',
    searchQuery: '',
    members: ['Arya Lamsal', 'Umanga Regmi', 'Gaurav Laudari'],
    mShort: { 'Arya Lamsal': 'Arya', 'Umanga Regmi': 'Umanga', 'Gaurav Laudari': 'Gaurav' },
    mCol: { 'Arya Lamsal': '#f59e0b', 'Umanga Regmi': '#14b8a6', 'Gaurav Laudari': '#a855f7' }
};

async function syncData() {
    try {
        const res = await fetch('/api/transactions');
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Server Error');
        }
        state.transactions = await res.json();
        renderAll();
    } catch (err) { 
        console.error(err);
        toast('Sync failed: ' + err.message, 'danger'); 
    }
}

function renderAll() {
    renderStats();
    renderFeed();
    renderNetPositions();
    renderSettlements();
    lucide.createIcons();
}

function renderStats() {
    const container = document.getElementById('member-cards-grid');
    if (!container) return;
    
    const net = computeNetBalances();
    const bsNow = adToBS(new Date());
    document.getElementById('bs-date').textContent = `${bsNow.d} ${BS_MONTHS[bsNow.m-1]} ${bsNow.y}`;

    container.innerHTML = state.members.map(m => {
        const val = net[m];
        const color = val > 0.5 ? 'var(--success)' : (val < -0.5 ? 'var(--danger)' : 'var(--text-dim)');
        const status = val > 0.5 ? 'Is Owed' : (val < -0.5 ? 'Owes' : 'Settled');
        
        return `
            <div class="card stat-card" style="border-left: 4px solid ${state.mCol[m]}; cursor: pointer;" onclick="switchUser('${m}')">
                <div class="flex">
                    <div class="avatar" style="background:${state.mCol[m]}; width: 44px; height: 44px; font-size: 1.1rem; border: 2px solid var(--border);">${m[0]}</div>
                    <div style="flex: 1;">
                        <span class="stat-label" style="font-size: 0.75rem; color: var(--text-muted);">${state.mShort[m]}</span>
                        <div class="stat-value" style="color: ${color}; font-size: 1.6rem; margin-top: -2px;">${fmt(val)}</div>
                    </div>
                </div>
                <div class="flex-between" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-light);">
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${color};">${status}</span>
                    <i data-lucide="chevron-right" style="width: 14px; color: var(--text-dim);"></i>
                </div>
            </div>
        `;
    }).join('');
}

function switchUser(name) {
    document.getElementById('current-user').value = name;
    renderAll();
}

function renderStats() {
    const container = document.getElementById('member-cards-grid');
    if (!container) return;
    
    const net = computeNetBalances();
    const bsNow = adToBS(new Date());
    document.getElementById('bs-date').textContent = `${bsNow.d} ${BS_MONTHS[bsNow.m-1]} ${bsNow.y}`;

    container.innerHTML = state.members.map(m => {
        const val = net[m];
        const color = val > 0.5 ? 'var(--success)' : (val < -0.5 ? 'var(--danger)' : 'var(--text-dim)');
        const status = val > 0.5 ? 'Is Owed' : (val < -0.5 ? 'Owes' : 'Settled');
        
        return `
            <div class="card stat-card" style="border-left: 4px solid ${state.mCol[m]};">
                <div class="flex">
                    <div class="avatar" style="background:${state.mCol[m]}; width: 40px; height: 40px; font-size: 1rem;">${m[0]}</div>
                    <div style="flex: 1;">
                        <span class="stat-label">${state.mShort[m]}</span>
                        <div class="stat-value" style="color: ${color}; font-size: 1.4rem;">${fmt(val)}</div>
                    </div>
                </div>
                <span class="stat-sub" style="color: ${color}; font-weight: 600; margin-top: 0.5rem; display: block; font-size: 0.75rem;">${status}</span>
            </div>
        `;
    }).join('');
}

function renderFeed() {
    const container = document.getElementById('main-feed');
    let items = [...state.transactions];
    const user = document.getElementById('current-user').value;

    if (state.activeTab === 'pending') items = items.filter(t => t.status === 'PENDING_APPROVAL');
    else if (state.activeTab === 'expenses') items = items.filter(t => t.type === 'expense');
    else if (state.activeTab === 'income') items = items.filter(t => t.type === 'income');

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        items = items.filter(t => t.name.toLowerCase().includes(q) || (t.category_source && t.category_source.toLowerCase().includes(q)));
    }

    container.innerHTML = items.map(t => {
        const isPending = t.status === 'PENDING_APPROVAL';
        const hasApproved = t.approved_by && t.approved_by.includes(user);
        const needsAction = isPending && !hasApproved && (user === 'Umanga Regmi' || user === 'Gaurav Laudari');
        const payer = t.person_payer || 'System';

        return `
            <div class="tx-card" style="${isPending ? 'border-left: 4px solid var(--accent)' : ''}">
                <div class="flex">
                    <div class="avatar" style="background:${state.mCol[payer] || 'var(--primary)'}">${payer[0]}</div>
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${esc(t.name)}</div>
                        <div style="font-size:0.7rem; color:var(--text-dim);">${t.date.split('T')[0]} · ${t.type}</div>
                    </div>
                </div>
                <div class="flex">
                    <div class="tx-amount ${t.type === 'income' ? 'amt-pos' : 'amt-neg'}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</div>
                    ${needsAction ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:0.7rem;" onclick="approveTx(${t.id})">Approve</button>` : ''}
                    ${isPending && !needsAction ? `<span class="status-badge status-pending">Pending</span>` : ''}
                    <button class="btn btn-ghost" style="padding:4px;" onclick="deleteTx(${t.id})"><i data-lucide="trash-2" style="width:14px"></i></button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function computeNetBalances() {
    const net = {}; state.members.forEach(m => net[m] = 0);
    const approved = state.transactions.filter(t => t.status === 'APPROVED');

    approved.forEach(t => {
        if (t.type === 'expense' && t.split_type !== 'personal' && t.shares) {
            state.members.forEach(m => {
                const share = parseFloat(t.shares[m] || 0);
                if (m === t.person_payer) {
                    Object.entries(t.shares).forEach(([mem, amt]) => {
                        if (mem !== t.person_payer) net[t.person_payer] += parseFloat(amt);
                    });
                } else {
                    net[m] -= share;
                }
            });
        } else if (t.type === 'debt') {
            const from = t.other_person;
            const to = t.person_payer;
            net[to] += parseFloat(t.amount);
            net[from] -= parseFloat(t.amount);
        }
    });
    return net;
}

function renderNetPositions() {
    const container = document.getElementById('member-net-list');
    const net = computeNetBalances();

    container.innerHTML = state.members.map(m => `
        <div class="flex-between" style="background:var(--surface-raised); padding:0.8rem; border-radius:8px;">
            <div class="flex"><div class="avatar" style="background:${state.mCol[m]}">${m[0]}</div><span>${state.mShort[m]}</span></div>
            <div style="text-align:right">
                <div style="font-weight:700; color:${net[m]>0.5?'var(--success)':(net[m]<-0.5?'var(--danger)':'var(--text-dim)')}">${net[m] !== 0 ? (net[m]>0?'+':'')+fmt(net[m]) : '—'}</div>
            </div>
        </div>
    `).join('');
}

function renderSettlements() {
    const container = document.getElementById('settlement-list');
    const net = computeNetBalances();
    const creditors = []; const debtors = [];
    state.members.forEach(m => {
        if (net[m] > 0.5) creditors.push({ name: m, amount: net[m] });
        if (net[m] < -0.5) debtors.push({ name: m, amount: -net[m] });
    });

    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
        const c = creditors[ci], d = debtors[di];
        const amt = Math.min(c.amount, d.amount);
        if (amt > 0.5) transfers.push({ from: d.name, to: c.name, amount: Math.round(amt) });
        c.amount -= amt; d.amount -= amt;
        if (c.amount < 0.5) ci++; if (d.amount < 0.5) di++;
    }

    if (!transfers.length) {
        container.innerHTML = `<div style="text-align:center; padding: 1rem; color: var(--success); font-size: 0.8rem;">✓ Settled</div>`;
        return;
    }

    container.innerHTML = transfers.map(s => `
        <div class="settle-item">
            <div style="font-size:0.8rem;"><b>${state.mShort[s.from]}</b> → <b>${state.mShort[s.to]}</b></div>
            <div style="font-weight:700;">${fmt(s.amount)}</div>
        </div>
    `).join('');
}

window.approveTx = async function(id) {
    const user = document.getElementById('current-user').value;
    try {
        await fetch(`/api/approve/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: user })
        });
        syncData();
        toast('Approved!');
    } catch (err) { toast('Failed to approve', 'danger'); }
}

window.deleteTx = async function(id) {
    if (confirm('Delete?')) {
        try {
            await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            syncData();
            toast('Deleted');
        } catch (err) { toast('Failed to delete', 'danger'); }
    }
}

window.handleSubmit = async function() {
    const type = document.getElementById('f-type').value;
    const name = document.getElementById('f-name').value;
    const amount = parseFloat(document.getElementById('f-amount').value);
    const date = document.getElementById('f-date').value;
    const user = document.getElementById('current-user').value;

    if (!name || isNaN(amount) || !date) { toast('Fill all fields', 'danger'); return; }

    const data = { id: Date.now(), type, name, amount, date };
    if (type === 'expense') {
        data.paidBy = user;
        data.category = document.getElementById('f-cat').value;
        const split = document.getElementById('f-split').value;
        data.splitType = split;
        if (split === 'equal3') {
            const s = amount / 3;
            data.shares = { 'Arya Lamsal': s, 'Umanga Regmi': s, 'Gaurav Laudari': s };
        } else if (split === 'equal2') {
            const other = document.getElementById('f-other').value;
            data.shares = { [user]: amount / 2, [other]: amount / 2 };
            data.other = other;
        } else {
            data.shares = { [user]: amount };
        }
    } else if (type === 'income') {
        data.person = user;
        data.source = 'Salary';
    } else if (type === 'debt') {
        data.from = document.getElementById('f-from').value;
        data.to = document.getElementById('f-to').value;
        if (data.from === data.to) { toast('Invalid users', 'danger'); return; }
    }

    try {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        syncData();
        toast('Recorded!');
    } catch (err) { toast(err.message || 'Failed to record', 'danger'); }
}

window.toggleFormFields = function() {
    const type = document.getElementById('f-type').value;
    const container = document.getElementById('form-dynamic-fields');
    const today = new Date().toISOString().split('T')[0];
    const user = document.getElementById('current-user').value;

    if (type === 'expense') {
        container.innerHTML = `
            <div class="form-group"><label>Description</label><input type="text" id="f-name"></div>
            <div class="form-group"><label>Amount</label><input type="number" id="f-amount"></div>
            <div class="form-group"><label>Date</label><input type="date" id="f-date" value="${today}"></div>
            <div class="form-group"><label>Category</label><select id="f-cat"><option value="Food">Food</option><option value="Rent">Rent</option><option value="Other">Other</option></select></div>
            <div class="form-group"><label>Split</label><select id="f-split" onchange="toggleSplit()"><option value="equal3">3-way Equal</option><option value="equal2">2-way Equal</option><option value="personal">Personal</option></select></div>
            <div id="split-extra"></div>
        `;
    } else if (type === 'income') {
        container.innerHTML = `
            <div class="form-group"><label>Description</label><input type="text" id="f-name"></div>
            <div class="form-group"><label>Amount</label><input type="number" id="f-amount"></div>
            <div class="form-group"><label>Date</label><input type="date" id="f-date" value="${today}"></div>
        `;
    } else if (type === 'debt') {
        container.innerHTML = `
            <div class="form-group"><label>Description</label><input type="text" id="f-name"></div>
            <div class="form-group"><label>Amount</label><input type="number" id="f-amount"></div>
            <div class="form-group"><label>Date</label><input type="date" id="f-date" value="${today}"></div>
            <div class="form-group"><label>Who Owes</label><select id="f-from">${state.members.map(m => `<option value="${m}">${state.mShort[m]}</option>`).join('')}</select></div>
            <div class="form-group"><label>Owes To</label><select id="f-to">${state.members.map(m => `<option value="${m}">${state.mShort[m]}</option>`).join('')}</select></div>
        `;
    }
}

window.toggleSplit = function() {
    const split = document.getElementById('f-split').value;
    const container = document.getElementById('split-extra');
    const user = document.getElementById('current-user').value;
    if (split === 'equal2') {
        container.innerHTML = `<div class="form-group"><label>With Who?</label><select id="f-other">${state.members.filter(m => m !== user).map(m => `<option value="${m}">${state.mShort[m]}</option>`).join('')}</select></div>`;
    } else {
        container.innerHTML = '';
    }
}

window.setTab = function(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(tab)));
    renderFeed();
}

window.toggleTheme = function() {
    const root = document.documentElement;
    const theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    localStorage.setItem('ledger-theme', theme);
}

window.exportData = function() {
    const data = JSON.stringify(state.transactions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast('Data exported!');
}

window.state = state; // expose state to window for inline onclicks
window.switchUser = switchUser;
window.renderAll = renderAll;
window.syncData = syncData;

function fmt(n) { return 'Rs ' + Math.abs(Math.round(n)).toLocaleString('en-IN'); }
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function toast(msg, type='success') {
    const t = document.createElement('div'); t.className = 'toast'; 
    if (type === 'danger') t.style.borderLeftColor = 'var(--danger)';
    t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// Initialize theme
if (localStorage.getItem('ledger-theme')) {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('ledger-theme'));
}

document.addEventListener('DOMContentLoaded', () => {
    toggleFormFields();
    syncData();
});
