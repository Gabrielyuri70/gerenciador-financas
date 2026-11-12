/* ===== Finanças Pro — Rodada 14: faturas (contas fixas no cartão), cartão emprestado, FAB, avisos de confirmação ===== */
// ---------- Fatura: contas fixas/lançamentos no cartão entram na fatura ----------
function itensFatura(card, ymF) {
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    const pseudo = (m, fx) => ({ c: { id: 'm' + m.id, movId: m.id, mov: true, desc: m.desc, valorTotal: m.valor, parcelas: 1, data: m.data, local: m.local, cat: m.cat, fixa: fx, emprestado: false, pagamentos: [] }, info: fx ? 'Fixo' : '', valor: m.valor }), fixos = {};
    dados.movs.forEach(m => { // conta fixa no cartão: aparece em TODAS as faturas a partir da primeira (vale o valor do último reajuste)
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        const inv = mesFatura(card, { data: m.data });
        if (!m.fixo) { if (inv === ymF) out.push(pseudo(m, false)); return; }
        if (inv <= ymF) { const k = m.desc; if (!fixos[k] || inv > fixos[k].inv || (inv === fixos[k].inv && m.data > fixos[k].m.data)) fixos[k] = { inv, m }; }
    });
    Object.values(fixos).forEach(f => out.push(pseudo(f.m, true)));
    return out;
}
function limiteUsado(card) {
    const hoje = hojeISO().substring(0, 7);
    const compras = (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas; if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).length * v, pago = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
        return s + Math.max(0, Math.min(c.valorTotal - pago, aberto));
    }, 0);
    return compras + dados.movs.filter(m => m.cartaoId === card.id && m.tipo === 'saida' && m.data && mesFatura(card, { data: m.data }) >= hoje).reduce((s, m) => s + m.valor, 0);
}
function _efPara(ym, comId) {
    const ids = new Set(), cred = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') { cred.add(c.id); (c.compras || []).forEach(x => ids.add(x.id)); } });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)) && !(m.cartaoId && cred.has(m.cartaoId)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0); if (t <= 0) return;
        out.push(comId ? { id: -c.id, desc: 'Fatura ' + c.nome, valor: Math.round(t * 100) / 100, tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true } : { desc: 'Fatura ' + c.nome, valor: t, tipo: 'saida', cat: 'Cartão', data: ym + '-01' });
    });
    return out;
}
function efetivos() { return _efPara(_mesSel(), true); }
function efetivosDe(ym) { return _efPara(ym, false); }

// ---------- Tela de compras do cartão (nova organização) ----------
const _dmy = s => s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
function _cardItem(card, it, ymF) {
    const { c, valor } = it, pagOk = (c.pagamentos || []).filter(p => !p.antecipada).reduce((a, p) => a + p.valor, 0), dia = parseInt(c.data.substring(8, 10)) || 1;
    let badge, meio, datas, falta = 0, pct = 100;
    if (c.fixa || c.mov) {
        badge = c.mov ? 'Conta fixa' : 'Fixo';
        meio = '<div><small>Valor mensal</small><b class="money-value">' + brl(valor) + '</b></div><div><small>Duração</small><b>Todo mês</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + _dmy(c.data) + '</span><span><i class="fas fa-infinity"></i> Sem data final</span>'; pct = 0;
    } else {
        const ps = parcelasCompra(card, c), tot = ps.length, n = Math.max(1, ps.findIndex(x => x.ym === ymF) + 1), last = ps[tot - 1].ym, [ay, am] = last.split('-').map(Number);
        falta = Math.max(0, (tot - n + 1) * valor - pagOk); pct = n / tot * 100; badge = n + '/' + tot;
        meio = '<div><small>Total da compra</small><b class="money-value">' + brl(c.valorTotal) + '</b></div><div><small>Falta pagar</small><b class="money-value ' + (falta > 0 ? 'text-danger' : 'text-success') + '">' + brl(falta) + '</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + _dmy(c.data) + '</span><span><i class="far fa-flag"></i> Finalizar ' + String(Math.min(dia, new Date(ay, am, 0).getDate())).padStart(2, '0') + '/' + String(am).padStart(2, '0') + '/' + ay + '</span>';
    }
    const menu = c.mov ? '<li><button class="dropdown-item py-2" onclick="abrirTransacao(' + c.movId + ')"><i class="fas fa-pen me-2"></i>Editar lançamento</button></li>'
        : '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar compra</button></li>' + (c.fixa ? '' : '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'total\')"><i class="fas fa-circle-check me-2"></i>Pagamento total</button></li><li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'parcial\')"><i class="fas fa-coins me-2"></i>Pagamento parcial</button></li><li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(' + c.id + ')"><i class="fas fa-forward me-2"></i>Antecipar parcelas</button></li>');
    const pags = (c.pagamentos || []).map(p => '<div>' + brl(p.valor) + ' em ' + escaparHTML(p.data) + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('');
    return '<div class="cc-item"><div class="cc-l1"><b class="cc-desc">' + escaparHTML(c.desc) + '</b><span class="cc-parc money-value">' + brl(valor) + '</span><span class="cc-badge">' + badge + '</span>'
        + '<div class="dropdown"><button class="cc-menu" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-vertical"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">' + menu + '</ul></div></div>'
        + '<div class="cc-l2">' + meio + '</div>' + (c.fixa || c.mov ? '' : '<div class="cc-bar"><div style="width:' + pct + '%"></div></div>')
        + '<div class="cc-l3">' + datas + '</div>'
        + ((c.local || c.cat) ? '<div class="cc-l3">' + (c.local ? '<span><i class="fas fa-store"></i> ' + escaparHTML(c.local) + '</span>' : '') + (c.cat ? '<span><i class="fas fa-tag"></i> ' + escaparHTML(c.cat) + '</span>' : '') + '</div>' : '')
        + (pags ? '<div class="cc-pags"><b>Pagamentos</b>' + pags + '</div>' : '') + '</div>';
}
function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto); if (!card) return;
    const ym = _mesSel(), ymF = ymFat(card, ym), itens = itensFatura(card, ymF), usado = limiteUsado(card), cor = /^#[0-9a-f]{6}$/i.test(card.cor || '') ? card.cor : '#6366f1', fg = card.corFonte || '#fff';
    const soma = l => l.reduce((s, i) => s + i.valor, 0), minhas = itens.filter(i => !i.c.emprestado), emp = itens.filter(i => i.c.emprestado), perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="cc-resumo" style="background:linear-gradient(135deg,' + cor + ',' + shade(cor, .45) + ');color:' + fg + '"><div class="d-flex justify-content-between align-items-end"><div><small class="fp-sub">Fatura de ' + MESES_C[parseInt(ym.slice(5)) - 1] + '</small><div class="fp-valor money-value">' + brl(soma(minhas)) + '</div></div><div class="text-end"><small class="fp-sub">Disponível</small><div class="fw-bold money-value">' + brl(card.limite - usado) + '</div></div></div>'
        + '<div class="fp-bar mt-2"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Fecha dia ' + String(card.fecha).padStart(2, '0') + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.slice(5) + '/' + ym.slice(0, 4) + '</span></div>'
        + (emp.length ? '<div class="fp-sub mt-1">Emprestado (fora do seu extrato): <b class="money-value">' + brl(soma(emp)) + '</b></div>' : '') + '</div>';
    const sec = (ic, t, v, cls = '') => '<div class="cc-sec ' + cls + '"><span><i class="fas ' + ic + '"></i> ' + t + '</span><b class="money-value">' + brl(v) + '</b></div>';
    let html = minhas.length ? sec('fa-user', 'Minhas compras', soma(minhas)) + minhas.map(i => _cardItem(card, i, ymF)).join('') : '';
    if (emp.length) {
        const g = {}; emp.forEach(i => { const k = (i.c.pessoa || '').trim() || 'Sem nome'; (g[k] = g[k] || []).push(i); });
        html += '<div class="cc-titulo-emp"><i class="fas fa-people-arrows"></i> Cartão emprestado</div>' + Object.entries(g).map(([n, l]) => sec('fa-user-group', escaparHTML(n), soma(l), 'emp') + l.map(i => _cardItem(card, i, ymF)).join('')).join('');
    }
    document.getElementById('lista-compras-cartao').innerHTML = html || '<p class="text-center text-muted small py-4">Nenhuma compra nesta fatura.</p>';
}

// ---------- Formulários: pessoa (cartão emprestado) e cartão da fatura no lançamento ----------
function togglePessoa() { const w = document.getElementById('compra-pessoa-wrap'), e = document.getElementById('compra-emprestado'); if (w && e) w.classList.toggle('d-none', !e.checked); }
function toggleCartaoMov() {
    const w = document.getElementById('mov-cartao-wrap'); if (!w) return;
    w.classList.toggle('d-none', !(_v('mov-forma') === 'Crédito' && _v('mov-tipo') === 'saida'));
}
const _abrirCompra14 = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompra14(id); const card = dados.cartoes.find(x => x.id == cartaoContexto), c = id && card ? card.compras.find(x => x.id == id) : null;
    _set('compra-pessoa', c && c.pessoa); togglePessoa();
};
const _salvarCompra14 = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return _salvarCompra14();
    const idEdit = Number(_v('compra-id-edit')) || 0, antes = JSON.stringify(card.compras); _salvarCompra14();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { c.pessoa = c.emprestado ? _v('compra-pessoa').trim() : ''; salvarERender(); renderComprasCartao(); }
};
const _abrirMov14 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null; _abrirMov14(id); if (id < 0) return;
    const s = document.getElementById('mov-cartao'); if (s) { s.innerHTML = dados.cartoes.filter(c => c.tipo !== 'Débito').map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join(''); if (m && m.cartaoId) s.value = m.cartaoId; }
    if (m && m.cartaoId) _set('mov-forma', 'Crédito'); toggleCartaoMov();
};
const _salvarMov14 = window.salvarMov;
window.salvarMov = function () {
    const idEdit = Number(_v('mov-id-edit')) || 0, antes = JSON.stringify(dados.movs), usaCartao = _v('mov-forma') === 'Crédito' && _v('mov-tipo') === 'saida', cid = Number(_v('mov-cartao')) || null;
    if (usaCartao && !cid) return alert('Cadastre um cartão de crédito para lançar na fatura.');
    _salvarMov14(); if (JSON.stringify(dados.movs) === antes) return;
    const m = idEdit ? dados.movs.find(x => x.id === idEdit) : dados.movs[dados.movs.length - 1]; if (!m) return;
    m.cartaoId = usaCartao ? cid : null; salvarERender();
};

// ---------- Botão flutuante (+) por tela ----------
function mostrarModal(id) { const el = document.getElementById(id); (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show(); }
const FAB_ACOES = { 'cartoes': () => abrirModalCartao(), 'compras-cartao': () => abrirModalCompraCartao(), 'dividas': () => abrirModalDivida(), 'aba-clientes': () => abrirModalCliente(), 'metas': () => mostrarModal('modalMeta'), 'aba-notas': () => abrirModalNota(), 'aba-revenda': () => abrirModalRevenda() };
const FAB_ROTULO = { 'cartoes': 'Novo cartão', 'compras-cartao': 'Nova compra', 'dividas': 'Novo registro', 'aba-clientes': 'Novo cliente', 'metas': 'Nova meta', 'aba-notas': 'Nova nota', 'aba-revenda': 'Novo produto' };
function atualizarFab() { const f = document.getElementById('fab-add'); if (!f) return; const ok = !!FAB_ACOES[_secAtual]; f.style.display = ok ? 'flex' : 'none'; f.setAttribute('aria-label', FAB_ROTULO[_secAtual] || ''); }
const _showSection14 = window.showSection;
window.showSection = function (id, b) { _showSection14(id, b); atualizarFab(); };

// ---------- Confirmação (aviso na tela) depois de cada ação ----------
const AVISOS = { salvarMov: 'Lançamento salvo', moverMovParaLixeira: 'Lançamento enviado para a lixeira', addCartao: 'Cartão salvo', excluirCartaoNoModal: 'Cartão excluído', salvarCompraCartao: 'Compra salva', excluirCompraNoModal: 'Compra excluída', addDivida: 'Registro salvo', excluirDivida: 'Registro enviado para a lixeira', confirmarPagamento: 'Pagamento registrado', pagarParcelaDivida: 'Parcela paga', salvarMeta: 'Meta salva', movimentarMeta: 'Movimentação da meta registrada', salvarNota: 'Nota salva', excluirNotaDireta: 'Nota excluída', salvarProdutoRevenda: 'Produto salvo', excluirProdutoRevenda: 'Produto enviado para a lixeira', venderProdutoRevenda: 'Venda registrada', salvarCliente: 'Cliente salvo', excluirCliente: 'Cliente enviado para a lixeira', addInteracao: 'Contato registrado', confirmarAntecipacao: 'Antecipação registrada', restaurarDaLixeira: 'Item restaurado' };
const _snap = () => JSON.stringify([dados, typeof notas !== 'undefined' ? notas : null]);
Object.keys(AVISOS).forEach(n => {
    const o = window[n]; if (typeof o !== 'function') return;
    window[n] = function (...a) { const antes = _snap(), r = o.apply(this, a); if (_snap() !== antes) alert(AVISOS[n]); return r; };
});

document.addEventListener('DOMContentLoaded', () => {
    const fab = document.createElement('button'); fab.id = 'fab-add'; fab.innerHTML = '<i class="fas fa-plus"></i>'; fab.style.display = 'none'; fab.onclick = () => { const f = FAB_ACOES[_secAtual]; if (f) f(); }; document.body.appendChild(fab);
    ['#cartoes button[onclick*="abrirModalCartao()"]', '#compras-cartao button[onclick*="abrirModalCompraCartao()"]', '#dividas button[onclick*="abrirModalDivida()"]', '#aba-clientes button[onclick*="abrirModalCliente()"]', '#metas button[data-bs-target="#modalMeta"]', '#aba-notas button[onclick*="abrirModalNota()"]', '#aba-revenda button[onclick*="abrirModalRevenda()"]'].forEach(q => document.querySelectorAll(q).forEach(b => b.classList.add('d-none')));
    const ce = document.getElementById('compra-emprestado');
    if (ce) { ce.addEventListener('change', togglePessoa); ce.closest('div').insertAdjacentHTML('afterend', '<div id="compra-pessoa-wrap" class="mb-3 d-none"><label class="small fw-bold">Nome de quem usou o cartão</label><input id="compra-pessoa" class="form-control" placeholder="Ex: Karol"></div>'); }
    const mf = document.getElementById('mov-forma');
    if (mf) { mf.closest('.row').insertAdjacentHTML('afterend', '<div id="mov-cartao-wrap" class="mb-3 d-none"><label class="small fw-bold">Cartão da fatura</label><select id="mov-cartao" class="form-select"></select><small class="text-muted">Entra na fatura deste cartão. Se for "Fixo", aparece em todas as faturas.</small></div>'); mf.addEventListener('change', toggleCartaoMov); document.getElementById('mov-tipo').addEventListener('change', toggleCartaoMov); }
});
