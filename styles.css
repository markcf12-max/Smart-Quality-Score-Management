:root {
    --smart-green-dark: #005A2B;
    --smart-green-mid: #0c6231;
    --smart-green-light: #5cb85c;
    --slicer-bg: #e2f0d9;
    --slicer-border: #a9d08e;
    --bg-beige: #f3e6dc;
    --card-border: #f8cbad;
    --dark-gray: #333333;
    --gold: #ffcc00;
    --danger: #b3261e;
    --danger-bg: #fbeceb;
}

* { box-sizing: border-box; }

body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: var(--bg-beige);
    color: var(--dark-gray);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ============ HEADER ============ */
.header-banner {
    background-color: var(--smart-green-dark);
    color: white;
    padding: 8px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid var(--gold);
    height: 60px;
    flex-shrink: 0;
}

.header-left { display: flex; align-items: center; gap: 15px; }

.header-logo {
    background: #fff;
    color: var(--smart-green-dark);
    font-weight: 900;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    letter-spacing: 0.2px;
}

.header-title { text-align: center; flex-grow: 1; }
.header-title h1 { margin: 0; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; }
.header-title p { margin: 2px 0 0 0; font-size: 10px; letter-spacing: 2px; opacity: 0.9; }

.header-right { display: flex; align-items: center; gap: 14px; font-size: 12px; }
.header-right .brand-tag { font-weight: bold; color: var(--gold); }
.btn-switch-site {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.12);
    border: 1px solid var(--gold);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-switch-site:hover { background: var(--gold); color: var(--smart-green-dark); }
.session-chip {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.3);
    padding: 5px 10px;
    border-radius: 14px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.btn-logout {
    background: transparent;
    border: 1px solid var(--gold);
    color: var(--gold);
    padding: 4px 10px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
}
.btn-logout:hover { background: var(--gold); color: var(--smart-green-dark); }

/* ============ AUTH SCREEN ============ */
.auth-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 16px;
}

.auth-card {
    background: white;
    width: 100%;
    max-width: 420px;
    border-radius: 6px;
    border: 1px solid var(--card-border);
    box-shadow: 0 4px 18px rgba(0,0,0,0.08);
    overflow: hidden;
}

.auth-tabs { display: flex; }
.auth-tab {
    flex: 1;
    text-align: center;
    padding: 12px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    background: #f2f2f2;
    color: #777;
    border-bottom: 3px solid transparent;
}
.auth-tab.active {
    background: white;
    color: var(--smart-green-dark);
    border-bottom-color: var(--smart-green-dark);
}

.auth-body { padding: 24px; }
.auth-body h2 { margin: 0 0 4px 0; font-size: 18px; color: var(--smart-green-dark); }
.auth-body .sub { margin: 0 0 18px 0; font-size: 11.5px; color: #777; line-height: 1.5; }

.form-group { margin-bottom: 14px; }
.form-group label {
    display: block;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 5px;
    letter-spacing: 0.4px;
}
.form-group input, .form-group select {
    width: 100%;
    padding: 9px 10px;
    font-size: 13px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
}
.form-group input:focus, .form-group select:focus {
    outline: none;
    border-color: var(--smart-green-dark);
}

.role-toggle { display: flex; gap: 8px; margin-bottom: 14px; }
.role-toggle label {
    flex: 1;
    text-align: center;
    padding: 9px 6px;
    font-size: 11px;
    font-weight: bold;
    border: 1px solid var(--slicer-border);
    background: var(--slicer-bg);
    color: #2c5c2d;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
}
.role-toggle input { display: none; }
.role-toggle label.checked {
    background: var(--smart-green-dark);
    color: white;
    border-color: var(--smart-green-dark);
}

.btn-primary {
    width: 100%;
    background: var(--smart-green-dark);
    color: white;
    border: none;
    padding: 11px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
}
.btn-primary:hover { background: var(--smart-green-mid); }
.btn-primary:disabled { background: #aaa; cursor: not-allowed; }

.auth-msg {
    margin-top: 12px;
    font-size: 11.5px;
    padding: 8px 10px;
    border-radius: 4px;
    display: none;
}
.auth-msg.error { display: block; background: var(--danger-bg); color: var(--danger); border: 1px solid #f3c6c3; }
.auth-msg.ok { display: block; background: #e7f5ea; color: var(--smart-green-dark); border: 1px solid var(--slicer-border); }

.auth-hint {
    margin-top: 16px;
    font-size: 10.5px;
    color: #999;
    line-height: 1.5;
    border-top: 1px dashed #ddd;
    padding-top: 12px;
}

.field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* ============ APP BODY ============ */
.app-body { display: flex; flex: 1; overflow: hidden; }
#appScreen { display: none; flex: 1; flex-direction: column; }

/* SIDEBAR / SLICERS */
.sidebar {
    width: 250px;
    background-color: var(--bg-beige);
    border-right: 2px solid #d9c5b2;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
}

/* Position Data Button on the Left */
.sidebar-top-row { display: flex; justify-content: flex-start; margin-top: 4px; }
.upload-icon-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: white;
    border: 1px solid #e5ddd3;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    color: var(--smart-green-dark);
    transition: background 0.15s ease, box-shadow 0.15s ease;
}
.upload-icon-btn:hover { background: var(--slicer-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.upload-icon-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--smart-green-dark); }

.upload-popover {
    flex-direction: column;
    gap: 10px;
    background: white;
    border: 1px solid #e5ddd3;
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}

.filters-panel {
    background: white;
    border: 1px solid #e5ddd3;
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.filters-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
    font-weight: 800;
    color: var(--smart-green-dark);
    letter-spacing: 0.3px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f0ece6;
}
.filters-reset {
    background: none;
    border: none;
    font-size: 10.5px;
    font-weight: 700;
    color: #999;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;
}
.filters-reset:hover { color: var(--smart-green-dark); background: var(--slicer-bg); }

.filter-field { display: flex; flex-direction: column; gap: 5px; }
.filter-field label {
    font-size: 9.5px;
    font-weight: 700;
    color: #8a8a8a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.select-wrap { position: relative; }
.select-wrap::after {
    content: '';
    position: absolute;
    right: 11px;
    top: 50%;
    width: 7px;
    height: 7px;
    border-right: 2px solid var(--smart-green-mid);
    border-bottom: 2px solid var(--smart-green-mid);
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
}
.select-wrap select {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    padding: 8px 30px 8px 10px;
    font-size: 11.5px;
    font-family: inherit;
    font-weight: 600;
    color: #2c5c2d;
    background-color: var(--slicer-bg);
    border: 1.5px solid transparent;
    border-radius: 7px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}
.select-wrap select:hover { background-color: #d9ecd0; }
.select-wrap select:focus {
    border-color: var(--smart-green-dark);
    background-color: #fff;
    box-shadow: 0 0 0 3px rgba(0,90,43,0.12);
}

.upload-section {
    border: 2px dashed var(--smart-green-mid);
    background-color: white;
    padding: 12px;
    text-align: center;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.upload-section h4 { margin: 0; font-size: 11px; color: var(--smart-green-dark); text-transform: uppercase; }
.upload-btn-wrapper { position: relative; overflow: hidden; display: inline-block; }
.btn-upload {
    border: 1px solid #a9d08e;
    color: white;
    background-color: var(--smart-green-dark);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    display: block;
    width: 100%;
}
.upload-btn-wrapper input[type=file] {
    font-size: 100px;
    position: absolute;
    left: 0; top: 0;
    opacity: 0;
    cursor: pointer;
}
.file-status { font-size: 9px; color: #555; word-break: break-all; }

/* DASHBOARD CANVAS */
.dashboard-canvas {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.tables-grid { display: grid; grid-template-columns: 0.7fr 1.4fr 1.4fr 0.5fr; gap: 12px; min-width: 0; }

.my-team-card { margin-top: 16px; }

.card-table {
    background-color: white;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
}
.card-table h3 {
    margin: 0;
    font-size: 11.5px;
    font-weight: 800;
    color: #333;
    text-align: center;
    background-color: #fce4d6;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #f8cbad;
    letter-spacing: 0.3px;
    text-transform: uppercase;
}

/* Scrollable table wrapper with nav arrows */
.table-scroll-wrap { display: flex; align-items: center; gap: 4px; min-width: 0; width: 100%; }
.table-scroll-inner {
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--card-border) transparent;
}
.table-scroll-inner::-webkit-scrollbar { height: 4px; }
.table-scroll-inner::-webkit-scrollbar-track { background: transparent; }
.table-scroll-inner::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 4px; }
.scroll-btn {
    flex-shrink: 0;
    background: white;
    border: 1px solid var(--card-border);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    color: var(--smart-green-dark);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    transition: background 0.15s;
    user-select: none;
}
.scroll-btn:hover { background: var(--slicer-bg); }

.excel-table { border-collapse: collapse; font-size: 10px; text-align: center; }
.excel-table th {
    background-color: #fce4d6;
    color: #555;
    font-weight: 700;
    padding: 5px 8px;
    border-bottom: 2px solid var(--card-border);
    white-space: nowrap;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
.excel-table td { border-bottom: 1px solid #f5f5f5; padding: 5px 8px; color: #444; white-space: nowrap; }
.excel-table tbody tr:hover td { background: #fff8f5; }
.excel-table tr.total-row td {
    font-weight: 800;
    color: var(--smart-green-dark);
    background-color: #fce4d6;
    border-top: 1.5px solid var(--card-border);
    border-bottom: none;
}

.summary-detail-table { white-space: nowrap; }
.summary-detail-table th:first-child,
.summary-detail-table td:first-child { text-align: left; min-width: 150px; font-weight: 600; }
.summary-detail-table td:first-child { color: #555; font-weight: 500; }
.summary-detail-table tr.total-row td:first-child { color: var(--smart-green-dark); }

.charts-row-1 { display: grid; grid-template-columns: 1.8fr 1fr; gap: 16px; }

.chart-box {
    background-color: white;
    border: 1px solid var(--card-border);
    border-radius: 4px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    min-height: 380px;
    position: relative;
}
.charts-row-1 .chart-box { height: 380px; }
.chart-title {
    font-size: 11px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 1px solid #eee;
    padding-bottom: 4px;
    text-transform: uppercase;
    color: #333;
}

/* Score per LOB — Chart.js canvas wrapper */
.chart-canvas-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    height: 280px;
}

.horizontal-chart { display: flex; flex-direction: column; gap: 12px; flex: 1; overflow-y: auto; max-height: 320px; padding-top: 5px; }
.horizontal-bar-row { display: flex; align-items: center; font-size: 10px; }
.horizontal-label { width: 120px; font-size: 9px; color: #444; text-align: right; padding-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.horizontal-bar-container { flex: 1; background-color: #f0f0f0; height: 34px; border-radius: 2px; position: relative; }
.horizontal-bar-fill {
    background-color: #0f587d;
    height: 100%;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    color: white;
    font-weight: bold;
    font-size: 10px;
    transition: width 0.4s ease;
}

.hitlist-table td.reason-cell { text-align: left; font-size: 9.5px; }
.tag {
    display: inline-block;
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 10px;
    margin: 1px 3px 1px 0;
    color: white;
    white-space: nowrap;
}
.tag.Reliable { background: #f0c4c9; color: #7a0f1e; }
.tag.Personable { background: #e6e6e6; color: #2b2b2b; }
.tag.Fast { background: #7a0f1e; }
.tag.Safe.Secure, .tag.SafeSecure { background: #1a1a1a; }
.tag.Mistreat { background: var(--danger); }

.empty-note { font-size: 11px; color: #999; text-align: center; padding: 20px; }

/* ============ AGENT VIEW ============ */
#agentView { flex: 1; overflow-y: auto; padding: 20px 24px; display: none; flex-direction: column; gap: 16px; }

.agent-welcome { background: white; border: 1px solid var(--card-border); border-radius: 6px; padding: 16px 20px; }
.agent-welcome h2 { margin: 0 0 4px 0; color: var(--smart-green-dark); font-size: 20px; }
.agent-welcome p { margin: 0; font-size: 12px; color: #777; }

.scorecard-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.score-tile {
    background: white;
    border: 1px solid var(--card-border);
    border-radius: 6px;
    padding: 16px 10px;
    text-align: center;
}
.score-tile .num { font-size: 26px; font-weight: 900; color: var(--smart-green-dark); }
.score-tile .lbl { font-size: 10px; color: #777; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.4px; }

.agent-section { background: white; border: 1px solid var(--card-border); border-radius: 6px; padding: 16px 20px; }
.agent-section h3 { margin: 0 0 12px 0; font-size: 13px; color: #333; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 8px; }

.month-group { border: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
.month-group[open] { border-color: var(--slicer-border); }
.month-summary {
    list-style: none;
    cursor: pointer;
    padding: 10px 14px;
    background: #f7f7f5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: bold;
    color: var(--smart-green-dark);
    text-transform: uppercase;
    letter-spacing: 0.4px;
}
.month-summary::-webkit-details-marker { display: none; }
.month-summary::before {
    content: '▸';
    display: inline-block;
    margin-right: 8px;
    transition: transform 0.15s ease;
    font-size: 10px;
}
.month-group[open] .month-summary::before { transform: rotate(90deg); }
.month-count { font-weight: normal; color: #888; text-transform: none; font-size: 10.5px; }
.month-avg { font-weight: normal; color: #888; text-transform: none; font-size: 10.5px; }
.month-body { padding: 12px 14px; }
.month-body .audit-row:last-child { margin-bottom: 0; }

.audit-row {
    border: 1px solid #eee;
    border-radius: 5px;
    padding: 10px 12px;
    margin-bottom: 10px;
}
.audit-row .audit-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: bold;
    color: #333;
    margin-bottom: 6px;
}
.audit-row .audit-head .score-pill {
    padding: 2px 9px;
    border-radius: 12px;
    font-size: 11px;
    color: white;
}
.pass-pill { background: var(--smart-green-dark); }
.fail-pill { background: var(--danger); }
.audit-meta { font-size: 10px; color: #888; margin-bottom: 6px; }
.no-issues-note { font-size: 10.5px; color: var(--smart-green-mid); font-style: italic; }
.audit-comments {
    margin-top: 8px;
    padding: 8px 10px;
    background: #faf7f4;
    border-left: 3px solid var(--card-border);
    border-radius: 3px;
}
.audit-comments p { margin: 0 0 4px 0; font-size: 10.5px; color: #666; line-height: 1.5; }
.audit-comments p:last-child { margin-bottom: 0; }
.comment-label {
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--danger);
    display: block;
    margin-bottom: 2px;
}

.empty-agent-data { text-align: center; padding: 40px 20px; color: #999; font-size: 12px; }

footer.disclaimer {
    font-size: 9.5px;
    color: #999;
    text-align: center;
    padding: 6px;
    background: #fff;
    border-top: 1px solid #eee;
}

/* ============ FLOATING CARD ============ */
.float-btn {
    float: right;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--smart-green-mid);
    opacity: 0.5;
    padding: 0 2px;
    line-height: 1;
    transition: opacity 0.15s;
    margin-top: -1px;
}
.float-btn:hover { opacity: 1; }

.float-overlay {
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1.5px solid var(--card-border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    min-width: 320px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    resize: both;
}

.float-overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #fce4d6;
    border-bottom: 1px solid var(--card-border);
    cursor: grab;
    user-select: none;
    gap: 8px;
    flex-shrink: 0;
}
.float-overlay-header:active { cursor: grabbing; }

.float-overlay-title {
    font-size: 11px;
    font-weight: 800;
    color: var(--smart-green-dark);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex: 1;
}

.float-overlay-actions { display: flex; gap: 6px; align-items: center; }

.float-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #999;
    line-height: 1;
    padding: 0 2px;
    transition: color 0.15s;
}
.float-close-btn:hover { color: var(--danger); }

.float-dock-btn {
    background: none;
    border: 1px solid var(--card-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
    color: var(--smart-green-mid);
    padding: 2px 6px;
    font-weight: 700;
    transition: background 0.15s;
}
.float-dock-btn:hover { background: var(--slicer-bg); }

.float-overlay-body {
    flex: 1;
    overflow: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.card-table-placeholder {
    border: 2px dashed var(--card-border);
    border-radius: 8px;
    background: #fdfafa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #ccc;
    min-height: 80px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
}
.card-table-placeholder:hover { border-color: var(--smart-green-mid); color: var(--smart-green-mid); }
