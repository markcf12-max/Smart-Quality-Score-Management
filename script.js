/* ==========================================================================
   FIREBASE
   ========================================================================== */
import { db } from './firebase-config.js';
import {
    doc, getDoc, setDoc, deleteDoc,
    collection, query, where, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ==========================================================================
   ROLE MAPPING
   ========================================================================== */
// Maps roster Position values to app roles.
// Quality roles receive full admin & upload access ('quality').
function positionToRole(position) {
    const p = String(position || '').trim();
    
    // Matches QA Apprentice, QA SUP, Quality Manager, Quality Analyst, and common variations
    if (/qa\s*apprentice|qa\s*sup|qa\s*supervisor|quality\s*analyst|qa\s*analyst|quality\s*manager|qa\s*mgr|qa-data scrubber|quality/i.test(p)) {
        return 'quality';
    }
    
    // Team Leader / Supervisor access (Dashboard view only)
    if (/supervisor|tl apprentice|team leader|sr\.\s*supervisor|trainer|trainer apprentice|training supervisor/i.test(p)) {
        return 'team_leader';
    }
    
    return 'agent';
}

/* Robust score parser that safely converts strings, percentages, and fractions into 0-100 values */
function parseScore(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    let s = String(val).trim().replace('%', '');
    if (s === '' || s === 'N/A' || s === 'NA' || s === '-') return null;
    let n = parseFloat(s);
    if (isNaN(n)) return null;
    return n <= 1 ? n * 100 : n;
}

let lobChartInstance = null;

function normalizeEmployeeId(value) {
    return String(value || '').trim().replace(/\.0$/, '').replace(/\s+/g, '');
}

/* Firestore write batches max out at 500 ops — chunk anything bigger */
async function batchWriteDocs(collectionName, docs, idFn) {
    const chunks = [];
    for (let i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
            const ref = idFn ? doc(db, collectionName, idFn(d)) : doc(collection(db, collectionName));
            batch.set(ref, d);
        });
        await batch.commit();
    }
}

async function clearCollection(collectionName) {
    const snap = await getDocs(collection(db, collectionName));
    const ids = snap.docs.map(d => d.id);
    for (let i = 0; i < ids.length; i += 400) {
        const chunk = ids.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.delete(doc(db, collectionName, id)));
        await batch.commit();
    }
}

async function replaceAuditData(rows) {
    const metaRef = doc(db, 'meta', 'auditData');
    const metaSnap = await getDoc(metaRef);
    const prevCount = metaSnap.exists() ? (metaSnap.data().count || 0) : 0;

    for (let i = 0; i < prevCount; i += 400) {
        const end = Math.min(i + 400, prevCount);
        const batch = writeBatch(db);
        for (let j = i; j < end; j++) batch.delete(doc(db, 'auditData', 'row_' + j));
        await batch.commit();
    }

    for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((row, idx) => batch.set(doc(db, 'auditData', 'row_' + (i + idx)), row));
        await batch.commit();
    }

    await setDoc(metaRef, { count: rows.length, updatedAt: Date.now() });
}

/* ==========================================================================
   SESSION
   ========================================================================== */
let currentSession = null;
let cachedAuditRows = [];

/* ==========================================================================
   AUTH (Roster-based — no Firebase Auth account creation)
   ========================================================================== */
/* ==========================================================================
   AUTH (Roster-based — no Firebase Auth account creation)
   ========================================================================== */
function showAuthMsg(elId, text, ok) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-msg ' + (ok ? 'ok' : 'error');
}

async function handleLogin() {
    const emailEl = document.getElementById('loginEmail');
    const pwEl = document.getElementById('loginPassword');
    const rawInput = emailEl ? emailEl.value.trim().toLowerCase() : '';
    const winId = pwEl ? pwEl.value.trim().replace(/\.0$/, '') : '';

    if (!rawInput || !winId) return showAuthMsg('loginMsg', 'Enter your SMART domain and Win ID.', false);

    const username = rawInput.split('@')[0];
    const email = username + '@supplier.smart.com.ph';

    showAuthMsg('loginMsg', 'Checking credentials…', false);

    try {
        let match = null;

        // 1. Current roster format: doc id is 'winid_'
        const byWinId = await getDoc(doc(db, 'roster', 'winid_' + winId));
        if (byWinId.exists()) {
            match = byWinId.data();
            const storedUsername = String(match.email || '').split('@')[0].toLowerCase();
            if (storedUsername && storedUsername !== username) {
                return showAuthMsg('loginMsg', 'Domain does not match this Win ID. Please check your credentials.', false);
            }
        }

        // 2. Fall back to legacy roster format: doc id is the email itself
        if (!match) {
            const byEmail = await getDoc(doc(db, 'roster', email));
            if (byEmail.exists()) {
                const d = byEmail.data();
                if (normalizeEmployeeId(d.agentId) !== winId) {
                    return showAuthMsg('loginMsg', 'Incorrect Win ID. Please check and try again.', false);
                }
                match = d;
            }
        }

        if (!match) {
            return showAuthMsg('loginMsg', 'Credentials not found on the roster. Ask your supervisor to upload the latest roster.', false);
        }

        const role = match.position ? positionToRole(match.position) : 'agent';

        currentSession = {
            email: String(match.email || email).toLowerCase(),
            role,
            agentName: match.agentName || '',
            agentId: winId
        };

        try { sessionStorage.setItem('smart_session', JSON.stringify(currentSession)); } catch (e) {}
        if (emailEl) emailEl.value = '';
        if (pwEl) pwEl.value = '';
        await enterApp();
    } catch (err) {
        console.error('Login error:', err);
        if (String(err.code || err.message || '').includes('permission')) {
            return showAuthMsg('loginMsg', 'Permission denied. Check Firestore Rules in Firebase Console.', false);
        }
        showAuthMsg('loginMsg', 'Login failed: ' + (err.message || 'Please try again.'), false);
    }
}

function logout() {
    currentSession = null;
    cachedAuditRows = [];
    try { sessionStorage.removeItem('smart_session'); } catch (e) {}
    resetToLoggedOutState();
}

function resetToLoggedOutState() {
    currentSession = null;
    cachedAuditRows = [];
    const appScreen = document.getElementById('appScreen');
    const authScreen = document.getElementById('authScreen');
    const sessionChip = document.getElementById('sessionChip');
    const switchSiteBtn = document.getElementById('switchSiteBtn');
    const myTeamCard = document.getElementById('myTeamCard');
    if (appScreen) appScreen.style.display = 'none';
    if (authScreen) authScreen.style.display = 'flex';
    if (sessionChip) sessionChip.style.display = 'none';
    if (switchSiteBtn) switchSiteBtn.style.display = 'none';
    if (myTeamCard) myTeamCard.style.display = 'none';

    const loginEmailEl = document.getElementById('loginEmail');
    const loginPasswordEl = document.getElementById('loginPassword');
    const loginMsgEl = document.getElementById('loginMsg');
    if (loginEmailEl) loginEmailEl.value = '';
    if (loginPasswordEl) loginPasswordEl.value = '';
    if (loginMsgEl) loginMsgEl.className = 'auth-msg';
}

// Restore session from sessionStorage on page load (survives refresh, not tab close)
(function restoreSession() {
    try {
        const saved = sessionStorage.getItem('smart_session');
        if (saved) {
            currentSession = JSON.parse(saved);
            window.addEventListener('DOMContentLoaded', () => enterApp());
        } else {
            resetToLoggedOutState();
        }
    } catch (e) {
        resetToLoggedOutState();
    }
})();

async function enterApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'flex';
    document.getElementById('sessionChip').style.display = 'flex';

    const roleLabels = { quality: '👤 Quality · ', team_leader: '👤 Team Leader · ', supervisor: '👤 Quality · ', agent: '👤 Agent · ' };
    const roleLabel = roleLabels[currentSession.role] || '👤 ';
    document.getElementById('sessionLabel').textContent = roleLabel + currentSession.email;

    const canViewDashboard = currentSession.role === 'quality' || currentSession.role === 'team_leader' || currentSession.role === 'supervisor';
    const canUpload = currentSession.role === 'quality' || currentSession.role === 'supervisor';

    document.getElementById('supervisorSidebar').style.display = canViewDashboard ? 'flex' : 'none';
    document.getElementById('supervisorView').style.display = canViewDashboard ? 'flex' : 'none';
    document.getElementById('agentView').style.display = canViewDashboard ? 'none' : 'flex';
    document.getElementById('uploadIconBtn').style.display = canUpload ? 'flex' : 'none';
    document.getElementById('switchSiteBtn').style.display = canUpload ? 'inline-flex' : 'none';

    if (canViewDashboard) {
        if (canUpload) await refreshRosterStatus();
        const rows = await loadAllAuditData();
        if (rows.length) {
            if (canUpload) document.getElementById('dataStatus').innerHTML = `✅ ${rows.length} audit rows loaded.`;
            populateDropdownOptions(rows);
            filterData();
        }
        if (currentSession.role === 'team_leader') {
            await renderMyTeamPanel(rows);
        } else {
            document.getElementById('myTeamCard').style.display = 'none';
        }
    } else {
        await renderAgentView();
    }
}

async function renderMyTeamPanel(rows) {
    const card = document.getElementById('myTeamCard');
    try {
        const rosterSnap = await getDoc(doc(db, 'roster', 'winid_' + currentSession.agentId));
        const myName = rosterSnap.exists() ? rosterSnap.data().agentName : '';
        if (!myName) {
            card.style.display = 'none';
            return;
        }
        const myKey = normalizeName(myName);
        const byAgent = {};
        rows.forEach(r => {
            if (normalizeName(r['TEAM LEADER']) !== myKey) return;
            const name = String(r['AGENT/OFFICER NAME'] || '').trim();
            if (!name) return;
            if (!byAgent[name]) byAgent[name] = { RELIABLE: [], PERSONABLE: [], FAST: [], 'SAFE & SECURE': [], 'OVERALL SCORE': [], count: 0 };
            byAgent[name].count++;
            ['RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE'].forEach(k => {
                const v = parseScore(r[k]);
                if (v !== null) byAgent[name][k].push(v);
            });
        });

        const names = Object.keys(byAgent).sort();
        document.getElementById('myTeamTitle').textContent = `My Team — ${myName} (${names.length} agent${names.length === 1 ? '' : 's'})`;

        const avgOf = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
        const cell = (v) => v === null ? '—' : v + '%';

        const tbody = document.getElementById('myTeamTableBody');
        tbody.innerHTML = names.length
            ? names.map(n => {
                const a = byAgent[n];
                return `<tr>
                    <td style="text-align:left;">${escapeHtml(n)}</td>
                    <td>${cell(avgOf(a.RELIABLE))}</td>
                    <td>${cell(avgOf(a.PERSONABLE))}</td>
                    <td>${cell(avgOf(a.FAST))}</td>
                    <td>${cell(avgOf(a['SAFE & SECURE']))}</td>
                    <td>${cell(avgOf(a['OVERALL SCORE']))}</td>
                    <td>${a.count}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="7" class="empty-note">No audits found yet for agents under you.</td></tr>`;
        card.style.display = 'block';
    } catch (err) {
        console.error('My Team panel error:', err);
        card.style.display = 'none';
    }
}

/* ==========================================================================
   HIT-PARAMETER CONFIG
   ========================================================================== */
const NON_ISSUE_VALUES = new Set(['', 'NO OPPORTUNITY', 'NA', 'N/A', 'NO', 'NONE']);

const HIT_PARAMS = [
    { col: 'IRRELEVANT SOLUTION', category: 'Reliable', label: 'Irrelevant solution given', type: 'descriptive' },
    { col: 'INCOMPLETE SOLUTION', category: 'Reliable', label: 'Incomplete solution given', type: 'descriptive' },
    { col: 'UNTIMELY SOLUTION ( ZTP)', category: 'Reliable', label: 'Untimely solution (ZTP)', type: 'descriptive' },
    { col: 'UNCLEAR SOLUTION', category: 'Reliable', label: 'Unclear solution given', type: 'descriptive' },
    { col: 'Poor Listening Skills?', category: 'Personable', label: 'Poor listening skills', type: 'descriptive' },
    { col: 'Customer Validation and Empathy Gap?', category: 'Personable', label: 'Empathy / validation gap', type: 'descriptive' },
    { col: 'Did not adjust the tone/pace to match the customer?', category: 'Personable', label: 'Tone/pace not matched to customer', type: 'descriptive' },
    { col: 'Did not adjust to the customers language?', category: 'Personable', label: 'Language not adjusted to customer', type: 'descriptive' },
    { col: 'Negative Words, Phrasing and Limitations?', category: 'Personable', label: 'Negative words / phrasing used', type: 'descriptive' },
    { col: 'Unfriendly/discourteous/sarcastic?', category: 'Personable', label: 'Unfriendly, discourteous, or sarcastic tone', type: 'descriptive' },
    { col: 'Sounded transactional or robotic?', category: 'Personable', label: 'Sounded transactional or robotic', type: 'descriptive' },
    { col: 'FAST: Were there other Agent factors observed that affected the customer experience?', category: 'Fast', label: 'Other agent factor slowed the resolution', type: 'descriptive' },
    { col: 'DID WE FOLLOW THE CUSTOMER AUTHENTICATION PROCESS?', category: 'Safe & Secure', label: 'Customer authentication process missed', type: 'descriptive' },
    { col: 'DID WE FOLLOW THE DATA PRIVACY POLICY?', category: 'Safe & Secure', label: 'Data privacy policy not followed', type: 'descriptive' },
    { col: 'DID WE UPDATE THE CUSTOMER INFORMATION IN THE TOOL?', category: 'Safe & Secure', label: 'Customer info not updated in tool', type: 'descriptive' },
    { col: 'DID WE FOLLOW THE CSAT/NPS PROCESS?', category: 'Safe & Secure', label: 'CSAT/NPS process not followed', type: 'descriptive' },
    { col: 'DID WE FOLLOW THE SYSTEM DOCUMENTATION PROCESS?', category: 'Safe & Secure', label: 'System documentation process missed', type: 'descriptive' },
    { col: 'DID WE FOLLOW THE SYSTEM TAGGING PROCESS?', category: 'Safe & Secure', label: 'System tagging process missed', type: 'descriptive' },
    { col: 'DID WE FOLLOW CORRECT GRAMMAR, TECHNICAL WRITING & THE PRESCRIBED LANGUAGE?', category: 'Safe & Secure', label: 'Grammar / prescribed language standard missed', type: 'descriptive' },
    { col: "IS THIS A POTENTIAL CUSTOMER MISTREAT?", category: 'Mistreat', label: 'Potential customer mistreat flagged', type: 'descriptive' }
];

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normVal(v) {
    return (v === undefined || v === null) ? '' : String(v).trim().toUpperCase();
}

const MONTH_NUM = {
    JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4,
    MAY: 5, JUN: 6, JUNE: 6, JUL: 7, JULY: 7, AUG: 8, AUGUST: 8,
    SEP: 9, SEPT: 9, SEPTEMBER: 9, OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12
};

function monthSortKey(monthStr) {
    const s = normVal(monthStr);
    const yearMatch = s.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
    const tokens = s.split(/[^A-Z]+/).filter(Boolean);
    let monthNum = null;
    for (const t of tokens) {
        if (MONTH_NUM[t]) { monthNum = MONTH_NUM[t]; break; }
    }
    if (monthNum === null) return [1, s];
    return [0, year * 100 + monthNum, s];
}

function compareMonths(a, b) {
    const ka = monthSortKey(a), kb = monthSortKey(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        if (ka[i] === kb[i]) continue;
        if (ka[i] === undefined) return -1;
        if (kb[i] === undefined) return 1;
        return ka[i] < kb[i] ? -1 : 1;
    }
    return 0;
}

function normalizeName(str) {
    return String(str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[.,'-]/g, ' ')
        .replace(/\b(JR|SR|II|III|IV)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .sort()
        .join(' ');
}

function getRowIssues(row) {
    const issues = [];
    HIT_PARAMS.forEach(p => {
        const raw = row[p.col];
        const v = normVal(raw);
        if (!v) return;

        if (p.type === 'boolean') {
            if (v === p.hitValue) issues.push({ label: p.label, category: p.category });
            return;
        }

        if (!NON_ISSUE_VALUES.has(v)) {
            const detail = v !== 'YES' ? String(raw).trim() : '';
            issues.push({ label: detail ? `${p.label} — ${detail}` : p.label, category: p.category });
        }
    });
    return issues;
}

/* ==========================================================================
   FILE PARSING
   ========================================================================== */
function parseWorkbookFile(file, preferSheetNameContains) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                let sheetName = wb.SheetNames[0];
                if (preferSheetNameContains) {
                    const found = wb.SheetNames.find(n => n.toUpperCase().includes(preferSheetNameContains));
                    if (found) sheetName = found;
                }
                const ws = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function findHeader(row, candidates) {
    const keys = Object.keys(row);
    for (const cand of candidates) {
        const hit = keys.find(k => k.trim().toLowerCase() === cand.toLowerCase());
        if (hit) return hit;
    }
    for (const cand of candidates) {
        const hit = keys.find(k => k.trim().toLowerCase().includes(cand.toLowerCase()));
        if (hit) return hit;
    }
    return null;
}

/* ==========================================================================
   ROSTER UPLOAD
   ========================================================================== */
function rosterDocId(entry) {
    // Win ID is what agents type at login, so keying roster docs by it makes
    // login a simple direct lookup instead of a query.
    if (entry.agentId) return 'winid_' + normalizeEmployeeId(entry.agentId);
    return 'name_' + normalizeName(entry.agentName).replace(/\s+/g, '_').toLowerCase();
}

async function handleRosterUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('rosterStatus').textContent = 'Processing ' + file.name + '...';

    try {
        const rows = await parseWorkbookFile(file, 'ROSTER');
        if (!rows.length) throw new Error('empty');

        const emailKey = findHeader(rows[0], ['Email', 'Work Email', 'PLDT/SMART Domain v2', 'PLDT/SMART Domain']);
        const nameKey = findHeader(rows[0], ['Agent Name', 'AGENT/OFFICER NAME', 'Employee Name', 'Name']);
        const idKey = findHeader(rows[0], ['Win ID', 'Winid', 'WIN ID', 'ID', 'Employee ID', 'EE number/ID number', 'Agent ID']);
        const teamLeaderKey = findHeader(rows[0], ['Supervisor Name', 'Team Leader', 'TEAM LEADER']);
        const positionKey = findHeader(rows[0], ['Position', 'Designation', 'Job Title', 'Role', 'Title']);

        if (!emailKey || !nameKey) throw new Error('missing columns');

        const allNamed = rows
            .map(r => ({
                email: String(r[emailKey] || '').trim().toLowerCase(),
                agentName: String(r[nameKey] || '').trim(),
                agentId: idKey ? normalizeEmployeeId(String(r[idKey] || '')) : '',
                teamLeader: teamLeaderKey ? String(r[teamLeaderKey] || '').trim() : '',
                position: positionKey ? String(r[positionKey] || '').trim() : ''
            }))
            .filter(r => r.email && r.agentName);
        const roster = allNamed.filter(r => r.email.endsWith('@supplier.smart.com.ph'));
        const skippedOtherDomain = allNamed.length - roster.length;
        const withTeamLeader = roster.filter(r => r.teamLeader).length;
        const missingWinId = roster.filter(r => !r.agentId).length;

        await clearCollection('roster');
        await batchWriteDocs('roster', roster, rosterDocId);
        await resyncAgentEmails();

        let rosterMsg = `✅ Roster loaded: ${roster.length} agents matched to emails. 🔄 Existing audit data auto-synced to match.`;
        rosterMsg += teamLeaderKey
            ? ` Team Leader column found ("${teamLeaderKey}") — ${withTeamLeader}/${roster.length} agents have a Team Leader assigned.`
            : ` ⚠️ No Team Leader column detected in this file (looked for "Supervisor Name", "Team Leader", or "TEAM LEADER") — Team Leader will show as Unassigned until this is fixed.`;
        rosterMsg += positionKey
            ? ` Position column found ("${positionKey}") — used to grant Quality/Team Leader dashboard access.`
            : ` ⚠️ No Position column detected — everyone will log in as Agent until a Position column is added.`;
        if (skippedOtherDomain > 0) rosterMsg += ` (${skippedOtherDomain} skipped — not on @supplier.smart.com.ph)`;
        if (missingWinId > 0) rosterMsg += ` ⚠️ ${missingWinId} agent(s) have no Win ID and won't be able to log in.`;
        document.getElementById('rosterStatus').innerHTML = rosterMsg;
    } catch (err) {
        console.error(err);
        document.getElementById('rosterStatus').innerHTML =
            `⚠️ Could not read roster. Expect columns: Email, Agent Name, Win ID.`;
    }
}

async function refreshRosterStatus() {
    const snap = await getDocs(collection(db, 'roster'));
    if (snap.size) {
        document.getElementById('rosterStatus').innerHTML = `✅ Roster loaded: ${snap.size} agents.`;
    }
}

async function resyncAgentEmails() {
    const statusEl = document.getElementById('resyncStatus');
    statusEl.textContent = 'Re-syncing...';

    try {
        const rosterSnap = await getDocs(collection(db, 'roster'));
        const nameToEmail = {};
        rosterSnap.forEach(d => {
            const data = d.data();
            nameToEmail[normalizeName(data.agentName)] = d.id;
        });

        const dataSnap = await getDocs(collection(db, 'auditData'));
        const docs = dataSnap.docs;

        let matched = 0, unmatched = 0;
        const unmatchedNames = new Set();

        for (let i = 0; i < docs.length; i += 400) {
            const chunk = docs.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(d => {
                const row = d.data();
                const key = normalizeName(row['AGENT/OFFICER NAME']);
                const email = nameToEmail[key] || '';
                if (email) matched++; else { unmatched++; if (key) unmatchedNames.add(row['AGENT/OFFICER NAME']); }
                batch.update(doc(db, 'auditData', d.id), { agentEmailLower: email });
            });
            await batch.commit();
        }

        let msg = `✅ Re-synced: ${matched} rows matched to a roster email, ${unmatched} rows still unmatched (${unmatchedNames.size} distinct agent name(s)).`;
        if (unmatchedNames.size) {
            const list = [...unmatchedNames].sort();
            msg += `<details style="margin-top:6px;"><summary style="cursor:pointer;">Show unmatched names (${list.length})</summary>` +
                `<div style="max-height:160px;overflow-y:auto;margin-top:4px;font-size:11px;line-height:1.6;">${list.map(n => escapeHtml(n)).join('<br>')}</div></details>`;
        }
        statusEl.innerHTML = msg;
    } catch (err) {
        console.error(err);
        statusEl.textContent = '⚠️ Re-sync failed: ' + (err && err.message ? err.message : 'unknown error');
    }
}

/* ==========================================================================
   RAW AUDIT DATA UPLOAD
   ========================================================================== */
const NEEDED_FIELDS = [
    'ID', 'FORM TYPE', 'BRAND', 'LINE OF BUSINESS', 'AGENT/OFFICER NAME', 'AGENT TENURE',
    'TEAM LEADER', 'CLUSTER', 'WEEKENDING', 'MONTH', 'MISTREAT', 'WIN ID',
    'RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE',
    'EE number / ID number', 'EE NUMBER / ID NUMBER', 'OVERALL PASSRATE', 'CM', 'CALL ID / CASE NUMBER', 'MIN',
    'RELIABLE: ADDITIONAL COMMENTS', 
    'PERSONABLE: ADDITIONAL COMMENTS', 
    'FAST: ADDITIONAL COMMENTS',
    'OTHER FACTORS REMARKS',
    'WHAT MATTERS TO THE BUSINESS REMARKS',
    'Start time'
].concat(HIT_PARAMS.map(p => p.col));

const FIELD_HEADER_ALIASES = {
    'CALL ID / CASE NUMBER': ['Call ID', 'Case Number', 'Case ID', 'Interaction ID', 'Ticket Number', 'Call/Case Number', 'CALL ID/CASE NUMBER', 'Reference Number'],
    'MIN': ['MIN', 'ANI/DNIS NUMBER', 'ANI', 'DNIS', 'Mobile Number', 'MSISDN', 'PRODUCT'],
    'RELIABLE': ['Reliable', 'QA Reliable', 'Reliable Score'],
    'PERSONABLE': ['Personable', 'QA Personable', 'Personable Score'],
    'FAST': ['Fast', 'QA Fast', 'Fast Score'],
    'SAFE & SECURE': ['Safe & Secure', 'Safe & Secure Score', 'QA Safe & Secure', 'QA Safe', 'Safe and Secure'],
    'OVERALL SCORE': ['Overall Score', 'QA Overall Score', 'Overall QA Score', 'Overall QA Scores', 'Overall']
};

/* ==========================================================================
   DERIVED SCORE COMPUTATION
   ========================================================================== */
const RELIABLE_COLS = HIT_PARAMS.filter(p => p.category === 'Reliable').map(p => p.col);
const PERSONABLE_COLS = HIT_PARAMS.filter(p => p.category === 'Personable').map(p => p.col);
const FAST_COL = HIT_PARAMS.find(p => p.category === 'Fast').col;
const SAFE_SECURE_COLS = HIT_PARAMS.filter(p => p.category === 'Safe & Secure').map(p => p.col);
const MISTREAT_COL = HIT_PARAMS.find(p => p.category === 'Mistreat').col;

const FAST_OK_VALUES = new Set([
    'NO OPPORTUNITY',
    'UNTIMELY RESPONSE WITH NEGATIVE CX - WITHIN THRESHOLD',
    'UNTIMELY RESPONSE DUE TO KNOWLEDGE ISSUE/GAP',
    'UNTIMELY RESPONSE DUE TO COMPLEX ISSUES',
    'UNTIMELY RESPONSE DUE TO TOOLS ISSUE'
]);

function anyStrike(out, cols) {
    return cols.some(c => {
        const v = normVal(out[c]);
        return v !== '' && v !== 'NO OPPORTUNITY';
    });
}

function computeSafeSecureRatio(out) {
    let total = 0, passCount = 0;
    SAFE_SECURE_COLS.forEach(c => {
        const v = normVal(out[c]);
        if (v === '' || v === 'NA' || v === 'N/A') return;
        total++;
        if (v === 'NO OPPORTUNITY') passCount++;
    });
    return total === 0 ? 1 : passCount / total;
}

function computeMistreatFlag(out) {
    return normVal(out[MISTREAT_COL]) === 'NO' ? 1 : 0;
}

function computeFastFlag(out) {
    const v = normVal(out[FAST_COL]);
    return FAST_OK_VALUES.has(v) ? 1 : 0;
}

function parseLooseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

function computeWeekendingAndMonth(dateVal) {
    const d = parseLooseDate(dateVal);
    if (!d) return { weekending: '', month: '' };
    const monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const jsDay = d.getDay();
    const mondayZero = jsDay === 0 ? 6 : jsDay - 1;
    const thursday = new Date(d);
    if (mondayZero === 4) {
        thursday.setDate(d.getDate() - 1);
    } else {
        thursday.setDate(d.getDate() + ((3 - mondayZero + 7) % 7));
    }
    const mm = String(thursday.getMonth() + 1).padStart(2, '0');
    const dd = String(thursday.getDate()).padStart(2, '0');
    return { weekending: `WE${mm}${dd}`, month: monthNames[d.getMonth()] };
}

function computeClusterTier(overallScoreFraction) {
    if (overallScoreFraction >= 0.95) return 'A';
    if (overallScoreFraction >= 0.90) return 'B';
    if (overallScoreFraction >= 0.80) return 'C';
    return 'D';
}

function computeCmTier(overallScoreFraction) {
    if (overallScoreFraction >= 0.95) return 'SUPERSTAR';
    if (overallScoreFraction >= 0.90) return 'PERFORMER';
    if (overallScoreFraction >= 0.80) return 'LAGGARD';
    return 'UNDERPERFORMER';
}

function computeDerivedScores(out) {
    const mistreat = computeMistreatFlag(out);
    const reliable = anyStrike(out, RELIABLE_COLS) ? 0 : 1;
    const personable = anyStrike(out, PERSONABLE_COLS) ? 0 : 1;
    const fast = computeFastFlag(out);
    const safeSecureRatio = computeSafeSecureRatio(out);
    const safeSecure = mistreat === 0 ? 0 : safeSecureRatio;

    const reliableForOverall = mistreat === 0 ? 0 : reliable;
    const personableForOverall = mistreat === 0 ? 0 : personable;
    const overallScore = (reliableForOverall * 0.45) + (personableForOverall * 0.45) + (fast * 0.05) + (safeSecure * 0.05);

    out['MISTREAT'] = mistreat;
    out['RELIABLE'] = reliable;
    out['PERSONABLE'] = personable;
    out['FAST'] = fast;
    out['SAFE & SECURE'] = safeSecure;
    out['OVERALL SCORE'] = overallScore;
    out['OVERALL PASSRATE'] = overallScore > 0.90 ? 'PASSED' : 'FAILED';
    out['CLUSTER'] = computeClusterTier(overallScore);
    out['CM'] = computeCmTier(overallScore);

    const { weekending, month } = computeWeekendingAndMonth(out['Start time']);
    if (!out['WEEKENDING']) out['WEEKENDING'] = weekending;
    if (!out['MONTH']) out['MONTH'] = month;
}

async function handleDataUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('dataStatus').textContent = 'Processing ' + file.name + '...';

    try {
        const rows = await parseWorkbookFile(file, 'RAW');
        if (!rows.length) throw new Error('empty');

        const headerMap = {};
        NEEDED_FIELDS.forEach(f => {
            const h = findHeader(rows[0], FIELD_HEADER_ALIASES[f] || [f]);
            if (h) headerMap[f] = h;
        });

        const missingFields = NEEDED_FIELDS.filter(f => !headerMap[f]);
        const isRawFormat = !headerMap['OVERALL SCORE'];
        const COMPUTED_FIELDS = ['MISTREAT', 'RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE', 'OVERALL PASSRATE', 'CLUSTER', 'CM', 'WEEKENDING', 'MONTH', 'TEAM LEADER'];
        const missingFieldsToWarn = isRawFormat ? missingFields.filter(f => !COMPUTED_FIELDS.includes(f)) : missingFields;
        if (missingFieldsToWarn.length) {
            console.warn('Columns not found in uploaded file:', missingFieldsToWarn);
        }

        const rosterSnap = await getDocs(collection(db, 'roster'));
        const nameToEmail = {};
        const nameToTeamLeader = {};
        rosterSnap.forEach(d => {
            const data = d.data();
            nameToEmail[normalizeName(data.agentName)] = d.id;
            if (data.teamLeader) nameToTeamLeader[normalizeName(data.agentName)] = data.teamLeader;
        });

        const UPPERCASE_FIELDS = ['FORM TYPE', 'MONTH', 'AGENT TENURE', 'OVERALL PASSRATE', 'CM'];
        const TRIM_ONLY_FIELDS = ['BRAND', 'LINE OF BUSINESS', 'TEAM LEADER', 'CLUSTER', 'WEEKENDING', 'CALL ID / CASE NUMBER', 'WIN ID', 'MIN'];

        const trimmed = rows.map(r => {
            const out = {};
            NEEDED_FIELDS.forEach(f => {
                const h = headerMap[f];
                out[f] = h ? r[h] : '';
            });
            if (!String(out['BRAND'] || '').trim() && out['LINE OF BUSINESS']) {
                out['BRAND'] = out['LINE OF BUSINESS'];
            }
            if (isRawFormat) {
                computeDerivedScores(out);
                if (!out['TEAM LEADER']) {
                    out['TEAM LEADER'] = nameToTeamLeader[normalizeName(out['AGENT/OFFICER NAME'])] || '';
                }
            }
            UPPERCASE_FIELDS.forEach(f => { out[f] = normVal(out[f]); });
            TRIM_ONLY_FIELDS.forEach(f => { out[f] = String(out[f] || '').trim(); });
            out.agentNameKey = normalizeName(out['AGENT/OFFICER NAME']);

            ['RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE'].forEach(k => {
                out[k] = parseScore(out[k]);
            });

            out.agentEmailLower = nameToEmail[normalizeName(out['AGENT/OFFICER NAME'])] || '';
            return out;
        }).filter(r => r['AGENT/OFFICER NAME']);

        const hasIdColumn = !!headerMap['ID'];
        const seenKeys = new Set();
        const deduped = [];
        trimmed.forEach(row => {
            const key = hasIdColumn ? String(row['ID']) : NEEDED_FIELDS.map(f => String(row[f])).join('||');
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
            deduped.push(row);
        });
        const dupCount = trimmed.length - deduped.length;

        await replaceAuditData(deduped);
        await resyncAgentEmails();

        cachedAuditRows = deduped;
        let msg = `✅ ${deduped.length} audit rows loaded${dupCount ? ` (${dupCount} exact duplicate row${dupCount === 1 ? '' : 's'} removed)` : ''}. 🔄 Agent email matching auto-synced.`;
        if (isRawFormat) {
            msg += ` 🧮 Scores computed automatically from the raw export — no manual cleanup needed.`;
        }
        if (missingFieldsToWarn.length) {
            msg += ` ⚠️ ${missingFieldsToWarn.length} expected column(s) missing — check console for details.`;
        }
        document.getElementById('dataStatus').innerHTML = msg;
        populateDropdownOptions(trimmed);
        filterData();
    } catch (err) {
        console.error(err);
        document.getElementById('dataStatus').innerHTML = `⚠️ Could not read this file. Check that it contains expected columns.`;
    }
}

/* ==========================================================================
   SUPERVISOR DASHBOARD — FILTERS + RENDER
   ========================================================================== */
function populateDropdownOptions(rows) {
    const map = {
        selectFormType: 'FORM TYPE',
        selectBrand: 'BRAND',
        selectTenure: 'AGENT TENURE',
        selectTeamLeader: 'TEAM LEADER'
    };
    Object.entries(map).forEach(([selId, field]) => {
        const sel = document.getElementById(selId);
        const current = sel.value;
        const uniques = [...new Set(rows.map(r => r[field]).filter(Boolean))].sort();
        sel.innerHTML = `<option value="ALL">(All)</option>` + uniques.map(v => `<option value="${v}">${v}</option>`).join('');
        if (uniques.includes(current)) sel.value = current;
    });

    const monthSel = document.getElementById('selectMonth');
    const monthCurrent = monthSel.value;
    const monthUniques = [...new Set(rows.map(r => r['MONTH']).filter(Boolean))].sort(compareMonths);
    monthSel.innerHTML = `<option value="ALL">(All Months)</option>` + monthUniques.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (monthUniques.includes(monthCurrent)) monthSel.value = monthCurrent;

    const weekSel = document.getElementById('selectWeekending');
    const weekCurrent = weekSel.value;
    const monthGroups = {};
    rows.forEach(r => {
        const wk = r['WEEKENDING'];
        if (!wk) return;
        const month = r['MONTH'] || 'Unspecified';
        if (!monthGroups[month]) monthGroups[month] = new Set();
        monthGroups[month].add(wk);
    });
    const monthKeys = Object.keys(monthGroups).sort(compareMonths);
    const optgroupsHtml = monthKeys.map(month => {
        const weeks = [...monthGroups[month]].sort();
        const optionsHtml = weeks.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
        return `<optgroup label="${escapeHtml(month)}">${optionsHtml}</optgroup>`;
    }).join('');
    weekSel.innerHTML = `<option value="ALL">(All Weekending)</option>` + optgroupsHtml;
    const allWeeks = [...new Set(rows.map(r => r['WEEKENDING']).filter(Boolean))];
    if (allWeeks.includes(weekCurrent)) weekSel.value = weekCurrent;
}

async function loadAllAuditData() {
    const snap = await getDocs(collection(db, 'auditData'));
    const rows = snap.docs.map(d => d.data());

    try {
        const rosterSnap = await getDocs(collection(db, 'roster'));
        const nameToTeamLeader = {};
        rosterSnap.forEach(d => {
            const data = d.data();
            if (data.teamLeader) nameToTeamLeader[normalizeName(data.agentName)] = data.teamLeader;
        });
        rows.forEach(r => {
            const tl = nameToTeamLeader[normalizeName(r['AGENT/OFFICER NAME'])];
            if (tl) r['TEAM LEADER'] = tl;
        });
    } catch (err) {
        console.warn('Live Team Leader join failed — falling back to stored values.', err);
    }

    cachedAuditRows = rows;
    return cachedAuditRows;
}

function toggleUploadPanel() {
    const panel = document.getElementById('uploadPopover');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

function resetFilters() {
    ['selectFormType', 'selectBrand', 'selectMonth', 'selectWeekending', 'selectTenure', 'selectTeamLeader']
        .forEach(id => { document.getElementById(id).value = 'ALL'; });
    filterData();
}

function filterData() {
    const rows = cachedAuditRows;
    if (!rows.length) return;

    const f = {
        formType: document.getElementById('selectFormType').value,
        brand: document.getElementById('selectBrand').value,
        month: document.getElementById('selectMonth').value,
        weekending: document.getElementById('selectWeekending').value,
        tenure: document.getElementById('selectTenure').value,
        teamLeader: document.getElementById('selectTeamLeader').value
    };

    const filtered = rows.filter(r =>
        (f.formType === 'ALL' || r['FORM TYPE'] === f.formType) &&
        (f.brand === 'ALL' || r['BRAND'] === f.brand) &&
        (f.month === 'ALL' || r['MONTH'] === f.month) &&
        (f.weekending === 'ALL' || r['WEEKENDING'] === f.weekending) &&
        (f.tenure === 'ALL' || r['AGENT TENURE'] === f.tenure) &&
        (f.teamLeader === 'ALL' || r['TEAM LEADER'] === f.teamLeader)
    );

    renderSupervisorDashboard(filtered);
}

function tenureBucket(tenureStr) {
    const t = normVal(tenureStr);
    if (t.includes('NCIP')) return 'ncip';
    if (t.includes('NHIP')) return 'nhip';
    if (t.includes('0-30')) return 'd0';
    if (t.includes('31-60')) return 'd31';
    if (t.includes('61-90')) return 'd61';
    if (t.includes('>91') || t.includes('91')) return 'd91';
    return 'other';
}

/* ==========================================================================
   SCORE PER LOB — Chart.js grouped bar chart
   ========================================================================== */
function renderGroupedBarChart(data) {
    const canvas = document.getElementById('lobChartCanvas');
    if (!canvas) return;

    const groups = {};
    data.forEach(r => {
        const lob = r['BRAND'] || 'Unspecified';
        if (!groups[lob]) groups[lob] = { reliable: [], personable: [], fast: [], safe: [], overall: [] };
        const rel = parseScore(r['RELIABLE']); if (rel !== null) groups[lob].reliable.push(rel);
        const per = parseScore(r['PERSONABLE']); if (per !== null) groups[lob].personable.push(per);
        const fst = parseScore(r['FAST']); if (fst !== null) groups[lob].fast.push(fst);
        const saf = parseScore(r['SAFE & SECURE']); if (saf !== null) groups[lob].safe.push(saf);
        const ovr = parseScore(r['OVERALL SCORE']); if (ovr !== null) groups[lob].overall.push(ovr);
    });

    const labels = Object.keys(groups).sort();
    const getAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    if (lobChartInstance) lobChartInstance.destroy();

    lobChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Reliable', data: labels.map(l => getAvg(groups[l].reliable)), backgroundColor: '#EF9A9A' },
                { label: 'Personable', data: labels.map(l => getAvg(groups[l].personable)), backgroundColor: '#E57373' },
                { label: 'Fast', data: labels.map(l => getAvg(groups[l].fast)), backgroundColor: '#E53935' },
                { label: 'Safe & Secure', data: labels.map(l => getAvg(groups[l].safe)), backgroundColor: '#C62828' },
                { label: 'Overall Score', data: labels.map(l => getAvg(groups[l].overall)), backgroundColor: '#7F0000' }
            ]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20, bottom: 10 } },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, pointStyle: 'rect', padding: 15, font: { size: 10, weight: 'bold' } }
                },
                datalabels: {
                    anchor: 'end', align: 'top', offset: 2,
                    formatter: (val) => val ? val + '%' : '',
                    font: { size: 8, weight: 'bold' }, color: '#333'
                }
            },
            scales: {
                y: { display: false, max: 115 },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9, weight: '600' }, color: '#333', maxRotation: 45, minRotation: 0, autoSkip: false }
                }
            }
        }
    });
}

/* ==========================================================================
   PER-LOB SUMMARY TABLES (Pass Rate / Audit Count / Avg Score by Tenure)
   ========================================================================== */
function renderSummaryTables(data) {
    const passBody = document.getElementById('passRateSummaryBody');
    const auditBody = document.getElementById('auditCountSummaryBody');
    const avgBody = document.getElementById('averageScoreSummaryBody');

    if (!data || !data.length) {
        if (passBody) passBody.innerHTML = '<tr><td colspan="4" class="empty-note">Upload data to populate.</td></tr>';
        if (auditBody) auditBody.innerHTML = '<tr><td colspan="8" class="empty-note">Upload data to populate.</td></tr>';
        if (avgBody) avgBody.innerHTML = '<tr><td colspan="8" class="empty-note">Upload data to populate.</td></tr>';
        return;
    }

    const isPassed = (r) => r['OVERALL PASSRATE'] ? r['OVERALL PASSRATE'] === 'PASSED' : (parseScore(r['OVERALL SCORE']) || 0) > 90;
    const BUCKETS = ['ncip', 'nhip', 'd0', 'd31', 'd61', 'd91'];

    function bucketRows(rows) {
        const b = { ncip: [], nhip: [], d0: [], d31: [], d61: [], d91: [] };
        rows.forEach(r => { const k = tenureBucket(r['AGENT TENURE']); if (b[k]) b[k].push(r); });
        return b;
    }
    function countCell(arr) { return arr.length > 0 ? arr.length : '-'; }
    function avgScore(arr) {
        const vals = arr.map(r => parseScore(r['OVERALL SCORE'])).filter(v => v !== null);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) + '%' : '-';
    }

    const lobMap = {};
    data.forEach(r => {
        const lob = r['BRAND'] || 'Unspecified';
        if (!lobMap[lob]) lobMap[lob] = [];
        lobMap[lob].push(r);
    });
    const lobs = Object.keys(lobMap).sort();

    if (passBody) {
        const lobRows = lobs.map(lob => {
            const rows = lobMap[lob];
            const passed = rows.filter(isPassed).length;
            const pct = Math.round(passed / rows.length * 100);
            return `<tr><td style="text-align:left;">${escapeHtml(lob)}</td><td>${pct}%</td><td>${100 - pct}%</td><td>100%</td></tr>`;
        }).join('');
        const totalPassed = data.filter(isPassed).length;
        const totalPct = Math.round(totalPassed / data.length * 100);
        passBody.innerHTML = lobRows + `<tr class="total-row"><td style="text-align:left;">Grand Total</td><td>${totalPct}%</td><td>${100 - totalPct}%</td><td>100%</td></tr>`;
    }

    if (auditBody) {
        const lobRows = lobs.map(lob => {
            const b = bucketRows(lobMap[lob]);
            return `<tr><td style="text-align:left;">${escapeHtml(lob)}</td>${BUCKETS.map(k => `<td>${countCell(b[k])}</td>`).join('')}<td>${lobMap[lob].length}</td></tr>`;
        }).join('');
        const totalB = bucketRows(data);
        auditBody.innerHTML = lobRows + `<tr class="total-row"><td style="text-align:left;">Grand Total</td>${BUCKETS.map(k => `<td>${countCell(totalB[k])}</td>`).join('')}<td>${data.length}</td></tr>`;
    }

    if (avgBody) {
        const lobRows = lobs.map(lob => {
            const b = bucketRows(lobMap[lob]);
            return `<tr><td style="text-align:left;">${escapeHtml(lob)}</td>${BUCKETS.map(k => `<td>${avgScore(b[k])}</td>`).join('')}<td>${avgScore(lobMap[lob])}</td></tr>`;
        }).join('');
        const totalB = bucketRows(data);
        avgBody.innerHTML = lobRows + `<tr class="total-row"><td style="text-align:left;">Grand Total</td>${BUCKETS.map(k => `<td>${avgScore(totalB[k])}</td>`).join('')}<td>${avgScore(data)}</td></tr>`;
    }
}

function renderSupervisorDashboard(data) {
    renderSummaryTables(data);

    if (!data.length) {
        document.getElementById('cmSuperstarVal').textContent = '-';
        document.getElementById('cmUnderperformerVal').textContent = '-';
        document.getElementById('leaderChart').innerHTML = '<div class="empty-note">No matching data.</div>';
        document.getElementById('topHitsTable').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="empty-note">No matching data.</td></tr>';
        if (lobChartInstance) { lobChartInstance.destroy(); lobChartInstance = null; }
        return;
    }

    renderGroupedBarChart(data);

    // CM Distribution (Superstar vs everything else, matching the reference's 2-column view)
    const cmRows = data.filter(r => r['CM']);
    if (cmRows.length) {
        const superstar = cmRows.filter(r => r['CM'] === 'SUPERSTAR').length;
        document.getElementById('cmSuperstarVal').textContent = Math.round((superstar / cmRows.length) * 100) + '%';
        document.getElementById('cmUnderperformerVal').textContent = Math.round(((cmRows.length - superstar) / cmRows.length) * 100) + '%';
    } else {
        document.getElementById('cmSuperstarVal').textContent = '-';
        document.getElementById('cmUnderperformerVal').textContent = '-';
    }

    // Team leader chart
    const tlScores = {};
    data.forEach(r => {
        const tl = r['TEAM LEADER'] || 'Unassigned';
        if (!tlScores[tl]) tlScores[tl] = { total: 0, count: 0 };
        const sc = parseScore(r['OVERALL SCORE']);
        if (sc !== null) { tlScores[tl].total += sc; tlScores[tl].count++; }
    });
    const leaderChart = document.getElementById('leaderChart');
    leaderChart.innerHTML = Object.entries(tlScores).map(([tl, s]) => {
        const a = s.count ? Math.round(s.total / s.count) : 0;
        return `<div class="horizontal-bar-row">
            <div class="horizontal-label" title="${tl}">${tl}</div>
            <div class="horizontal-bar-container"><div class="horizontal-bar-fill" style="width:${a}%;">${a}%</div></div>
        </div>`;
    }).join('') || '<div class="empty-note">No matching data.</div>';

    // Top hit parameters
    const hitCounts = {};
    data.forEach(r => {
        getRowIssues(r).forEach(issue => {
            const key = issue.label + '||' + issue.category;
            hitCounts[key] = (hitCounts[key] || 0) + 1;
        });
    });
    const sortedHits = Object.entries(hitCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const tbody = document.getElementById('topHitsTable').querySelector('tbody');
    tbody.innerHTML = sortedHits.length
        ? sortedHits.map(([key, count]) => {
            const [label, category] = key.split('||');
            return `<tr><td style="text-align:left;">${escapeHtml(label)}</td><td>${escapeHtml(category)}</td><td>${count}</td></tr>`;
        }).join('')
        : '<tr><td colspan="3" class="empty-note">No parameters flagged in this selection.</td></tr>';
}

/* ==========================================================================
   AGENT VIEW
   ========================================================================== */
async function renderAgentView() {
    document.getElementById('agentWelcomeName').textContent = 'Welcome, ' + (currentSession.agentName || currentSession.email);

    const q = query(collection(db, 'auditData'), where('agentEmailLower', '==', currentSession.email));
    const snap = await getDocs(q);
    const myRows = snap.docs.map(d => d.data());

    if (!myRows.length) {
        document.getElementById('agentEmptyState').style.display = 'block';
        document.getElementById('agentContent').style.display = 'none';
        return;
    }

    document.getElementById('agentEmptyState').style.display = 'none';
    document.getElementById('agentContent').style.display = 'flex';

    const avg = (key) => {
        const vals = myRows.map(r => parseScore(r[key])).filter(v => v !== null);
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    const tiles = [
        { label: 'Reliable', val: avg('RELIABLE') },
        { label: 'Personable', val: avg('PERSONABLE') },
        { label: 'Fast', val: avg('FAST') },
        { label: 'Safe & Secure', val: avg('SAFE & SECURE') },
        { label: 'Overall Score', val: avg('OVERALL SCORE') }
    ];
    document.getElementById('agentScorecard').innerHTML = tiles.map(t =>
        `<div class="score-tile"><div class="num">${t.val === null ? '-' : t.val + '%'}</div><div class="lbl">${t.label}</div></div>`
    ).join('');

    const sorted = [...myRows].sort((a, b) => String(b['WEEKENDING'] || '').localeCompare(String(a['WEEKENDING'] || '')));

    const auditRowHtml = (r) => {
        const issues = getRowIssues(r);
        const score = parseScore(r['OVERALL SCORE']);
        const passed = r['OVERALL PASSRATE'] ? r['OVERALL PASSRATE'] === 'PASSED' : (score !== null && score > 90);
        const tagsHtml = issues.length
            ? issues.map(i => `<span class="tag ${i.category.replace(/\s|&/g, '')}">${escapeHtml(i.label)}</span>`).join('')
            : `<span class="no-issues-note">✓ No parameters flagged on this audit.</span>`;

        const commentFields = [
            { key: 'RELIABLE: ADDITIONAL COMMENTS', label: 'Reliable' },
            { key: 'PERSONABLE: ADDITIONAL COMMENTS', label: 'Personable' },
            { key: 'FAST: ADDITIONAL COMMENTS', label: 'Fast' },
            { key: 'OTHER FACTORS REMARKS', label: 'Other Factors' },
            { key: 'WHAT MATTERS TO THE BUSINESS REMARKS', label: 'Safe & Secure' }
        ];

        const commentsList = commentFields
            .map(item => {
                const val = String(r[item.key] || '').trim();
                if (val && !NON_ISSUE_VALUES.has(val.toUpperCase())) {
                    return `<strong class="comment-label">${escapeHtml(item.label)}:</strong> ${escapeHtml(val)}`;
                }
                return null;
            })
            .filter(Boolean);

        const commentsHtml = commentsList.length
            ? `<div class="audit-comments">${commentsList.map(c => `<p>${c}</p>`).join('')}</div>`
            : '';

        return `<div class="audit-row">
            <div class="audit-head">
                <span>${escapeHtml(r['WEEKENDING'])} · ${escapeHtml(r['FORM TYPE'])} · ${escapeHtml(r['BRAND'])}</span>
                <span class="score-pill ${passed ? 'pass-pill' : 'fail-pill'}">${score === null ? '-' : score + '%'}</span>
            </div>
            <div class="audit-meta">Team Leader: ${escapeHtml(r['TEAM LEADER']) || '—'} · Cluster: ${escapeHtml(r['CLUSTER']) || '—'} · Month: ${escapeHtml(r['MONTH']) || '—'}${r['CALL ID / CASE NUMBER'] ? ` · ${normVal(r['BRAND']) === 'SMART EBG' ? 'Call ID' : 'Case #'}: ${escapeHtml(r['CALL ID / CASE NUMBER'])}` : ''}${r['MIN'] ? ` · ANI: ${escapeHtml(r['MIN'])}` : ''}</div>
            <div>${tagsHtml}</div>
            ${commentsHtml}
        </div>`;
    };

    const groups = {};
    sorted.forEach(r => {
        const m = normVal(r['MONTH']) || 'UNSPECIFIED';
        if (!groups[m]) groups[m] = [];
        groups[m].push(r);
    });

    const orderedMonths = Object.keys(groups).sort((a, b) => {
        const aMax = groups[a].reduce((mx, r) => String(r['WEEKENDING'] || '') > mx ? String(r['WEEKENDING'] || '') : mx, '');
        const bMax = groups[b].reduce((mx, r) => String(r['WEEKENDING'] || '') > mx ? String(r['WEEKENDING'] || '') : mx, '');
        return bMax.localeCompare(aMax);
    });

    document.getElementById('agentAuditList').innerHTML = orderedMonths.map((month, idx) => {
        const rows = groups[month];
        const monthAvg = (() => {
            const vals = rows.map(r => parseScore(r['OVERALL SCORE'])).filter(v => v !== null);
            return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        })();
        return `<details class="month-group" ${idx === 0 ? 'open' : ''}>
            <summary class="month-summary">
                <span>${month} <span class="month-count">(${rows.length} audit${rows.length === 1 ? '' : 's'})</span></span>
                <span class="month-avg">${monthAvg === null ? '' : 'avg ' + monthAvg + '%'}</span>
            </summary>
            <div class="month-body">${rows.map(auditRowHtml).join('')}</div>
        </details>`;
    }).join('');
}

/* ==========================================================================
   FLOATING CARD SYSTEM
   ========================================================================== */
const floatingCards = {}; // id → { overlay, placeholder, originalParent, nextSibling, card }

function floatCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card || floatingCards[cardId]) return;

    const originalParent = card.parentNode;
    const nextSibling = card.nextSibling;
    const title = card.querySelector('h3').textContent.trim().replace(/[⧉]/g, '').trim();
    const rect = card.getBoundingClientRect();

    const placeholder = document.createElement('div');
    placeholder.className = 'card-table-placeholder';
    placeholder.title = 'Click to dock back';
    placeholder.textContent = '↩ ' + title;
    placeholder.onclick = () => dockCard(cardId);
    originalParent.insertBefore(placeholder, card);

    const overlay = document.createElement('div');
    overlay.className = 'float-overlay';
    overlay.style.left = Math.min(rect.left, window.innerWidth - 420) + 'px';
    overlay.style.top = Math.max(rect.top, 60) + 'px';
    overlay.style.width = Math.max(rect.width, 340) + 'px';

    overlay.innerHTML = `
        <div class="float-overlay-header" id="fh-${cardId}">
            <span class="float-overlay-title">${escapeHtml(title)}</span>
            <div class="float-overlay-actions">
                <button class="float-dock-btn" onclick="dockCard('${cardId}')">↩ Dock</button>
                <button class="float-close-btn" onclick="dockCard('${cardId}')" title="Close">✕</button>
            </div>
        </div>
        <div class="float-overlay-body" id="fb-${cardId}"></div>`;

    document.body.appendChild(overlay);

    const body = overlay.querySelector(`#fb-${cardId}`);
    Array.from(card.children).forEach(child => {
        if (child.tagName !== 'H3') body.appendChild(child);
    });

    card.style.display = 'none';
    originalParent.removeChild(card);

    floatingCards[cardId] = { overlay, placeholder, originalParent, nextSibling, card };
    makeDraggable(overlay, overlay.querySelector(`#fh-${cardId}`));
}

function dockCard(cardId) {
    const entry = floatingCards[cardId];
    if (!entry) return;
    const { overlay, placeholder, originalParent, nextSibling, card } = entry;

    const body = overlay.querySelector(`#fb-${cardId}`);
    Array.from(body.children).forEach(child => card.appendChild(child));

    card.style.display = '';
    if (nextSibling && nextSibling.parentNode === originalParent) {
        originalParent.insertBefore(card, nextSibling);
    } else {
        originalParent.appendChild(card);
    }

    overlay.remove();
    placeholder.remove();
    delete floatingCards[cardId];
}

function makeDraggable(el, handle) {
    let startX, startY, startLeft, startTop;
    handle.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(el.style.left) || 0;
        startTop = parseInt(el.style.top) || 0;

        const onMove = e => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = Math.max(0, Math.min(window.innerWidth - 80, startLeft + dx)) + 'px';
            el.style.top = Math.max(0, Math.min(window.innerHeight - 40, startTop + dy)) + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

/* ==========================================================================
   EXPOSE TO WINDOW
   ========================================================================== */
window.handleLogin = handleLogin;
window.logout = logout;
window.filterData = filterData;
window.resetFilters = resetFilters;
window.toggleUploadPanel = toggleUploadPanel;
window.handleRosterUpload = handleRosterUpload;
window.handleDataUpload = handleDataUpload;
window.resyncAgentEmails = resyncAgentEmails;
window.floatCard = floatCard;
window.dockCard = dockCard;

(function prefillLoginEmailFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    if (email) {
        const field = document.getElementById('loginEmail');
        if (field) field.value = email;
        const pwField = document.getElementById('loginPassword');
        if (pwField) pwField.focus();
    }
})();
