/* ===== Finanças Pro — Rodada 4: categorias, orçamento, contas fixas, dia a dia, CSV, avisos ===== */
// Avisos na tela (toast) no lugar do alert() bloqueante
window.alert = function (msg) {
    let c = document.getElementById('toast-box');
    if (!c) { c = document.createElement('div'); c.id = 'toast-box'; c.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:20000;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:520px;margin:0 auto'; document.body.appendChild(c); }
    const t = document.createElement('div'), erro = /incorret|inválid|Informe|insuficiente|maior que|Erro|não pode|Preencha/i.test(msg);
    t.style.cssText = 'background:' + (erro ? '#b91c1c' : '#15803d') + ';color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:pre-line;font-size:.9rem;pointer-events:auto;opacity:0;transform:translateY(-8px);transition:.25s';
    t.innerHTML = '<i class="fas ' + (erro ? 'fa-circle-exclamation' : 'fa-circle-check') + ' me-2"></i>' + escaparHTML(msg); c.appendChild(t); requestAnimationFrame(() => { t.style.opacity = 1; t.style.transform = 'none'; });
    t.onclick = () => t.remove(); setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, Math.min(12000, 2500 + String(msg).length * 45));
};

// ---------- Categorias personalizadas (separadas por tipo) ----------
function cats() {
    if (!dados.categorias) dados.categorias = { entrada: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Dívidas', 'Outros'], saida: ['Mercado', 'Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Dívidas', 'Cartão', 'Outros'] };
    dados.movs.forEach(m => { const l = dados.categorias[m.tipo === 'entrada' ? 'entrada' : 'saida']; if (m.cat && !l.includes(m.cat)) l.push(m.cat); });
    return dados.categorias;
}
function popularCategorias(tipo, sel) {
    const s = document.getElementById('mov-cat'), l = cats()[tipo === 'entrada' ? 'entrada' : 'saida'];
    if (sel && !l.includes(sel)) l.push(sel);
    s.innerHTML = l.filter(c => c !== 'Cartão' || sel === 'Cartão').map(c => '<option>' + escaparHTML(c) + '</option>').join('') + '<option value="__nova__">+ Nova categoria…</option>';
    if (sel) s.value = sel;
}
const _abrirMovO2 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null;
    _abrirMovO2(id);
    if (id >= 0 || !id) popularCategorias(document.getElementById('mov-tipo').value, m ? m.cat : null);
};

// ---------- Saldo do mês + acumulado + "quanto posso gastar por dia" ----------
function saldoMesDe(ym) { let e = 0, s = 0; efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; }); return { e, s }; }
const _renderResumoO2 = window.renderResumo;
window.renderResumo = function () {
    _renderResumoO2();
    const ym = _mesSel(), card = document.querySelector('.main-balance-card'); if (!card) return;
    const lbl = card.querySelector('small'); if (lbl) lbl.innerText = 'Saldo do mês';
    const datas = dados.movs.map(m => m.data && m.data.substring(0, 7)).filter(Boolean).sort();
    let acum = 0; if (datas.length) for (let c = datas[0]; c <= ym; c = ymAdd(c, 1)) { const r = saldoMesDe(c); acum += r.e - r.s; }
    let a = document.getElementById('txt-saldo-acum');
    if (!a) { a = document.createElement('small'); a.id = 'txt-saldo-acum'; a.className = 'opacity-75 d-block'; document.getElementById('txt-saldo-geral').after(a); }
    a.innerHTML = 'Acumulado até aqui: <b class="money-value">' + brl(acum) + '</b>';
    let d = document.getElementById('card-diario');
    if (!d) { d = document.createElement('div'); d.id = 'card-diario'; d.className = 'card border-0 shadow-sm rounded-4 p-3 mb-3'; card.after(d); }
    const hoje = new Date(), real = hojeISO().substring(0, 7) === ym;
    if (!real) { d.style.display = 'none'; return; }
    const r = saldoMesDe(ym), saldo = r.e - r.s, restam = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate() + 1;
    d.style.display = '';
    d.innerHTML = saldo > 0 ? '<small class="text-muted">Quanto posso gastar por dia</small><div class="fw-bold fs-5 text-success money-value">' + brl(saldo / restam) + '</div><small class="text-muted">Restam ' + restam + ' dia(s) e ' + brl(saldo) + ' livres no mês (já descontadas faturas e fixos lançados).</small>'
        : '<small class="text-muted">Quanto posso gastar por dia</small><div class="fw-bold text-danger">Sem saldo livre no mês</div><small class="text-muted">As despesas já superam as receitas lançadas.</small>';
};

// ---------- Pagamento de dívida → extrato (opcional) ----------
const _confPagO2 = window.confirmarPagamento;
window.confirmarPagamento = function () {
    const modo = document.getElementById('pag-modo').value, id = Number(document.getElementById('pag-id').value);
    const d0 = modo.includes('cartao') ? null : dados.dividas.find(x => x.id === id), antes = JSON.stringify([dados.dividas, dados.historicoQuitados]);
    const v = (modo === 'total' && d0) ? d0.valor : lerMoeda('pag-valor'), quer = document.getElementById('pag-extrato') && document.getElementById('pag-extrato').checked;
    _confPagO2();
    if (d0 && quer && v > 0 && JSON.stringify([dados.dividas, dados.historicoQuitados]) !== antes) lancarDividaNoExtrato(d0, v);
};
function lancarDividaNoExtrato(d, v) {
    const ag = new Date();
    dados.movs.push({ id: Date.now(), desc: (d.tipo === 'eu-devo' ? 'Pagamento: ' : 'Recebimento: ') + d.nome, valor: v, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', cat: 'Dívidas', clienteId: d.clienteId || null, data: hojeISO(), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0'), fixo: false });
    salvarERender();
}
const _pagarParcelaO = window.pagarParcelaDivida;
window.pagarParcelaDivida = function (id) {
    const d = { ...dados.dividas.find(x => x.id === Number(id)) }, antes = JSON.stringify([dados.dividas, dados.historicoQuitados]);
    _pagarParcelaO(id);
    if (d.id && JSON.stringify([dados.dividas, dados.historicoQuitados]) !== antes && confirm('Lançar esta parcela no extrato?')) lancarDividaNoExtrato(d, Math.min(d.valorParcela || d.valor, d.valor));
};

// ---------- Orçamento por categoria ----------
let _orcCats = [];
function renderOrcamento() {
    dados.orcamentos = dados.orcamentos || {};
    const ym = _mesSel(), gasto = {}; efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { gasto[m.cat] = (gasto[m.cat] || 0) + m.valor; });
    _orcCats = [...new Set([...cats().saida, ...Object.keys(dados.orcamentos)])];
    document.getElementById('orc-lista').innerHTML = _orcCats.map((c, i) => {
        const lim = dados.orcamentos[c] || 0, g = gasto[c] || 0, p = lim > 0 ? g / lim * 100 : 0, cor = p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#10b981';
        return '<div class="card border-0 shadow-sm rounded-4 p-3 mb-2"><div class="d-flex justify-content-between align-items-center"><b>' + escaparHTML(c) + '</b>'
            + '<input type="number" inputmode="decimal" min="0" class="form-control form-control-sm text-end" style="width:110px" placeholder="Limite" value="' + (lim || '') + '" onchange="salvarOrcamento(' + i + ',this.value)"></div>'
            + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, p) + '%;background:' + cor + '"></div></div>'
            + '<small class="text-muted money-value">Gasto ' + brl(g) + (lim > 0 ? ' de ' + brl(lim) + ' (' + Math.round(p) + '%)' : ' — sem limite definido') + '</small></div>';
    }).join('');
}
function salvarOrcamento(i, v) { const n = parseFloat(v) || 0, c = _orcCats[i]; if (n > 0) dados.orcamentos[c] = n; else delete dados.orcamentos[c]; salvarERender(); renderOrcamento(); }
const _coletarO2 = window.coletarAvisos;
window.coletarAvisos = function () {
    const av = _coletarO2(), ym = _mesSel(), gasto = {};
    efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { gasto[m.cat] = (gasto[m.cat] || 0) + m.valor; });
    Object.entries(dados.orcamentos || {}).forEach(([c, l]) => { const p = (gasto[c] || 0) / l * 100; if (p >= 100) av.push('[erro] Orçamento estourado em ' + c + ' (' + Math.round(p) + '%)'); else if (p >= 80) av.push('[aviso] ' + c + ': ' + Math.round(p) + '% do orçamento'); });
    return av;
};

// ---------- Contas fixas (tudo que se repete todo mês) ----------
function renderFixos() {
    const g = {}; dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    const lista = Object.values(g).filter(m => m.fixo).map(m => ({ desc: m.desc, valor: m.valor, tipo: m.tipo, dia: m.data.substring(8, 10), cat: m.cat, cartaoId: m.cartaoId }));
    dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => lista.push({ desc: x.desc + ' (' + c.nome + ')', valor: x.valorTotal, tipo: 'saida', dia: String(c.vence).padStart(2, '0'), cat: 'Cartão' })));
    const ent = lista.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), sai = lista.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    document.getElementById('fixos-resumo').innerHTML = [['Receitas fixas', ent, 'text-success'], ['Despesas fixas', sai, 'text-danger'], ['Sobra fixa/mês', ent - sai, ent - sai >= 0 ? 'text-success' : 'text-danger'], ['Custo anual fixo', sai * 12, '']]
        .map(([t, v, c]) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + c + '">' + brl(v) + '</div></div></div>').join('');
    document.getElementById('fixos-lista').innerHTML = lista.sort((a, b) => a.dia - b.dia).map(x => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><div class="fw-bold">' + escaparHTML(x.desc) + ' <span class="badge bg-info text-dark"><i class="fas fa-rotate"></i> dia ' + x.dia + '</span></div><small class="text-muted">' + escaparHTML(x.cat) + (x.cartaoId ? ' • ' + escaparHTML((dados.cartoes.find(c => c.id === x.cartaoId) || {}).nome || 'Cartão') : '') + '</small></div><b class="money-value ' + (x.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + (x.tipo === 'entrada' ? '+' : '-') + brl(x.valor) + '</b></div>').join('')
        || '<p class="text-muted text-center">Nenhuma conta fixa. Marque "Fixo" ao lançar uma receita/despesa.</p>';
}

// ---------- Exportar extrato do mês em CSV (abre no Excel) ----------
function exportarCSV() {
    const ym = _mesSel(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const linhas = efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data));
    if (!linhas.length) return alert('Nenhum lançamento neste mês.');
    const csv = '\uFEFFData;Descrição;Categoria;Tipo;Valor;Fixo\r\n' + linhas.map(m => [m.data.split('-').reverse().join('/'), q(m.desc), q(m.cat), m.tipo === 'entrada' ? 'Receita' : 'Despesa', String(m.valor.toFixed(2)).replace('.', ','), m.fixo ? 'Sim' : 'Não'].join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'extrato_' + ym + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const _showSectionO2 = window.showSection;
window.showSection = function (id, b) { _showSectionO2(id, b); if (id === 'aba-orcamento') renderOrcamento(); if (id === 'aba-fixos') renderFixos(); };
document.addEventListener('DOMContentLoaded', () => {
    const t = document.getElementById('mov-tipo'), c = document.getElementById('mov-cat');
    t.addEventListener('change', () => popularCategorias(t.value, null));
    c.addEventListener('change', () => {
        if (c.value !== '__nova__') return;
        const n = (prompt('Nome da nova categoria:') || '').trim().slice(0, 30), l = cats()[t.value === 'entrada' ? 'entrada' : 'saida'];
        if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); salvarERender(); }
        popularCategorias(t.value, n || null);
    });
    popularCategorias(t.value, null);
});
