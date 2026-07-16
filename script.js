/* ==========================================================================
   FIREBASE
   ========================================================================== */
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    deleteUser,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    doc, getDoc, setDoc, deleteDoc,
    collection, query, where, getDocs, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SUPERVISOR_INVITE_CODE = 'SMART-ADMIN-2026'; // client-side only — fine for a prototype, replace with a Cloud Function check before real use

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

/* ==========================================================================
   SESSION
   Firebase Auth persists the session in the browser by default, so a page
   refresh keeps the user logged in — onAuthStateChanged fires on load.
   ========================================================================== */
let currentSession = null; // { uid, email, role, agentName, agentId }

/* ==========================================================================
   AUTH UI
   ========================================================================== */
function switchAuthTab(which) {
    document.getElementById('tabLogin').classList.toggle('active', which === 'login');
    document.getElementById('tabSignup').classList.toggle('active', which === 'signup');
    document.getElementById('loginPane').style.display = which === 'login' ? 'block' : 'none';
    document.getElementById('signupPane').style.display = which === 'signup' ? 'block' : 'none';
}

let signupRole = 'agent';
function setSignupRole(role) {
    signupRole = role;
    document.getElementById('roleAgentLabel').classList.toggle('checked', role === 'agent');
    document.getElementById('roleSupervisorLabel').classList.toggle('checked', role === 'supervisor');
    document.getElementById('supervisorCodeGroup').style.display = role === 'supervisor' ? 'block' : 'none';
}

function showAuthMsg(elId, text, ok) {
    const el = document.getElementById(elId);
    el.textContent = text;
    el.className = 'auth-msg ' + (ok ? 'ok' : 'error');
}

async function handleSignup() {
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const pw = document.getElementById('signupPassword').value;
    const pw2 = document.getElementById('signupPassword2').value;

    if (!email || !email.includes('@')) return showAuthMsg('signupMsg', 'Enter a valid work email.', false);
    if (pw.length < 6) return showAuthMsg('signupMsg', 'Password must be at least 6 characters.', false);
    if (pw !== pw2) return showAuthMsg('signupMsg', 'Passwords do not match.', false);

    if (signupRole === 'supervisor') {
        const code = document.getElementById('supervisorCode').value.trim();
        if (code !== SUPERVISOR_INVITE_CODE) return showAuthMsg('signupMsg', 'Invalid supervisor invite code.', false);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pw);
            await setDoc(doc(db, 'users', cred.user.uid), { email, role: 'supervisor' });
            showAuthMsg('signupMsg', 'Supervisor account created. You can log in now.', true);
            await signOut(auth);
            setTimeout(() => switchAuthTab('login'), 900);
        } catch (err) {
            showAuthMsg('signupMsg', friendlyAuthError(err), false);
        }
        return;
    }

    // Agent path — account is created first (Firestore rules require being
    // signed in to read the roster), then rolled back if there's no match.
    let cred;
    try {
        cred = await createUserWithEmailAndPassword(auth, email, pw);
    } catch (err) {
        return showAuthMsg('signupMsg', friendlyAuthError(err), false);
    }

    try {
        const rosterSnap = await getDoc(doc(db, 'roster', email));
        if (!rosterSnap.exists()) {
            await deleteUser(cred.user);
            return showAuthMsg('signupMsg', 'This email was not found on the agent roster. Ask your supervisor to add you, then try again.', false);
        }
        const match = rosterSnap.data();

        await setDoc(doc(db, 'users', cred.user.uid), {
            email,
            role: 'agent',
            agentName: match.agentName,
            agentId: match.agentId || ''
        });
        showAuthMsg('signupMsg', `Account created and matched to "${match.agentName}". You can log in now.`, true);
        await signOut(auth);
        setTimeout(() => switchAuthTab('login'), 900);
    } catch (err) {
        // best-effort cleanup so a failed signup doesn't leave an orphaned auth account
        try { await deleteUser(cred.user); } catch (e2) {}
        showAuthMsg('signupMsg', friendlyAuthError(err), false);
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pw = document.getElementById('loginPassword').value;
    if (!email || !pw) return showAuthMsg('loginMsg', 'Enter your email and password.', false);

    try {
        await signInWithEmailAndPassword(auth, email, pw);
        // onAuthStateChanged picks this up and calls enterApp()
    } catch (err) {
        showAuthMsg('loginMsg', friendlyAuthError(err), false);
    }
}

function logout() {
    signOut(auth);
}

function friendlyAuthError(err) {
    const code = err && err.code ? err.code : '';
    if (code.includes('email-already-in-use')) return 'An account with this email already exists. Try logging in.';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Incorrect email or password.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    return 'Something went wrong: ' + (err && err.message ? err.message : 'please try again.');
}

/* Fires on load (if a session exists) and after every login/logout */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentSession = null;
        document.getElementById('appScreen').style.display = 'none';
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('sessionChip').style.display = 'none';
        return;
    }

    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (!profileSnap.exists()) {
        // profile doc missing (shouldn't normally happen) — bail back to login
        await signOut(auth);
        return;
    }
    currentSession = { uid: user.uid, ...profileSnap.data() };
    await enterApp();
});

async function enterApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'flex';
    document.getElementById('sessionChip').style.display = 'flex';
    document.getElementById('sessionLabel').textContent =
        (currentSession.role === 'supervisor' ? '👤 Supervisor · ' : '👤 Agent · ') + currentSession.email;

    const isSupervisor = currentSession.role === 'supervisor';
    document.getElementById('supervisorSidebar').style.display = isSupervisor ? 'flex' : 'none';
    document.getElementById('supervisorView').style.display = isSupervisor ? 'flex' : 'none';
    document.getElementById('agentView').style.display = isSupervisor ? 'none' : 'flex';

    if (isSupervisor) {
        await refreshRosterStatus();
        const rows = await loadAllAuditData();
        if (rows.length) {
            document.getElementById('dataStatus').innerHTML = `✅ ${rows.length} audit rows loaded.`;
            populateDropdownOptions(rows);
            filterData();
        }
    } else {
        await renderAgentView();
    }
}

/* ==========================================================================
   HIT-PARAMETER CONFIG
   Maps raw audit columns to plain-language "what was flagged" descriptions.
   hitValue = the value in that column that counts as a miss/flag.
   ========================================================================== */
const HIT_PARAMS = [
    { col: 'IRRELEVANT SOLUTION', category: 'Reliable', label: 'Irrelevant solution given', hitValue: 'YES' },
    { col: 'INCOMPLETE SOLUTION', category: 'Reliable', label: 'Incomplete solution given', hitValue: 'YES' },
    { col: 'UNTIMELY SOLUTION ( ZTP)', category: 'Reliable', label: 'Untimely solution (ZTP)', hitValue: 'YES' },
    { col: 'UNCLEAR SOLUTION', category: 'Reliable', label: 'Unclear solution given', hitValue: 'YES' },
    { col: 'Poor Listening Skills?', category: 'Personable', label: 'Poor listening skills', hitValue: 'YES' },
    { col: 'Customer Validation and Empathy Gap?', category: 'Personable', label: 'Empathy / validation gap', hitValue: 'YES' },
    { col: 'Did not adjust the tone/pace to match the customer?', category: 'Personable', label: 'Tone/pace not matched to customer', hitValue: 'YES' },
    { col: 'Did not adjust to the customers language?', category: 'Personable', label: 'Language not adjusted to customer', hitValue: 'YES' },
    { col: 'Negative Words, Phrasing and Limitations?', category: 'Personable', label: 'Negative words / phrasing used', hitValue: 'YES' },
    { col: 'Unfriendly/discourteous/sarcastic?', category: 'Personable', label: 'Unfriendly, discourteous, or sarcastic tone', hitValue: 'YES' },
    { col: 'Sounded transactional or robotic?', category: 'Personable', label: 'Sounded transactional or robotic', hitValue: 'YES' },
    { col: 'FAST: Were there other Agent factors observed that affected the customer experience?', category: 'Fast', label: 'Other agent factor slowed the resolution', hitValue: 'YES' },
    { col: 'DID WE FOLLOW THE CUSTOMER AUTHENTICATION PROCESS?', category: 'Safe & Secure', label: 'Customer authentication process missed', hitValue: 'NO' },
    { col: 'DID WE FOLLOW THE DATA PRIVACY POLICY?', category: 'Safe & Secure', label: 'Data privacy policy not followed', hitValue: 'NO' },
    { col: 'DID WE UPDATE THE CUSTOMER INFORMATION IN THE TOOL?', category: 'Safe & Secure', label: 'Customer info not updated in tool', hitValue: 'NO' },
    { col: 'DID WE FOLLOW THE CSAT/NPS PROCESS?', category: 'Safe & Secure', label: 'CSAT/NPS process not followed', hitValue: 'NO' },
    { col: 'DID WE FOLLOW THE SYSTEM DOCUMENTATION PROCESS?', category: 'Safe & Secure', label: 'System documentation process missed', hitValue: 'NO' },
    { col: 'DID WE FOLLOW THE SYSTEM TAGGING PROCESS?', category: 'Safe & Secure', label: 'System tagging process missed', hitValue: 'NO' },
    { col: 'DID WE FOLLOW CORRECT GRAMMAR, TECHNICAL WRITING & THE PRESCRIBED LANGUAGE?', category: 'Safe & Secure', label: 'Grammar / prescribed language standard missed', hitValue: 'NO' },
    { col: "IS THIS A POTENTIAL CUSTOMER MISTREAT?", category: 'Mistreat', label: 'Potential customer mistreat flagged', hitValue: 'YES' }
];

function normVal(v) {
    return (v === undefined || v === null) ? '' : String(v).trim().toUpperCase();
}

function getRowIssues(row) {
    const issues = [];
    HIT_PARAMS.forEach(p => {
        const v = normVal(row[p.col]);
        if (v && v === p.hitValue) {
            issues.push({ label: p.label, category: p.category });
        }
    });
    return issues;
}

/* ==========================================================================
   FILE PARSING (SheetJS handles both CSV and XLSX)
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
    // fallback: partial match
    for (const cand of candidates) {
        const hit = keys.find(k => k.trim().toLowerCase().includes(cand.toLowerCase()));
        if (hit) return hit;
    }
    return null;
}

/* ==========================================================================
   ROSTER UPLOAD (Supervisor)
   ========================================================================== */
async function handleRosterUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('rosterStatus').textContent = 'Processing ' + file.name + '...';

    try {
        const rows = await parseWorkbookFile(file);
        if (!rows.length) throw new Error('empty');

        const emailKey = findHeader(rows[0], ['Email', 'Work Email']);
        const nameKey = findHeader(rows[0], ['Agent Name', 'AGENT/OFFICER NAME', 'Name']);
        const idKey = findHeader(rows[0], ['ID', 'Employee ID', 'EE number/ID number', 'Agent ID']);

        if (!emailKey || !nameKey) throw new Error('missing columns');

        const roster = rows
            .map(r => ({
                email: String(r[emailKey] || '').trim().toLowerCase(),
                agentName: String(r[nameKey] || '').trim(),
                agentId: idKey ? String(r[idKey] || '').trim() : ''
            }))
            .filter(r => r.email && r.agentName);

        await clearCollection('roster');
        await batchWriteDocs('roster', roster, (r) => r.email);

        document.getElementById('rosterStatus').innerHTML = `✅ Roster loaded: ${roster.length} agents matched to emails.`;
    } catch (err) {
        console.error(err);
        document.getElementById('rosterStatus').innerHTML =
            `⚠️ Could not read roster. Expect columns: Email, Agent Name, ID.`;
    }
}

async function refreshRosterStatus() {
    const snap = await getDocs(collection(db, 'roster'));
    if (snap.size) {
        document.getElementById('rosterStatus').innerHTML = `✅ Roster loaded: ${snap.size} agents.`;
    }
}

/* ==========================================================================
   RAW AUDIT DATA UPLOAD (Supervisor)
   ========================================================================== */
const NEEDED_FIELDS = [
    'FORM TYPE', 'BRAND', 'LINE OF BUSINESS', 'AGENT/OFFICER NAME', 'AGENT TENURE',
    'TEAM LEADER', 'CLUSTER', 'WEEKENDING', 'MONTH', 'MISTREAT',
    'RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE',
    'EE number/ID number'
].concat(HIT_PARAMS.map(p => p.col));

async function handleDataUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('dataStatus').textContent = 'Processing ' + file.name + '...';

    try {
        const rows = await parseWorkbookFile(file, 'RAW');
        if (!rows.length) throw new Error('empty');

        const headerMap = {};
        NEEDED_FIELDS.forEach(f => {
            const h = findHeader(rows[0], [f]);
            if (h) headerMap[f] = h;
        });

        // build a name -> email lookup from the roster so each audit row can be
        // matched back to the agent's login email (needed for the agent's own query)
        const rosterSnap = await getDocs(collection(db, 'roster'));
        const nameToEmail = {};
        rosterSnap.forEach(d => {
            const data = d.data();
            nameToEmail[(data.agentName || '').trim().toLowerCase()] = d.id;
        });

        const trimmed = rows.map(r => {
            const out = {};
            NEEDED_FIELDS.forEach(f => {
                const h = headerMap[f];
                out[f] = h ? r[h] : '';
            });
            // normalize scores to 0-100 numbers (source is a 0-1 fraction)
            ['RELIABLE', 'PERSONABLE', 'FAST', 'SAFE & SECURE', 'OVERALL SCORE'].forEach(k => {
                const n = parseFloat(out[k]);
                out[k] = isNaN(n) ? null : (n <= 1 ? n * 100 : n);
            });
            out.agentEmailLower = nameToEmail[String(out['AGENT/OFFICER NAME'] || '').trim().toLowerCase()] || '';
            return out;
        }).filter(r => r['AGENT/OFFICER NAME']);

        await clearCollection('auditData');
        await batchWriteDocs('auditData', trimmed);

        document.getElementById('dataStatus').innerHTML = `✅ ${trimmed.length} audit rows loaded.`;
        populateDropdownOptions(trimmed);
        filterData();
    } catch (err) {
        console.error(err);
        document.getElementById('dataStatus').innerHTML = `⚠️ Could not read this file. Check that it contains the expected audit columns.`;
    }
}

/* ==========================================================================
   SUPERVISOR DASHBOARD — FILTERS + RENDER
   ========================================================================== */
function populateDropdownOptions(rows) {
    const map = {
        selectFormType: 'FORM TYPE',
        selectBrand: 'BRAND',
        selectMonth: 'MONTH',
        selectWeekending: 'WEEKENDING',
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
}

async function loadAllAuditData() {
    const snap = await getDocs(collection(db, 'auditData'));
    return snap.docs.map(d => d.data());
}

async function filterData() {
    const rows = await loadAllAuditData();
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
    if (t.includes('0-30')) return 'b1';
    if (t.includes('31-60') || t.includes('61-90') || t.includes('31-90')) return 'b2';
    return 'b3';
}

function renderSupervisorDashboard(data) {
    if (!data.length) {
        document.getElementById('totalPassRateVal').textContent = '-';
        document.getElementById('totalFailRateVal').textContent = '-';
        document.getElementById('leaderChart').innerHTML = '<div class="empty-note">No matching data.</div>';
        document.getElementById('clusterChart').innerHTML = '<div class="empty-note">No matching data.</div>';
        document.getElementById('topHitsTable').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="empty-note">No matching data.</td></tr>';
        return;
    }

    const avg = (key) => {
        const vals = data.map(r => r[key]).filter(v => v !== null && v !== undefined && !isNaN(v));
        if (!vals.length) return null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    const avgReliable = avg('RELIABLE'), avgPersonable = avg('PERSONABLE'), avgFast = avg('FAST'),
          avgSecure = avg('SAFE & SECURE'), avgOverall = avg('OVERALL SCORE');

    const setBar = (valId, barId, val) => {
        document.getElementById(valId).textContent = val === null ? '-' : val + '%';
        document.getElementById(barId).style.height = (val || 0) + '%';
    };
    setBar('valReliable', 'barReliable', avgReliable);
    setBar('valPersonable', 'barPersonable', avgPersonable);
    setBar('valFast', 'barFast', avgFast);
    setBar('valSecure', 'barSecure', avgSecure);
    setBar('valOverall', 'barOverall', avgOverall);

    const passed = data.filter(r => (r['OVERALL SCORE'] || 0) >= 85).length;
    const passPct = Math.round((passed / data.length) * 100);
    document.getElementById('totalPassRateVal').textContent = passPct + '%';
    document.getElementById('totalFailRateVal').textContent = (100 - passPct) + '%';

    const buckets = { b1: [], b2: [], b3: [] };
    data.forEach(r => buckets[tenureBucket(r['AGENT TENURE'])].push(r));
    const bucketAvg = (arr) => {
        const vals = arr.map(r => r['OVERALL SCORE']).filter(v => v !== null && v !== undefined && !isNaN(v));
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) + '%' : '-';
    };
    document.getElementById('totalAuditNhip').textContent = buckets.b1.length || '-';
    document.getElementById('totalAudit31').textContent = buckets.b2.length || '-';
    document.getElementById('totalAudit91').textContent = buckets.b3.length || '-';
    document.getElementById('totalAuditTotal').textContent = data.length;
    document.getElementById('totalAvgNhip').textContent = bucketAvg(buckets.b1);
    document.getElementById('totalAvg31').textContent = bucketAvg(buckets.b2);
    document.getElementById('totalAvg91').textContent = bucketAvg(buckets.b3);
    document.getElementById('totalAvgTotal').textContent = avgOverall === null ? '-' : avgOverall + '%';

    // Team leader chart
    const tlScores = {};
    data.forEach(r => {
        const tl = r['TEAM LEADER'] || 'Unassigned';
        if (!tlScores[tl]) tlScores[tl] = { total: 0, count: 0 };
        if (r['OVERALL SCORE'] !== null) { tlScores[tl].total += r['OVERALL SCORE']; tlScores[tl].count++; }
    });
    const leaderChart = document.getElementById('leaderChart');
    leaderChart.innerHTML = Object.entries(tlScores).map(([tl, s]) => {
        const a = s.count ? Math.round(s.total / s.count) : 0;
        return `<div class="horizontal-bar-row">
            <div class="horizontal-label" title="${tl}">${tl}</div>
            <div class="horizontal-bar-container"><div class="horizontal-bar-fill" style="width:${a}%;">${a}%</div></div>
        </div>`;
    }).join('') || '<div class="empty-note">No matching data.</div>';

    // Cluster chart
    const clusterScores = {};
    data.forEach(r => {
        const c = r['CLUSTER'] || 'Unassigned';
        if (!clusterScores[c]) clusterScores[c] = { total: 0, count: 0 };
        if (r['OVERALL SCORE'] !== null) { clusterScores[c].total += r['OVERALL SCORE']; clusterScores[c].count++; }
    });
    const clusterChart = document.getElementById('clusterChart');
    clusterChart.innerHTML = Object.entries(clusterScores).map(([c, s]) => {
        const a = s.count ? Math.round(s.total / s.count) : 0;
        return `<div class="horizontal-bar-row">
            <div class="horizontal-label" title="${c}">${c}</div>
            <div class="horizontal-bar-container"><div class="horizontal-bar-fill" style="width:${a}%; background:#832076;">${a}%</div></div>
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
            return `<tr><td style="text-align:left;">${label}</td><td>${category}</td><td>${count}</td></tr>`;
        }).join('')
        : '<tr><td colspan="3" class="empty-note">No parameters flagged in this selection.</td></tr>';
}

/* ==========================================================================
   AGENT VIEW
   ========================================================================== */
async function renderAgentView() {
    document.getElementById('agentWelcomeName').textContent = 'Welcome, ' + (currentSession.agentName || currentSession.email);

    // Firestore security rules restrict this query to the signed-in agent's own rows
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
        const vals = myRows.map(r => r[key]).filter(v => v !== null && v !== undefined && !isNaN(v));
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

    document.getElementById('agentAuditList').innerHTML = sorted.map(r => {
        const issues = getRowIssues(r);
        const score = r['OVERALL SCORE'];
        const passed = score !== null && score >= 85;
        const tagsHtml = issues.length
            ? issues.map(i => `<span class="tag ${i.category.replace(/\s|&/g, '')}">${i.label}</span>`).join('')
            : `<span class="no-issues-note">✓ No parameters flagged on this audit.</span>`;

        return `<div class="audit-row">
            <div class="audit-head">
                <span>${r['WEEKENDING'] || ''} · ${r['FORM TYPE'] || ''} · ${r['BRAND'] || ''}</span>
                <span class="score-pill ${passed ? 'pass-pill' : 'fail-pill'}">${score === null ? '-' : score + '%'}</span>
            </div>
            <div class="audit-meta">Team Leader: ${r['TEAM LEADER'] || '—'} · Cluster: ${r['CLUSTER'] || '—'} · Month: ${r['MONTH'] || '—'}</div>
            <div>${tagsHtml}</div>
        </div>`;
    }).join('');
}

/* ==========================================================================
   EXPOSE TO WINDOW
   Needed because this file is an ES module (module scope), but the HTML
   still calls these via inline onclick/onchange attributes.
   ========================================================================== */
window.switchAuthTab = switchAuthTab;
window.setSignupRole = setSignupRole;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.logout = logout;
window.filterData = filterData;
window.handleRosterUpload = handleRosterUpload;
window.handleDataUpload = handleDataUpload;

/* ==========================================================================
   INIT
   ========================================================================== */
setSignupRole('agent');
