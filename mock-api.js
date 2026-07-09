/**
 * GitHub Pages Demo 版：瀏覽器內模擬後端 API
 * 攔截 fetch('/api/...')，資料持久化於 localStorage，發票影像以壓縮 dataURL 儲存。
 */
(function () {
  'use strict';

  /* ── 種子資料（與 server/seed-data.js 同步） ── */
  const SEED = {
    company: {
      name: '火星禪意科技股份有限公司', taxId: '83196222',
      allowedWifi: [{ ssid: 'MARSZEN-OFFICE', bssid: 'A4:B1:C2:D3:E4:F5' }],
      office: { lat: 25.0339, lng: 121.5645, radiusM: 300 }
    },
    employees: [
      { id: 1, empNo: 'E001', name: '劉安迪', email: 'andyliu@mars-zen.com', role: 'owner', title: '負責人', dept: '經營層', baseSalary: 120000, laborIns: 2402, healthIns: 1861, onboard: '2020-01-01', status: 'active' },
      { id: 2, empNo: 'E002', name: '陳雅婷', email: 'yating@mars-zen.com', role: 'manager', title: '財務主管', dept: '財務部', baseSalary: 75000, laborIns: 1620, healthIns: 1172, onboard: '2021-03-15', status: 'active' },
      { id: 3, empNo: 'E003', name: '林志明', email: 'jimmy@mars-zen.com', role: 'employee', title: '業務專員', dept: '業務部', baseSalary: 48000, laborIns: 1042, healthIns: 749, onboard: '2022-07-01', status: 'active' },
      { id: 4, empNo: 'E004', name: '王小美', email: 'mei@mars-zen.com', role: 'employee', title: '行政專員', dept: '管理部', baseSalary: 40000, laborIns: 866, healthIns: 620, onboard: '2023-02-01', status: 'active' }
    ],
    attendance: [
      { id: 1, employeeId: 3, type: 'in', timestamp: '2026-07-07T08:52:11+08:00', gps: { lat: 25.0341, lng: 121.5642 }, wifi: { ssid: 'MARSZEN-OFFICE', bssid: 'A4:B1:C2:D3:E4:F5' }, distanceM: 34, result: 'success', note: null },
      { id: 2, employeeId: 3, type: 'out', timestamp: '2026-07-07T18:03:45+08:00', gps: { lat: 25.034, lng: 121.5646 }, wifi: { ssid: 'MARSZEN-OFFICE', bssid: 'A4:B1:C2:D3:E4:F5' }, distanceM: 15, result: 'success', note: null },
      { id: 3, employeeId: 4, type: 'in', timestamp: '2026-07-07T08:58:02+08:00', gps: { lat: 25.0338, lng: 121.5647 }, wifi: { ssid: 'MARSZEN-OFFICE', bssid: 'A4:B1:C2:D3:E4:F5' }, distanceM: 23, result: 'success', note: null }
    ],
    vouchers: [
      { id: 1, docNo: 'EXP-20260615-001', employeeId: 3, taxIdSeller: '22099131', invoiceNo: 'AB12345678', amount: 1200, tax: 60, date: '2026-06-15', category: '交通費', note: '客戶拜訪高鐵票', image: null, status: 'booked', bookedAt: '2026-06-16T10:00:00+08:00', createdAt: '2026-06-15T14:20:00+08:00' },
      { id: 2, docNo: 'EXP-20260620-002', employeeId: 4, taxIdSeller: '04541302', invoiceNo: 'CD23456789', amount: 3500, tax: 175, date: '2026-06-20', category: '文具用品', note: '辦公室用品採購', image: null, status: 'booked', bookedAt: '2026-06-21T09:30:00+08:00', createdAt: '2026-06-20T11:00:00+08:00' },
      { id: 3, docNo: 'EXP-20260701-003', employeeId: 3, taxIdSeller: '70759028', invoiceNo: 'EF34567890', amount: 2680, tax: 134, date: '2026-07-01', category: '交際費', note: '客戶餐敘', image: null, status: 'pending', bookedAt: null, createdAt: '2026-07-01T20:10:00+08:00' }
    ],
    approvals: [
      { id: 1, docType: 'expense', voucherId: 3, title: '費用報支 EXP-20260701-003（交際費 $2,680）', requesterId: 3, approverId: 2, status: 'pending', decidedAt: null, comment: null, createdAt: '2026-07-01T20:10:05+08:00' },
      { id: 2, docType: 'leave', voucherId: null, title: '王小美 特休申請 2026/07/15（1 日）', requesterId: 4, approverId: 2, status: 'pending', decidedAt: null, comment: null, createdAt: '2026-07-06T09:00:00+08:00' }
    ],
    sales: [
      { id: 1, invoiceNo: 'ZZ11223344', buyerTaxId: '16003518', amount: 250000, tax: 12500, date: '2026-05-12', desc: '軟體開發服務' },
      { id: 2, invoiceNo: 'ZZ11223345', buyerTaxId: '16003518', amount: 180000, tax: 9000, date: '2026-06-03', desc: '系統維護費' },
      { id: 3, invoiceNo: 'ZZ11223346', buyerTaxId: '84149961', amount: 320000, tax: 16000, date: '2026-06-25', desc: '顧問服務' }
    ],
    images: {}
  };

  const KEY = 'marszen-mock-db-v1';
  function loadDB() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    const d = JSON.parse(JSON.stringify(SEED));
    saveDB(d);
    return d;
  }
  function saveDB(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); }
    catch (e) { // 容量不足時捨棄影像再存
      d.images = {};
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e2) {}
    }
  }
  const nextId = (d, col) => d[col].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;

  const J = (data, status = 200) => new Response(JSON.stringify({ success: status < 400, ...(status < 400 ? { data } : { message: data }) }), { status, headers: { 'Content-Type': 'application/json' } });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function distanceM(a, b) {
    const R = 6371000, rad = x => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* ── 稅務媒體檔（與 server/tax-media.js 同步） ── */
  const pad = (s, len) => String(s ?? '').padEnd(len, ' ').slice(0, len);
  const padN = (n, len) => String(Math.round(Number(n) || 0)).padStart(len, '0').slice(-len);
  const rocDate = iso => { const [y, m, d] = iso.split('-'); return String(Number(y) - 1911).padStart(3, '0') + m + d; };

  function businessTaxMedia(d, period) {
    const y = Number(period.slice(0, 4)), m1 = Number(period.slice(4, 6));
    const months = [`${y}-${String(m1).padStart(2, '0')}`, `${y}-${String(m1 + 1).padStart(2, '0')}`];
    const rocPeriod = String(y - 1911).padStart(3, '0') + String(m1).padStart(2, '0');
    const myTaxId = d.company.taxId, lines = [];
    for (const s of d.sales.filter(s => months.some(mm => s.date.startsWith(mm))))
      lines.push(pad('31', 2) + pad(myTaxId, 8) + pad(rocPeriod, 5) + pad(s.buyerTaxId, 8) + pad(s.invoiceNo, 10) + '1' + padN(s.amount, 12) + padN(s.tax, 10) + pad('', 24));
    for (const v of d.vouchers.filter(v => v.status === 'booked' && months.some(mm => v.date.startsWith(mm))))
      lines.push(pad('25', 2) + pad(myTaxId, 8) + pad(rocPeriod, 5) + pad(v.taxIdSeller, 8) + pad(v.invoiceNo || '', 10) + '1' + padN(v.amount, 12) + padN(v.tax, 10) + pad('', 24));
    if (!lines.length) return { records: 0 };
    const ts = d.sales.filter(s => months.some(mm => s.date.startsWith(mm)));
    const ti = d.vouchers.filter(v => v.status === 'booked' && months.some(mm => v.date.startsWith(mm)));
    const oA = ts.reduce((s, x) => s + x.amount, 0), oT = ts.reduce((s, x) => s + x.tax, 0);
    const iA = ti.reduce((s, x) => s + x.amount, 0), iT = ti.reduce((s, x) => s + x.tax, 0);
    const header = pad('40', 2) + pad(myTaxId, 8) + pad(rocPeriod, 5) + padN(oA, 12) + padN(oT, 10) + padN(iA, 12) + padN(iT, 10) + padN(oT - iT, 10) + pad('', 11);
    return { records: lines.length, content: [header, ...lines].join('\r\n') + '\r\n' };
  }

  function incomeTaxMedia(d, year) {
    const sales = d.sales.filter(s => s.date.startsWith(year));
    const vouchers = d.vouchers.filter(v => v.status === 'booked' && v.date.startsWith(year));
    if (!sales.length && !vouchers.length) return { records: 0 };
    const revenue = sales.reduce((s, x) => s + x.amount, 0);
    const expense = vouchers.reduce((s, x) => s + x.amount, 0);
    const payroll = d.employees.filter(e => e.status === 'active').reduce((s, e) => s + e.baseSalary * 12, 0);
    const taxable = Math.max(0, revenue - expense - payroll), taxDue = Math.round(taxable * 0.2);
    const rocYear = String(Number(year) - 1911).padStart(3, '0');
    const out = [pad('50', 2) + pad(d.company.taxId, 8) + pad(rocYear, 3) + padN(revenue, 14) + padN(expense, 14) + padN(payroll, 14) + padN(taxable, 14) + padN(taxDue, 14) + pad('', 17)];
    for (const s of sales) out.push(pad('51', 2) + pad(d.company.taxId, 8) + pad(rocYear, 3) + pad(s.invoiceNo, 10) + pad(rocDate(s.date), 7) + padN(s.amount, 14) + padN(s.tax, 10) + pad(s.desc, 46));
    for (const v of vouchers) out.push(pad('52', 2) + pad(d.company.taxId, 8) + pad(rocYear, 3) + pad(v.invoiceNo || '', 10) + pad(rocDate(v.date), 7) + padN(v.amount, 14) + padN(v.tax, 10) + pad(v.category, 46));
    return { records: out.length, content: out.join('\r\n') + '\r\n' };
  }

  /* ── 圖片壓縮為 dataURL ── */
  function fileToDataURL(file) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 900, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  const MOCK_SELLERS = ['22099131', '04541302', '70759028', '28860904', '53212539'];

  /* ── 路由 ── */
  async function handle(url, opt) {
    const u = new URL(url, location.origin);
    const p = u.pathname.slice(u.pathname.indexOf('/api/'));
    const q = u.searchParams;
    const method = (opt && opt.method || 'GET').toUpperCase();
    const body = opt && opt.body && typeof opt.body === 'string' ? JSON.parse(opt.body) : null;
    const d = loadDB();

    // 人事
    if (p === '/api/hr/employees' && method === 'GET') return J(d.employees);
    let m = p.match(/^\/api\/hr\/employees\/(\d+)$/);
    if (m && method === 'PUT') {
      const e = d.employees.find(x => x.id === Number(m[1]));
      if (!e) return J('查無員工', 404);
      for (const k of ['name', 'title', 'dept', 'baseSalary', 'laborIns', 'healthIns', 'status', 'email']) if (body[k] !== undefined) e[k] = body[k];
      saveDB(d); return J(e);
    }

    // 打卡
    if (p === '/api/attendance/clock-in' && method === 'POST') {
      const { employeeId, gps, wifi, timestamp, type } = body || {};
      if (!employeeId) return J('缺少員工ID', 400);
      if (!gps || gps.lat == null || gps.lng == null) return J('無法獲取 GPS 座標，打卡失敗', 400);
      if (!wifi || !wifi.ssid) return J('無法獲取 Wi-Fi 資訊，打卡失敗', 400);
      const emp = d.employees.find(e => e.id === Number(employeeId));
      if (!emp) return J('查無此員工', 404);
      const dist = Math.round(distanceM(gps, d.company.office));
      const wifiOk = d.company.allowedWifi.some(w => w.ssid === wifi.ssid);
      const inRange = dist <= d.company.office.radiusM;
      const rec = {
        id: nextId(d, 'attendance'), employeeId: emp.id, type: type || 'in',
        timestamp: timestamp || new Date().toISOString(), gps, wifi, distanceM: dist,
        result: inRange && wifiOk ? 'success' : 'abnormal',
        note: inRange && wifiOk ? null : (!inRange ? `超出辦公室範圍 ${dist}m` : 'Wi-Fi 非公司網路')
      };
      d.attendance.push(rec); saveDB(d);
      return J({ record: rec, message: rec.result === 'success' ? '打卡成功' : `打卡完成（異常註記：${rec.note}）` });
    }
    if (p === '/api/attendance/records') {
      let rows = [...d.attendance].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (q.get('employeeId')) rows = rows.filter(r => r.employeeId === Number(q.get('employeeId')));
      return J(rows.slice(0, 50).map(r => ({ ...r, employeeName: (d.employees.find(e => e.id === r.employeeId) || {}).name })));
    }

    // OCR（模擬 1.5 秒辨識）
    if (p === '/api/finance/invoice-ocr' && method === 'POST') {
      const file = opt.body instanceof FormData ? opt.body.get('image') : null;
      if (!file) return J('未收到發票圖檔', 400);
      const [dataUrl] = await Promise.all([fileToDataURL(file), sleep(1500)]);
      const imageId = 'img_' + Date.now();
      if (dataUrl) { d.images[imageId] = dataUrl; saveDB(d); }
      const today = new Date();
      const day = String(1 + Math.floor(Math.random() * Math.min(today.getDate(), 28))).padStart(2, '0');
      const amount = (Math.floor(Math.random() * 80) + 2) * 100;
      const partial = Math.random() < 0.15;
      return J({
        imageId,
        fields: {
          taxIdSeller: partial ? null : MOCK_SELLERS[Math.floor(Math.random() * MOCK_SELLERS.length)],
          amount, tax: Math.round(amount * 0.05),
          date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${day}`,
          invoiceNo: String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String(10000000 + Math.floor(Math.random() * 89999999))
        },
        partial, message: partial ? '部分欄位辨識失敗，請手動補齊或重新拍攝' : '辨識完成'
      });
    }

    // 報支
    if (p === '/api/finance/expenses' && method === 'POST') {
      const { employeeId, taxIdSeller, invoiceNo, amount, tax, date, category, note, imageId } = body || {};
      if (!employeeId) return J('缺少員工ID', 400);
      if (!taxIdSeller || !/^\d{8}$/.test(String(taxIdSeller))) return J('統一編號必填且須為 8 碼數字', 400);
      if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) return J('金額必填且必須為數值', 400);
      if (tax == null || isNaN(Number(tax))) return J('稅額必填且必須為數值', 400);
      if (!date || isNaN(Date.parse(date))) return J('日期必填且須為有效日期', 400);
      const id = nextId(d, 'vouchers');
      const docNo = `EXP-${date.replace(/-/g, '')}-${String(id).padStart(3, '0')}`;
      const voucher = { id, docNo, employeeId: Number(employeeId), taxIdSeller: String(taxIdSeller), invoiceNo: invoiceNo || null, amount: Number(amount), tax: Number(tax), date, category: category || '雜項', note: note || '', image: imageId || null, status: 'pending', bookedAt: null, createdAt: new Date().toISOString() };
      d.vouchers.push(voucher);
      const approver = d.employees.find(e => e.role === 'manager') || d.employees[0];
      const approval = { id: nextId(d, 'approvals'), docType: 'expense', voucherId: id, title: `費用報支 ${docNo}（${voucher.category} $${Number(amount).toLocaleString()}）`, requesterId: Number(employeeId), approverId: approver.id, status: 'pending', decidedAt: null, comment: null, createdAt: new Date().toISOString() };
      d.approvals.push(approval); saveDB(d);
      return J({ voucher, approval });
    }
    if (p === '/api/finance/vouchers' && method === 'GET') {
      let rows = [...d.vouchers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (q.get('status')) rows = rows.filter(v => v.status === q.get('status'));
      return J(rows.map(v => ({ ...v, employeeName: (d.employees.find(e => e.id === v.employeeId) || {}).name })));
    }
    m = p.match(/^\/api\/finance\/vouchers\/(\d+)\/book$/);
    if (m && method === 'POST') {
      const v = d.vouchers.find(x => x.id === Number(m[1]));
      if (!v) return J('查無憑證', 404);
      const ap = d.approvals.find(a => a.voucherId === v.id);
      if (ap && ap.status !== 'approved') return J('入帳檢核失敗：此憑證尚未完成簽核', 409);
      v.status = 'booked'; v.bookedAt = new Date().toISOString(); saveDB(d);
      return J(v);
    }

    // 簽核
    if (p === '/api/approvals' && method === 'GET') {
      let rows = [...d.approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (q.get('approverId')) rows = rows.filter(a => a.approverId === Number(q.get('approverId')));
      if (q.get('status')) rows = rows.filter(a => a.status === q.get('status'));
      return J(rows.map(a => ({ ...a, requesterName: (d.employees.find(e => e.id === a.requesterId) || {}).name, voucher: a.voucherId ? d.vouchers.find(v => v.id === a.voucherId) : null })));
    }
    m = p.match(/^\/api\/approvals\/(\d+)\/decision$/);
    if (m && method === 'POST') {
      const { action, comment } = body || {};
      if (!['approve', 'reject'].includes(action)) return J('action 須為 approve 或 reject', 400);
      const a = d.approvals.find(x => x.id === Number(m[1]));
      if (!a) return J('查無簽核單', 404);
      if (a.status !== 'pending') return J('此單已處理', 409);
      a.status = action === 'approve' ? 'approved' : 'rejected';
      a.decidedAt = new Date().toISOString(); a.comment = comment || null;
      if (a.voucherId) {
        const v = d.vouchers.find(v => v.id === a.voucherId);
        if (v) { v.status = action === 'approve' ? 'booked' : 'rejected'; if (action === 'approve') v.bookedAt = a.decidedAt; }
      }
      saveDB(d); return J(a);
    }

    // 薪資
    if (p === '/api/payroll') {
      const month = q.get('month') || new Date().toISOString().slice(0, 7);
      return J(d.employees.filter(e => e.status === 'active').map(e => {
        const workDays = d.attendance.filter(r => r.employeeId === e.id && r.type === 'in' && r.timestamp.startsWith(month)).length;
        const deductions = e.laborIns + e.healthIns;
        return { employeeId: e.id, empNo: e.empNo, name: e.name, dept: e.dept, month, baseSalary: e.baseSalary, laborIns: e.laborIns, healthIns: e.healthIns, workDays, gross: e.baseSalary, deductions, net: e.baseSalary - deductions };
      }));
    }

    // 儀表板
    if (p === '/api/dashboard/summary') {
      const today = new Date().toISOString().slice(0, 10), thisMonth = today.slice(0, 7);
      return J({
        company: d.company.name,
        todayClockIns: d.attendance.filter(r => r.timestamp.startsWith(today) && r.type === 'in').length,
        activeEmployees: d.employees.filter(e => e.status === 'active').length,
        pendingApprovals: d.approvals.filter(a => a.status === 'pending').length,
        pendingVouchers: d.vouchers.filter(v => v.status === 'pending').length,
        monthExpense: d.vouchers.filter(v => v.date.startsWith(thisMonth) && v.status !== 'rejected').reduce((s, v) => s + v.amount, 0),
        monthSales: d.sales.filter(s => s.date.startsWith(thisMonth)).reduce((s, x) => s + x.amount, 0),
        monthPayroll: d.employees.filter(e => e.status === 'active').reduce((s, e) => s + e.baseSalary, 0)
      });
    }

    // 稅務媒體檔
    if (p === '/api/tax/business-tax-media') {
      const period = q.get('period') || '';
      if (!/^\d{6}$/.test(period)) return J('期別格式須為 YYYYMM（雙月起始月）', 400);
      await sleep(800);
      const out = businessTaxMedia(d, period);
      if (!out.records) return J('該期別無相關稅務資料可供匯出', 404);
      return new Response(out.content, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="BT401_${period}.txt"` } });
    }
    if (p === '/api/tax/income-tax-media') {
      const year = q.get('year') || '';
      if (!/^\d{4}$/.test(year)) return J('年度格式須為 YYYY', 400);
      await sleep(800);
      const out = incomeTaxMedia(d, year);
      if (!out.records) return J('該期別無相關稅務資料可供匯出', 404);
      return new Response(out.content, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="IT_${year}.txt"` } });
    }

    return J('Not found (mock)', 404);
  }

  /* ── 攔截 fetch ── */
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, opt) {
    const u = typeof input === 'string' ? input : (input && input.url) || '';
    if (u.includes('/api/')) return handle(u, opt || {});
    return realFetch(input, opt);
  };

  /* ── 載入後修補：憑證影像檢視器（<img> 無法被 fetch 攔截）+ Demo 橫幅 ── */
  window.addEventListener('load', () => {
    if (typeof window.openViewer === 'function') {
      const orig = window.openViewer;
      window.openViewer = (id, docNo) => {
        orig(id, docNo);
        const d = loadDB();
        const v = d.vouchers.find(v => v.id === id);
        const img = document.getElementById('viewerImg');
        if (img) {
          if (v && v.image && d.images[v.image]) img.src = d.images[v.image];
          else { img.removeAttribute('src'); const meta = document.getElementById('viewerMeta'); if (meta) meta.textContent = '（Demo 版）此憑證無影像檔'; }
        }
      };
    }
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999;background:#1b2430;color:#cfd8e3;font-size:12px;text-align:center;padding:5px 8px;opacity:.92';
    bar.innerHTML = 'Demo 版：後端由瀏覽器模擬，資料儲存於此瀏覽器 <a href="#" style="color:#7db8ff" onclick="localStorage.removeItem(\'marszen-mock-db-v1\');location.reload();return false;">重設資料</a>';
    document.body.appendChild(bar);
  });
})();
