/* ===== Finanças Pro — Rodada 13: formulários completos + Gerenciamento de Clientes ===== */
const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência', 'Cheque', 'Outro'];
const _v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const _set = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v === undefined || v === null) ? '' : v; };
const _dig = s => String(s || '').replace(/\D/g, '');
const _fd = s => s ? s.split('-').reverse().join('/') : '';
const _optForma = '<option value="">Não informar</option>' + FORMAS.map(f => '<option>' + f + '</option>').join('');
function clientes() { return dados.clientes || (dados.clientes = []); }
function popularClientes(selId, sel) {
    const s = document.getElementById(selId); if (!s) return;
    s.innerHTML = '<option value="">Sem cliente</option>' + clientes().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join('');
    s.value = sel || '';
}
function _injetar(sel, html) { const b = document.querySelector(sel); if (b) b.parentElement.insertAdjacentHTML('beforebegin', html); }

// ---------- Formulário: Lançamento ----------
const _abrirMov13 = window.abrirModalMov;
window.abrirModalMov = function (id) {
    const m = id > 0 ? dados.movs.find(x => x.id == id) : null;
    _abrirMov13(id); if (id < 0) return;
    popularClientes('mov-cliente', m && m.clienteId); _set('mov-forma', m && m.forma); _set('mov-local', m && m.local); _set('mov-tags', m && m.tags); _set('mov-obs', m && m.obs);
    const d = document.getElementById('mov-mais'); if (d) d.open = !!(m && (m.local || m.tags || m.obs));
};
const _salvarMov13 = window.salvarMov;
window.salvarMov = function () {
    const idEdit = Number(_v('mov-id-edit')) || 0, antes = JSON.stringify(dados.movs); _salvarMov13();
    if (JSON.stringify(dados.movs) === antes) return;
    const m = idEdit ? dados.movs.find(x => x.id === idEdit) : dados.movs[dados.movs.length - 1]; if (!m) return;
    Object.assign(m, { forma: _v('mov-forma'), clienteId: Number(_v('mov-cliente')) || null, local: _v('mov-local').trim(), tags: _v('mov-tags').trim(), obs: _v('mov-obs').trim() }); salvarERender();
};

// ---------- Formulário: Cartão ----------
const _abrirCartao13 = window.abrirModalCartao;
window.abrirModalCartao = function (id) {
    _abrirCartao13(id); const c = id ? dados.cartoes.find(x => x.id == id) : null;
    _set('card-final', c && c.final); _set('card-titular', c && c.titular); _set('card-anuidade', c && c.anuidade ? c.anuidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''); _set('card-obs', c && c.obs);
    const d = document.getElementById('card-mais'); if (d) d.open = !!(c && (c.final || c.titular || c.anuidade || c.obs));
};
const _addCartao13 = window.addCartao;
window.addCartao = function () {
    const idEdit = Number(_v('card-id-edit')) || 0, antes = JSON.stringify(dados.cartoes); _addCartao13();
    if (JSON.stringify(dados.cartoes) === antes) return;
    const c = idEdit ? dados.cartoes.find(x => x.id === idEdit) : dados.cartoes[dados.cartoes.length - 1]; if (!c) return;
    Object.assign(c, { final: _dig(_v('card-final')).slice(-4), titular: _v('card-titular').trim(), anuidade: lerMoeda('card-anuidade'), obs: _v('card-obs').trim() }); salvarERender();
};

// ---------- Formulário: Compra no cartão (com prévia da fatura) ----------
function previewCompra() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto), el = document.getElementById('compra-preview'); if (!card || !el) return;
    const v = lerMoeda('compra-valor'), n = Math.max(1, parseInt(_v('compra-parcelas')) || 1), data = _v('compra-data') || hojeISO(), fixa = document.getElementById('compra-fixa').checked;
    if (v <= 0) { el.innerHTML = '<i class="fas fa-circle-info me-1"></i>Informe o valor para ver em qual fatura a compra cai.'; return; }
    const ym = mesFatura(card, { data }), [a, m] = ym.split('-').map(Number);
    el.innerHTML = '<i class="fas fa-circle-info me-1"></i>' + (fixa ? 'Todo mês de ' : n + 'x de ') + '<b>' + brl(fixa ? v : v / n) + '</b> • 1ª fatura em <b>' + MESES_C[m - 1] + '/' + a + '</b> (fecha dia ' + card.fecha + ')' + (!fixa && n > 1 ? ' • termina em <b>' + MESES_C[(m + n - 2) % 12] + '/' + (a + Math.floor((m + n - 2) / 12)) + '</b>' : '');
}
const _abrirCompra13 = window.abrirModalCompraCartao;
window.abrirModalCompraCartao = function (id) {
    _abrirCompra13(id); const card = dados.cartoes.find(x => x.id == cartaoContexto), c = id && card ? card.compras.find(x => x.id == id) : null;
    const s = document.getElementById('compra-cat'); if (s) { const l = cats().saida.filter(x => x !== 'Cartão'); if (c && c.cat && !l.includes(c.cat)) l.push(c.cat); s.innerHTML = '<option value="">Sem categoria</option>' + l.map(x => '<option>' + escaparHTML(x) + '</option>').join(''); s.value = (c && c.cat) || ''; }
    _set('compra-local', c && c.local); _set('compra-obs', c && c.obs); previewCompra();
};
const _salvarCompra13 = window.salvarCompraCartao;
window.salvarCompraCartao = function () {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto)); if (!card) return _salvarCompra13();
    const idEdit = Number(_v('compra-id-edit')) || 0, antes = JSON.stringify(card.compras); _salvarCompra13();
    if (JSON.stringify(card.compras) === antes) return;
    const c = idEdit ? card.compras.find(x => x.id === idEdit) : card.compras[card.compras.length - 1];
    if (c) { Object.assign(c, { cat: _v('compra-cat'), local: _v('compra-local').trim(), obs: _v('compra-obs').trim() }); salvarERender(); renderComprasCartao(); }
};

// ---------- Formulário: Dívida ----------
const _abrirDiv13 = window.abrirModalDivida;
window.abrirModalDivida = function (id) {
    _abrirDiv13(id); const d = id ? dados.dividas.find(x => x.id == id) : null;
    popularClientes('div-cliente', d && d.clienteId); _set('div-doc', d && d.doc); _set('div-email', d && d.email); _set('div-juros', d && d.juros); _set('div-forma', d && d.forma); _set('div-prio', d && d.prio || 'normal'); _set('div-lembrete', d && d.lembrete || 3);
    const x = document.getElementById('div-mais'); if (x) x.open = !!(d && (d.clienteId || d.doc || d.email || d.juros || d.forma || d.prio === 'alta'));
};
function preencherDeCliente() {
    const c = clientes().find(x => x.id === Number(_v('div-cliente'))); if (!c) return;
    _set('div-nome', c.nome); _set('div-whats', c.tel); _set('div-doc', c.doc); _set('div-email', c.email); if (_v('div-tipo') !== 'me-devem') _set('div-tipo', 'me-devem');
}
const _addDiv13 = window.addDivida;
window.addDivida = function () {
    const idEdit = Number(_v('div-id-edit')) || 0, antes = JSON.stringify(dados.dividas); _addDiv13();
    if (JSON.stringify(dados.dividas) === antes) return;
    const d = idEdit ? dados.dividas.find(x => x.id === idEdit) : dados.dividas[dados.dividas.length - 1]; if (!d) return;
    Object.assign(d, { clienteId: Number(_v('div-cliente')) || null, doc: _v('div-doc').trim(), email: _v('div-email').trim(), juros: parseFloat(_v('div-juros').replace(',', '.')) || 0, forma: _v('div-forma'), prio: _v('div-prio'), lembrete: parseInt(_v('div-lembrete')) || 3 }); salvarERender();
};

// ---------- Clientes ----------
let _cliFiltro = 'todos';
function resumoCliente(c) {
    const movs = dados.movs.filter(m => m.clienteId === c.id), ent = movs.filter(m => m.tipo === 'entrada'), hoje = hojeISO();
    const abertas = dados.dividas.filter(d => d.clienteId === c.id && d.tipo === 'me-devem'), rec = ent.reduce((s, m) => s + m.valor, 0);
    return { movs, abertas, recebido: rec, aberto: abertas.reduce((s, d) => s + d.valor, 0), vencido: abertas.filter(d => d.prazo && d.prazo < hoje).reduce((s, d) => s + d.valor, 0), ticket: ent.length ? rec / ent.length : 0, ultimo: ent.map(m => m.data).sort().pop() || '' };
}
function niverMes(c) { return c.nasc && c.nasc.substring(5, 7) === hojeISO().substring(5, 7); }
function setCliFiltro(f) { _cliFiltro = f; renderClientes(); }
function renderClientes() {
    const L = document.getElementById('lista-clientes'); if (!L) return; const q = (_v('busca-cliente') || '').toLowerCase(), C = clientes();
    document.querySelectorAll('#cli-chips .btn-status-filter').forEach(b => b.classList.toggle('active', b.dataset.f === _cliFiltro));
    const info = C.map(c => ({ c, r: resumoCliente(c) }));
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('cli-total', C.filter(c => c.status !== 'inativo').length); set('cli-aberto', brl(info.reduce((s, x) => s + x.r.aberto, 0)));
    const lista = info.filter(({ c, r }) => (!q || [c.nome, c.tel, c.email, c.doc, c.segmento, c.tags].join(' ').toLowerCase().includes(q)) && (_cliFiltro === 'todos' || (_cliFiltro === 'devendo' ? r.aberto > 0 : _cliFiltro === 'niver' ? niverMes(c) : (c.status || 'ativo') === _cliFiltro))).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
    L.innerHTML = lista.map(({ c, r }) => '<div class="div-item" onclick="verCliente(' + c.id + ')" style="cursor:pointer"><span class="div-av ' + (r.vencido > 0 ? 'pagar' : 'receber') + '">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span>'
        + '<div class="div-mid"><b>' + escaparHTML(c.nome) + '</b><small>' + escaparHTML(c.tel || c.email || 'Sem contato') + (c.segmento ? ' • ' + escaparHTML(c.segmento) : '') + '</small>'
        + '<span class="chip-st st-' + (c.status || 'ativo') + '">' + ({ ativo: 'Ativo', lead: 'Lead', inativo: 'Inativo' }[c.status || 'ativo']) + '</span>' + (niverMes(c) ? ' <span class="chip-st st-lead"><i class="fas fa-cake-candles"></i> Aniversário no mês</span>' : '') + '</div>'
        + '<div class="div-val">' + (r.aberto > 0 ? '<span class="text-danger money-value">' + brl(r.aberto) + '</span><small>em aberto</small>' : '<span class="money-value">' + (r.recebido > 0 ? brl(r.recebido) : '—') + '</span><small>' + (r.recebido > 0 ? 'recebido' : 'sem movimento') + '</small>') + '</div></div>').join('')
        || '<div class="text-center text-muted py-4 small">' + (C.length ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente cadastrado ainda.<br>Toque em <b>Novo cliente</b> para começar.') + '</div>';
}
function _modalDin(id, html) {
    let m = document.getElementById(id); if (!m) { m = document.createElement('div'); m.className = 'modal fade'; m.id = id; m.tabIndex = -1; document.body.appendChild(m); }
    m.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button>' + html + '</div></div>';
    return bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m);
}
function _ocultar(id) { const m = document.getElementById(id); const i = m && bootstrap.Modal.getInstance(m); if (i) i.hide(); }
function abrirModalCliente(id) {
    if (!verificarAcesso()) return; const c = id ? clientes().find(x => x.id === Number(id)) : {}; const o = (arr, v) => arr.map(([k, t]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + t + '</option>').join(''), val = k => escaparHTML(c[k] || '');
    const f = (rot, idc, k, ph = '', tp = 'text') => '<div class="col-12"><label class="small fw-bold">' + rot + '</label><input type="' + tp + '" id="cli-' + idc + '" class="form-control" placeholder="' + ph + '" value="' + val(k) + '"></div>';
    _modalDin('modalCliente', '<div class="modal-body p-4"><h5 class="fw-bold mb-3">' + (id ? 'Editar cliente' : 'Novo cliente') + '</h5><div class="row g-2">'
        + f('Nome / Razão social *', 'nome', 'nome', 'Nome completo')
        + '<div class="col-6"><label class="small fw-bold">Tipo</label><select id="cli-tipo" class="form-select">' + o([['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']], c.tipo || 'PF') + '</select></div><div class="col-6"><label class="small fw-bold">Status</label><select id="cli-status" class="form-select">' + o([['ativo', 'Ativo'], ['lead', 'Lead / Prospect'], ['inativo', 'Inativo']], c.status || 'ativo') + '</select></div>'
        + f('CPF / CNPJ', 'doc', 'doc', '000.000.000-00') + f('WhatsApp / Telefone', 'tel', 'tel', 'DDD + número', 'tel') + f('E-mail', 'email', 'email', 'nome@email.com', 'email')
        + '<div class="col-5"><label class="small fw-bold">CEP</label><input id="cli-cep" class="form-control" value="' + val('cep') + '" inputmode="numeric"></div><div class="col-7"><label class="small fw-bold">Cidade / UF</label><input id="cli-cidade" class="form-control" value="' + val('cidade') + '"></div>' + f('Endereço', 'end', 'endereco', 'Rua, número, bairro')
        + '<div class="col-6"><label class="small fw-bold">Aniversário</label><input type="date" id="cli-nasc" class="form-control" value="' + val('nasc') + '"></div><div class="col-6"><label class="small fw-bold">Como chegou</label><select id="cli-origem" class="form-select">' + o([['', 'Não informar'], ['Indicação', 'Indicação'], ['Instagram', 'Instagram'], ['WhatsApp', 'WhatsApp'], ['Site', 'Site'], ['Presencial', 'Presencial'], ['Outro', 'Outro']], c.canal || '') + '</select></div>'
        + f('Segmento / Tipo de cliente', 'seg', 'segmento', 'Ex: Revenda, Serviço, Atacado') + f('Tags (separe por vírgula)', 'tags', 'tags', 'vip, parcelado')
        + '<div class="col-12"><label class="small fw-bold">Observações</label><textarea id="cli-obs" class="form-control" rows="2">' + val('obs') + '</textarea></div></div>'
        + '<div class="d-flex gap-2 mt-3"><button class="btn btn-primary flex-grow-1" onclick="salvarCliente(' + (id ? Number(id) : 0) + ')">Salvar cliente</button>' + (id ? '<button class="btn btn-outline-danger" onclick="excluirCliente(' + Number(id) + ')"><i class="fas fa-trash"></i></button>' : '') + '</div></div>').show();
}
function salvarCliente(id) {
    const nome = _v('cli-nome').trim(); if (!nome) return alert('Informe o nome do cliente.');
    const ant = id ? clientes().find(x => x.id === id) : null, c = { id: id || Date.now(), nome, tipo: _v('cli-tipo'), status: _v('cli-status'), doc: _v('cli-doc').trim(), tel: _v('cli-tel').trim(), email: _v('cli-email').trim(), cep: _v('cli-cep').trim(), cidade: _v('cli-cidade').trim(), endereco: _v('cli-end').trim(), nasc: _v('cli-nasc'), canal: _v('cli-origem'), segmento: _v('cli-seg').trim(), tags: _v('cli-tags').trim(), obs: _v('cli-obs').trim(), criado: ant ? ant.criado : hojeISO(), interacoes: ant ? ant.interacoes || [] : [] };
    const i = clientes().findIndex(x => x.id === c.id); if (i > -1) clientes()[i] = c; else clientes().push(c);
    salvarERender(); _ocultar('modalCliente'); renderClientes();
}
function excluirCliente(id) {
    const i = clientes().findIndex(x => x.id === id); if (i < 0 || !confirm('Mover este cliente para a lixeira? Os lançamentos e dívidas continuam, mas deixam de estar ligados a ele.')) return;
    const c = clientes().splice(i, 1)[0]; c.origem = 'clientes'; c.deletadoEm = new Date().toLocaleDateString('pt-BR'); c.lixeiraTitulo = 'Cliente: ' + c.nome; dados.lixeira.push(c); salvarERender(); _ocultar('modalCliente'); _ocultar('modalClienteDet'); renderClientes();
}
function verCliente(id) {
    const c = clientes().find(x => x.id === Number(id)); if (!c) return; const r = resumoCliente(c), wa = _dig(c.tel), waN = wa.length <= 11 ? '55' + wa : wa, hoje = hojeISO();
    const tile = (t, v, cls = '') => '<div class="home-tile"><div><small>' + t + '</small><b class="money-value ' + cls + '">' + v + '</b></div></div>', lin = (ic, t) => t ? '<div class="cli-lin"><i class="fas ' + ic + '"></i><span>' + escaparHTML(t) + '</span></div>' : '';
    const tags = (c.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '<span class="chip-st st-inativo">' + escaparHTML(t) + '</span>').join(' ');
    _modalDin('modalClienteDet', '<div class="modal-body p-4"><div class="d-flex align-items-center gap-3 mb-3"><span class="div-av receber" style="width:52px;height:52px;flex:0 0 52px;font-size:1.3rem">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span><div class="flex-grow-1 min-w-0"><h5 class="fw-bold mb-0">' + escaparHTML(c.nome) + '</h5><small class="text-muted">' + (c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') + ' • cliente desde ' + _fd(c.criado) + '</small></div><button class="div-icon-btn" onclick="_ocultar(\'modalClienteDet\');abrirModalCliente(' + c.id + ')" title="Editar"><i class="fas fa-pen"></i></button></div>'
        + '<div class="d-flex gap-2 mb-3">' + (wa ? '<a class="btn btn-sm btn-outline-primary flex-fill" target="_blank" href="https://wa.me/' + waN + '"><i class="fab fa-whatsapp me-1"></i>WhatsApp</a><a class="btn btn-sm btn-outline-primary flex-fill" href="tel:' + wa + '"><i class="fas fa-phone me-1"></i>Ligar</a>' : '') + (c.email ? '<a class="btn btn-sm btn-outline-primary flex-fill" href="mailto:' + escaparHTML(c.email) + '"><i class="fas fa-envelope me-1"></i>E-mail</a>' : '') + '</div>'
        + '<div class="home-tiles" style="margin-bottom:12px">' + tile('Total recebido', brl(r.recebido), 'text-success') + tile('Em aberto', brl(r.aberto), r.aberto > 0 ? 'text-danger' : '') + tile('Vencido', brl(r.vencido), r.vencido > 0 ? 'text-danger' : '') + tile('Ticket médio', brl(r.ticket)) + '</div>'
        + '<div class="d-flex gap-2 mb-3"><button class="btn btn-primary btn-sm flex-fill" onclick="novoLancCliente(' + c.id + ')"><i class="fas fa-plus me-1"></i>Novo lançamento</button><button class="btn btn-outline-primary btn-sm flex-fill" onclick="novaCobranca(' + c.id + ')"><i class="fas fa-file-invoice-dollar me-1"></i>Nova cobrança</button></div>'
        + '<div class="mb-3">' + lin('fa-id-card', c.doc) + lin('fa-phone', c.tel) + lin('fa-envelope', c.email) + lin('fa-location-dot', [c.endereco, c.cidade, c.cep].filter(Boolean).join(' • ')) + lin('fa-cake-candles', c.nasc ? 'Aniversário: ' + _fd(c.nasc).substring(0, 5) : '') + lin('fa-bullseye', c.canal ? 'Origem: ' + c.canal : '') + lin('fa-briefcase', c.segmento) + (tags ? '<div class="mt-2">' + tags + '</div>' : '') + (c.obs ? '<div class="cli-obs">' + escaparHTML(c.obs) + '</div>' : '') + '</div>'
        + '<h6 class="fw-bold small text-uppercase text-muted">Cobranças em aberto</h6>' + (r.abertas.map(d => '<div class="div-item mb-2"><div class="div-mid"><b>' + escaparHTML(d.desc || d.nome) + '</b><small>' + (d.prazo ? 'Vence ' + _fd(d.prazo) : 'Sem prazo') + ((d.parcelas || 1) > 1 ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : '') + '</small>' + (d.prazo && d.prazo < hoje ? '<span class="chip-st st-venc">Vencida</span>' : '') + '</div><div class="div-val money-value">' + brl(d.valor) + '</div><button class="btn btn-sm btn-outline-success" onclick="_ocultar(\'modalClienteDet\');prepararPagamento(' + d.id + ',\'total\')">Receber</button></div>').join('') || '<p class="small text-muted">Nada em aberto.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Últimos lançamentos</h6>' + (r.movs.slice().sort(ordemMov).slice(0, 5).map(m => '<div class="d-flex justify-content-between small py-1 border-bottom"><span>' + _fd(m.data).substring(0, 5) + ' • ' + escaparHTML(m.desc) + '</span><b class="money-value ' + (m.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + brl(m.valor) + '</b></div>').join('') || '<p class="small text-muted">Sem lançamentos ligados a este cliente.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Histórico de contatos</h6><div id="cli-hist">' + (c.interacoes || []).slice().reverse().map(i => '<div class="cli-int"><small class="text-muted">' + _fd(i.data) + '</small><div>' + escaparHTML(i.texto) + '</div></div>').join('') + '</div>'
        + '<div class="d-flex gap-2 mt-2"><input id="cli-int-txt" class="form-control form-control-sm" placeholder="Registrar contato (ligou, enviou orçamento...)"><button class="btn btn-sm btn-primary" onclick="addInteracao(' + c.id + ')"><i class="fas fa-plus"></i></button></div></div>').show();
}
function addInteracao(id) { const t = _v('cli-int-txt').trim(); if (!t) return; const c = clientes().find(x => x.id === id); (c.interacoes = c.interacoes || []).push({ data: hojeISO(), texto: t.slice(0, 300) }); salvarERender(); verCliente(id); }
function novoLancCliente(id) {
    _ocultar('modalClienteDet'); abrirModalMov(); _set('mov-tipo', 'entrada'); document.getElementById('mov-tipo').dispatchEvent(new Event('change')); popularClientes('mov-cliente', id);
    const el = document.getElementById('modalMov'); setTimeout(() => (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show(), 250);
}
function novaCobranca(id) {
    _ocultar('modalClienteDet'); setTimeout(() => { abrirModalDivida(); _set('div-tipo', 'me-devem'); popularClientes('div-cliente', id); preencherDeCliente(); }, 250);
}
function exportarClientesCSV() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    if (!clientes().length) return alert('Nenhum cliente para exportar.');
    const csv = '\uFEFFNome;Tipo;Status;Documento;Telefone;E-mail;Cidade;Segmento;Origem;Tags;Recebido;Em aberto\r\n' + clientes().map(c => { const r = resumoCliente(c); return [q(c.nome), c.tipo, c.status, q(c.doc), q(c.tel), q(c.email), q(c.cidade), q(c.segmento), q(c.canal), q(c.tags), r.recebido.toFixed(2).replace('.', ','), r.aberto.toFixed(2).replace('.', ',')].join(';'); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
TITULOS['aba-clientes'] = 'Clientes';
const _showSection13 = window.showSection;
window.showSection = function (id, b) { _showSection13(id, b); if (id === 'aba-clientes') renderClientes(); };

document.addEventListener('DOMContentLoaded', () => {
    if (!Array.isArray(dados.clientes)) dados.clientes = [];
    const sel = (id, extra = '') => '<select id="' + id + '" class="form-select" ' + extra + '>';
    _injetar('#modalMov button[onclick="salvarMov()"]',
        '<div class="row g-2 mb-3"><div class="col-6"><label class="small fw-bold">Forma de pagamento</label>' + sel('mov-forma') + _optForma + '</select></div><div class="col-6"><label class="small fw-bold">Cliente (opcional)</label>' + sel('mov-cliente') + '</select></div></div>'
        + '<details id="mov-mais" class="mais-det mb-3"><summary>Mais detalhes</summary><div class="pt-2"><label class="small fw-bold">Local / Estabelecimento</label><input id="mov-local" class="form-control mb-2" placeholder="Ex: Atacadão, Posto Shell"><label class="small fw-bold">Tags</label><input id="mov-tags" class="form-control mb-2" placeholder="Ex: casa, viagem, trabalho"><label class="small fw-bold">Observações</label><textarea id="mov-obs" class="form-control" rows="2"></textarea></div></details>');
    _injetar('#modalCartao button[onclick="addCartao()"]',
        '<details id="card-mais" class="mais-det mb-3"><summary>Mais detalhes</summary><div class="row g-2 pt-2"><div class="col-5"><label class="small">Final (4 dígitos)</label><input id="card-final" class="form-control" maxlength="4" inputmode="numeric" placeholder="1234"></div><div class="col-7"><label class="small">Anuidade (R$)</label><input id="card-anuidade" class="form-control" inputmode="numeric" placeholder="0,00"></div><div class="col-12"><label class="small">Titular</label><input id="card-titular" class="form-control" placeholder="Nome impresso"></div><div class="col-12"><label class="small">Observações</label><textarea id="card-obs" class="form-control" rows="2"></textarea></div></div></details>');
    const an = document.getElementById('card-anuidade'); if (an) an.addEventListener('input', mascaraMoeda);
    _injetar('#modalCompraCartao button[onclick="salvarCompraCartao()"]',
        '<div id="compra-preview" class="compra-prev mb-3"></div><div class="row g-2 mb-3"><div class="col-6"><label class="small">Categoria</label><select id="compra-cat" class="form-select"></select></div><div class="col-6"><label class="small">Local / Loja</label><input id="compra-local" class="form-control" placeholder="Ex: Amazon"></div><div class="col-12"><label class="small">Observações</label><input id="compra-obs" class="form-control" placeholder="Opcional"></div></div>');
    ['compra-valor', 'compra-parcelas', 'compra-data', 'compra-fixa'].forEach(i => { const e = document.getElementById(i); if (e) { e.addEventListener('input', previewCompra); e.addEventListener('change', previewCompra); } });
    _injetar('#modalDivida button[onclick="addDivida()"]',
        '<details id="div-mais" class="mais-det mb-3"><summary>Mais detalhes (cliente, juros, prioridade)</summary><div class="row g-2 pt-2"><div class="col-12"><label class="small">Cliente cadastrado</label><select id="div-cliente" class="form-select" onchange="preencherDeCliente()"></select></div>'
        + '<div class="col-6"><label class="small">CPF / CNPJ</label><input id="div-doc" class="form-control"></div><div class="col-6"><label class="small">E-mail</label><input id="div-email" type="email" class="form-control"></div>'
        + '<div class="col-6"><label class="small">Juros ao mês (%)</label><input id="div-juros" class="form-control" inputmode="decimal" placeholder="0"></div><div class="col-6"><label class="small">Forma de pagamento</label>' + sel('div-forma') + _optForma + '</select></div>'
        + '<div class="col-6"><label class="small">Prioridade</label><select id="div-prio" class="form-select"><option value="normal">Normal</option><option value="alta">Alta</option></select></div><div class="col-6"><label class="small">Avisar quantos dias antes</label><input id="div-lembrete" type="number" min="0" max="30" class="form-control" value="3"></div></div></details>');
});
