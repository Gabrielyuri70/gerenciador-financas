/* ===== Finanças Pro — Rodada 2 | carregado depois de correcoes.js ===== */
const _mesSel = () => document.getElementById('mes-atual').value;
function ymAdd(ym, n) { let [a, m] = ym.split('-').map(Number); m += n; a += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return a + '-' + String(m).padStart(2, '0'); }
function addMesData(s) { const [a, m, d] = s.split('-').map(Number); const ym = ymAdd(a + '-' + String(m).padStart(2, '0'), 1); const [a2, m2] = ym.split('-').map(Number); return ym + '-' + String(Math.min(d, new Date(a2, m2, 0).getDate())).padStart(2, '0'); }

// ---------- Cartão: fatura por fechamento, parcelas futuras e compra fixa ----------
function mesFatura(card, c) { // mês de fechamento da fatura em que a compra cai
    const d = parseInt(c.data.substring(8, 10)), f = parseInt(card.fecha) || 31;
    return ymAdd(c.data.substring(0, 7), (card.tipo !== 'Débito' && d > f) ? 1 : 0);
}
function ymFat(card, ym) { return (parseInt(card.vence) > parseInt(card.fecha)) ? ym : ymAdd(ym, -1); } // fatura paga em "ym"
function parcelasCompra(card, c) {
    const ant = (c.pagamentos || []).filter(p => p.antecipada).length, tot = Math.max(1, c.parcelas - ant), base = mesFatura(card, c);
    return Array.from({ length: tot }, (_, i) => ({ n: i + 1, total: tot, ym: ymAdd(base, i) }));
}
function itensFatura(card, ymF) {
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    return out;
}
function limiteUsado(card) { // saldo real em aberto (parcelas futuras), não só o mês atual
    const hoje = hojeISO().substring(0, 7);
    return (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas;
        if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).length * v;
        const pago = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
        return s + Math.max(0, Math.min(c.valorTotal - pago, aberto));
    }, 0);
}
// Movimentações efetivas do mês = lançamentos (sem compras de crédito) + 1 linha "Fatura" por cartão
function efetivos() {
    const ym = _mesSel(), ids = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') (c.compras || []).forEach(x => ids.add(x.id)); });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ id: -c.id, desc: 'Fatura ' + c.nome, valor: Math.round(t * 100) / 100, tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true });
    });
    return out;
}
['renderResumo', 'renderGraficoRank', 'coletarAvisos'].forEach(n => {
    const o = window[n];
    window[n] = function (...a) { const r = dados.movs; dados.movs = efetivos(); try { return o.apply(this, a); } finally { dados.movs = r; } };
});
const _renderExtratoO = window.renderExtrato;
window.renderExtrato = function () {
    const r = dados.movs, f = filtroAtual; let e = efetivos();
    if (f === 'fatura') e = e.filter(m => m.virtual); else if (f !== 'tudo') e = e.filter(m => !m.virtual);
    dados.movs = e; if (f === 'fatura' || f === 'tudo') filtroAtual = 'todos';
    try { _renderExtratoO(); } finally { dados.movs = r; filtroAtual = f; }
};
const _abrirModalMovO = window.abrirModalMov;
window.abrirModalMov = function (id) {
    if (id < 0) { setTimeout(() => { const m = bootstrap.Modal.getInstance(document.getElementById('modalMov')); if (m) m.hide(); verCompras(-id); }, 60); return; }
    _abrirModalMovO(id);
};

function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L || !H) return;
    const ym = _mesSel();
    const html = dados.cartoes.map(c => {
        const fat = itensFatura(c, ymFat(c, ym)).reduce((s, i) => s + i.valor, 0);
        return '<div class="col-6 mb-3"><div class="credit-card-container card-compact" style="background:' + c.cor + ';color:' + (c.corFonte || '#fff') + '" onclick="verCompras(' + c.id + ')">'
            + '<div class="card-header-ui"><div><h6 class="mb-0">' + escaparHTML(c.nome) + '</h6><small>' + escaparHTML(c.bandeira) + '</small></div>'
            + '<div class="dropdown" onclick="event.stopPropagation()"><i class="fas fa-ellipsis-v p-1" data-bs-toggle="dropdown"></i><ul class="dropdown-menu"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')">Editar Cartão</button></li></ul></div></div>'
            + '<div class="mt-3"><small class="d-block opacity-75">Fatura do mês</small><span class="fw-bold money-value">' + brl(fat) + '</span>'
            + '<small class="d-block opacity-75 mt-1">Disponível <span class="money-value">' + brl(c.limite - limiteUsado(c)) + '</span></small></div></div></div>';
    }).join('') || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
    L.innerHTML = html; H.innerHTML = html;
}
function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto); if (!card) return;
    const ym = _mesSel(), itens = itensFatura(card, ymFat(card, ym));
    const fat = itens.reduce((s, i) => s + i.valor, 0), usado = limiteUsado(card);
    const perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="card p-3 mb-3 border-0 shadow-sm rounded-4" style="background:' + card.cor + ';color:' + (card.corFonte || '#fff') + '">'
        + '<div class="d-flex justify-content-between"><span>Fatura: <b class="money-value">' + brl(fat) + '</b></span><span>Disponível: <b class="money-value">' + brl(card.limite - usado) + '</b></span></div>'
        + '<div class="card-limit-box"><div class="card-limit-progress" style="width:' + perc + '%"></div></div>'
        + '<div class="card-info-row"><span>Fecha dia ' + card.fecha + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.split('-').reverse().join('/') + '</span></div></div>';
    document.getElementById('lista-compras-cartao').innerHTML = itens.map(({ c, info, valor }) => {
        const pag = (c.pagamentos || []).reduce((a, p) => a + p.valor, 0), rest = Math.max(0, c.valorTotal - pag);
        return '<div class="card-mov align-items-start py-3 mb-2 shadow-sm rounded-3"><div class="flex-grow-1 ms-2">'
            + '<div class="fw-bold">' + escaparHTML(c.desc) + ' <span class="badge bg-purple" style="font-size:.65rem">' + (c.fixa ? '<i class="fas fa-rotate"></i> Fixo' : info) + '</span>'
            + (c.emprestado ? ' <span class="badge bg-warning text-dark" style="font-size:.6rem">EMPRESTADO</span>' : '') + (!c.fixa && rest <= 0 ? ' <span class="badge bg-success" style="font-size:.6rem">PAGO</span>' : '') + '</div>'
            + (c.fixa ? '<small class="text-muted d-block">Repete todo mês</small>' : '<small class="text-muted d-block">Total restante: ' + brl(rest) + ' de ' + brl(c.valorTotal) + '</small>')
            + (c.pagamentos && c.pagamentos.length ? '<div class="mt-2 p-2 bg-light rounded-3 border-start border-info border-3" style="font-size:.75rem"><b class="text-muted text-uppercase" style="font-size:.65rem">Pagamentos:</b>'
                + c.pagamentos.map(p => '<div>→ ' + brl(p.valor) + ' em ' + p.data + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('') + '</div>' : '')
            + '<small class="text-muted d-block mt-1" style="font-size:.7rem"><i class="far fa-calendar-alt me-1"></i>' + c.data.split('-').reverse().join('/') + (c.cat ? ' • ' + escaparHTML(c.cat) : '') + (c.local ? ' • ' + escaparHTML(c.local) : '') + '</small></div>'
            + '<div class="text-end me-2 fw-bold money-value">' + brl(valor) + '</div>'
            + '<div class="dropdown"><button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">'
            + '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-edit text-primary me-2"></i> Editar Compra</button></li>'
            + (c.fixa ? '' : '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'total\')"><i class="fas fa-check-circle text-success me-2"></i> Pagamento Total</button></li>'
                + '<li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(' + c.id + ',\'parcial\')"><i class="fas fa-coins text-warning me-2"></i> Pagamento Parcial</button></li>'
                + '<li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(' + c.id + ')"><i class="fas fa-forward text-info me-2"></i> Antecipar Parcelas</button></li>')
            + '</ul></div></div>';
    }).join('') || '<p class="text-center text-muted">Nenhuma compra nesta fatura.</p>';
}
// compra fixa: salva o flag (o interruptor existia mas não gravava nada)
const _salvarCompraO = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return;
    const idEdit = Number(document.getElementById('compra-id-edit').value) || 0, antes = JSON.stringify(card.compras);
    const p = parseInt(document.getElementById('compra-parcelas').value) || 1;
    if (p < 1 || p > 60) return alert('Parcelas: informe de 1 a 60.');
    const fixa = document.getElementById('compra-fixa').checked;
    _salvarCompraO();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { c.fixa = fixa; if (fixa) c.parcelas = 1; salvarERender(); renderComprasCartao(); }
};
const _abrirCompraO = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompraO(id);
    const c = id ? dados.cartoes.find(x => x.id == cartaoContexto).compras.find(x => x.id == id) : null;
    document.getElementById('compra-fixa').checked = !!(c && c.fixa);
    document.getElementById('compra-parcelas').disabled = !!(c && c.fixa);
};

// ---------- Bancos: cores pré-definidas ----------
const BANCOS = { 'Nubank': ['#8A05BE', '#ffffff'], 'Inter': ['#FF7A00', '#ffffff'], 'Itaú': ['#EC7000', '#ffffff'], 'Bradesco': ['#CC092F', '#ffffff'], 'Santander': ['#EC0000', '#ffffff'], 'Banco do Brasil': ['#FFEF38', '#000000'], 'Caixa': ['#0070AF', '#ffffff'], 'C6 Bank': ['#242424', '#ffffff'], 'PicPay': ['#11C76F', '#ffffff'], 'Mercado Pago': ['#009EE3', '#ffffff'], 'BTG Pactual': ['#001E62', '#ffffff'], 'Neon': ['#00E5E5', '#000000'], 'Next': ['#00FF5F', '#000000'], 'Original': ['#00A859', '#ffffff'], 'Sicredi': ['#3FA110', '#ffffff'], 'XP': ['#000000', '#ffffff'], 'Will Bank': ['#FFD100', '#000000'] };
function aplicarBanco() {
    const b = BANCOS[document.getElementById('card-banco').value]; if (!b) return;
    document.getElementById('card-cor-custom').value = b[0]; document.getElementById('card-cor-fonte').value = b[1];
}
function detectarBanco() {
    const n = document.getElementById('card-nome').value.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i');
    const k = Object.keys(BANCOS).find(b => n.includes(b.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i').split(' ')[0]));
    if (k && document.getElementById('card-banco').value !== k) { document.getElementById('card-banco').value = k; aplicarBanco(); }
}

// ---------- Dívidas parceladas ----------
const _abrirDividaO = window.abrirModalDivida;
window.abrirModalDivida = function (id) {
    _abrirDividaO(id);
    const d = id ? dados.dividas.find(x => x.id == id) : null;
    document.getElementById('div-parcelas').value = d ? (d.parcelas || 1) : 1;
};
const _addDividaO = window.addDivida;
window.addDivida = function () {
    const idEdit = Number(document.getElementById('div-id-edit').value) || 0, antes = JSON.stringify(dados.dividas);
    const velho = idEdit ? { ...dados.dividas.find(x => x.id === idEdit) } : null;
    const n = Math.max(1, Math.min(120, parseInt(document.getElementById('div-parcelas').value) || 1));
    _addDividaO();
    if (JSON.stringify(dados.dividas) === antes) return;
    const d = idEdit ? dados.dividas.find(x => x.id === idEdit) : dados.dividas[dados.dividas.length - 1];
    if (!d) return;
    d.parcelas = n; d.pagas = velho ? (velho.pagas || 0) : 0; d.valorTotal = velho ? (velho.valorTotal || d.valor) : d.valor;
    d.valorParcela = Math.round(d.valor / Math.max(1, n - d.pagas) * 100) / 100;
    salvarERender();
};
function pagarParcelaDivida(id) {
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const n = (d.pagas || 0) + 1, vp = Math.min(d.valorParcela || d.valor, d.valor), ultima = n >= d.parcelas || vp >= d.valor - 0.005;
    if (!confirm('Registrar o pagamento da parcela ' + n + '/' + d.parcelas + ' (' + brl(vp) + ')?')) return;
    d.obs = (d.obs || '') + '\n→ Parcela ' + n + '/' + d.parcelas + ' paga: ' + brl(vp) + ' (' + new Date().toLocaleDateString('pt-BR') + ')';
    d.pagas = n;
    if (ultima) {
        dados.dividas = dados.dividas.filter(x => x !== d);
        d.valor = d.valorTotal || vp; d.origem = 'dividas'; d.dataQuitacaoMs = Date.now(); dados.historicoQuitados.push(d);
    } else { d.valor = Math.round((d.valor - vp) * 100) / 100; if (d.prazo) d.prazo = addMesData(d.prazo); }
    salvarERender();
}

// ---------- Calendário (arquivo .ics: importa no Google/Apple/Outlook; UIDs fixos evitam duplicar ao reimportar) ----------
function _icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n'); }
function _icsDia(s, n) { const [a, m, d] = s.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return x.toISOString().substring(0, 10).replace(/-/g, ''); }
function baixarCalendario(somenteId) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z', L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Financas Pro//PT', 'CALSCALE:GREGORIAN'];
    const ev = (uid, data, titulo, desc, rr) => L.push('BEGIN:VEVENT', 'UID:' + uid + '@financaspro', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + _icsDia(data, 0), 'DTEND;VALUE=DATE:' + _icsDia(data, 1), 'SUMMARY:' + _icsEsc(titulo), 'DESCRIPTION:' + _icsEsc(desc), ...(rr ? ['RRULE:' + rr] : []), 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + _icsEsc(titulo), 'END:VALARM', 'END:VEVENT');
    let n = 0;
    dados.dividas.filter(d => d.prazo && (!somenteId || d.id === somenteId)).forEach(d => {
        const q = Math.max(1, (d.parcelas || 1) - (d.pagas || 0)), verbo = d.tipo === 'eu-devo' ? 'Pagar' : 'Receber'; let dt = d.prazo;
        for (let i = 0; i < q; i++) {
            const num = (d.pagas || 0) + 1 + i, val = (d.parcelas || 1) > 1 ? (d.valorParcela || d.valor) : d.valor;
            ev('divida-' + d.id + '-' + num, dt, verbo + ': ' + d.nome + ((d.parcelas || 1) > 1 ? ' (parcela ' + num + '/' + d.parcelas + ')' : '') + ' — ' + brl(val), d.desc || '', null); n++;
            dt = addMesData(dt);
        }
    });
    if (!somenteId) dados.cartoes.filter(c => c.tipo !== 'Débito' && parseInt(c.vence)).forEach(c => {
        const h = hojeISO(), ym = h.substring(0, 7), v = String(parseInt(c.vence)).padStart(2, '0'), dt = (ym + '-' + v) >= h ? ym + '-' + v : ymAdd(ym, 1) + '-' + v;
        ev('cartao-' + c.id, dt, 'Fatura ' + c.nome + ' vence', 'Vencimento mensal do cartão', 'FREQ=MONTHLY'); n++;
    });
    if (!n) return alert('Nenhuma dívida com prazo para sincronizar.');
    L.push('END:VCALENDAR');
    const url = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' })), a = document.createElement('a');
    a.href = url; a.download = 'financas_calendario.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function eventoCalendarioDivida(id) { baixarCalendario(Number(id)); }

// ---------- Metas fora do extrato ----------
function movimentarMeta(id, acao) {
    if (!verificarAcesso()) return;
    const meta = dados.metas.find(m => m.id == id); if (!meta) return;
    const txt = prompt(acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?'); if (!txt) return;
    const valor = parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return alert('Valor inválido!');
    if (acao !== 'poupar' && valor > meta.guardado) return alert('Saldo insuficiente na meta para resgate!');
    const ag = new Date();
    meta.guardado = Math.round((meta.guardado + (acao === 'poupar' ? valor : -valor)) * 100) / 100;
    (meta.historico = meta.historico || []).push({ tipo: acao, valor, data: ag.toLocaleDateString('pt-BR'), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0') });
    salvarERender();
}

document.addEventListener('DOMContentLoaded', () => {
    const n = document.getElementById('card-nome'); if (n) n.addEventListener('input', detectarBanco);
    if (!dados.migr2) { // remove do extrato os lançamentos antigos gerados por metas (continuam no histórico da própria meta)
        dados.movs = dados.movs.filter(m => !dados.metas.some(x => m.desc === 'Poupança: ' + x.nome || m.desc === 'Resgate: ' + x.nome));
        dados.migr2 = true; localStorage.setItem('financas_pro_max', JSON.stringify(dados));
    }
});
