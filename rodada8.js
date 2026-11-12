/* ===== Finanças Pro — Rodada 8: nova Início (estilo app de banco) + cartões redesenhados ===== */
const MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_IC = { 'Mercado': ['fa-cart-shopping', '#f59e0b'], 'Alimentação': ['fa-utensils', '#f97316'], 'Transporte': ['fa-car', '#3b82f6'], 'Moradia': ['fa-house', '#14b8a6'], 'Contas': ['fa-file-invoice-dollar', '#64748b'], 'Saúde': ['fa-heart-pulse', '#ef4444'], 'Educação': ['fa-graduation-cap', '#6366f1'], 'Lazer': ['fa-gamepad', '#a855f7'], 'Assinaturas': ['fa-repeat', '#ec4899'], 'Salário': ['fa-money-bill-wave', '#10b981'], 'Freelance': ['fa-laptop-code', '#0ea5e9'], 'Investimentos': ['fa-chart-line', '#22c55e'], 'Vendas': ['fa-tag', '#84cc16'], 'Dívidas': ['fa-handshake', '#8a2be2'], 'Cartão': ['fa-credit-card', '#6366f1'], 'Outros': ['fa-ellipsis', '#94a3b8'] };
function iconeCat(c) { return CAT_IC[c] || ['fa-receipt', '#8a2be2']; }
function shade(hex, p) { // escurece uma cor #rrggbb em p (0–1)
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#4f46e5';
    const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * (1 - p));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
const _isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const _dm = s => s.substring(8, 10) + '/' + s.substring(5, 7);

// ---------- Próximos lançamentos: fixos, parcelas/dívidas e faturas dos próximos 35 dias ----------
function proximos() {
    const hoje = hojeISO(), lim = new Date(); lim.setDate(lim.getDate() + 35); const limS = _isoDe(lim), out = [], g = {};
    dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    Object.values(g).filter(m => m.fixo).forEach(t => {
        const dia = parseInt(t.data.substring(8, 10));
        for (let i = 0; i <= 1; i++) {
            const ym = ymAdd(hoje.substring(0, 7), i), [a, mm] = ym.split('-').map(Number), dt = ym + '-' + String(Math.min(dia, new Date(a, mm, 0).getDate())).padStart(2, '0');
            if (dt >= hoje && dt <= limS) out.push({ data: dt, titulo: t.desc, sub: t.cat + ' | Recorrência', valor: t.valor, tipo: t.tipo, ic: iconeCat(t.cat) });
        }
    });
    dados.dividas.forEach(d => {
        if (!d.prazo || d.prazo > limS) return; const parc = (d.parcelas || 1) > 1;
        out.push({ data: d.prazo, titulo: d.nome, sub: (d.tipo === 'eu-devo' ? 'A pagar' : 'A receber') + (parc ? ' | Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : ' | Dívida'), valor: parc ? (d.valorParcela || d.valor) : d.valor, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', ic: ['fa-handshake', '#8a2be2'], atrasada: d.prazo < hoje, dividas: 1 });
    });
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito' || !parseInt(c.vence)) return;
        const v = String(parseInt(c.vence)).padStart(2, '0'); let ym = hoje.substring(0, 7); if (ym + '-' + v < hoje) ym = ymAdd(ym, 1);
        const dt = ym + '-' + v; if (dt > limS) return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ data: dt, titulo: 'Fatura ' + c.nome, sub: 'Cartão | Fatura', valor: t, tipo: 'saida', ic: ['fa-credit-card', c.cor || '#6366f1'], cartao: c.id });
    });
    return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 10);
}
function abrirTransacao(id) {
    if (id < 0) return verCompras(-id);
    abrirModalMov(id); const el = document.getElementById('modalMov'); (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show();
}
function renderHome() {
    const ym = _mesSel(), [a, m] = ym.split('-').map(Number), anoAtual = new Date().getFullYear();
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    set('hero-mes-ant', MESES_C[(m + 10) % 12]); set('hero-mes-prox', MESES_C[m % 12]); set('hero-mes-atual', MESES_C[m - 1] + (a !== anoAtual ? ' ' + a : ''));
    const h = new Date(); set('hero-atualizado', 'Atualizado às ' + String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0'));
    const seq = sequenciaDias(), sq = document.getElementById('hero-seq'); if (sq) sq.innerHTML = seq > 0 ? '<span class="chip-seq"><i class="fas fa-fire me-1"></i>' + seq + (seq === 1 ? ' dia' : ' dias') + '</span>' : '';
    // próximos lançamentos
    const px = proximos(), P = document.getElementById('home-proximos');
    if (P) P.innerHTML = px.map(x => {
        const [ic, cor] = x.ic, ent = x.tipo === 'entrada', acao = x.cartao ? 'verCompras(' + x.cartao + ')' : x.dividas ? "showSection('dividas')" : "showSection('aba-fixos')";
        return '<div class="prox-card" onclick="' + acao + '"><div class="prox-top"><span class="ic-box" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span><b>' + escaparHTML(x.titulo) + '</b></div>'
            + '<small class="text-muted d-block mt-1">' + escaparHTML(x.sub) + '</small><div class="prox-bot"><small class="' + (x.atrasada ? 'text-danger fw-bold' : 'text-muted') + '">' + _dm(x.data) + (x.atrasada ? ' • vencida' : '') + '</small><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + brl(x.valor) + '</b></div></div>';
    }).join('') || '<div class="prox-card text-muted small">Nada previsto para os próximos 35 dias </div>';
    // últimas transações
    const L = document.getElementById('lista-recente'); if (!L) return;
    const tr = efetivos().filter(x => x.data && x.data.startsWith(ym)).sort(ordemMov).slice(0, 6);
    L.innerHTML = tr.map(x => {
        const [ic, cor] = iconeCat(x.cat), ent = x.tipo === 'entrada';
        return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : ent ? 'Receita' : 'Despesa') + (x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + (ent ? '' : '-') + brl(x.valor) + '</b><small>' + _dm(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
    }).join('') || '<div class="text-center text-muted py-4 small">Nenhuma transação neste mês.<br>Toque em <b>＋</b> para lançar a primeira.</div>';
}
const _renderResumoO8 = window.renderResumo;
window.renderResumo = function () { _renderResumoO8(); renderHome(); };

// ---------- Cartões redesenhados ----------
function bandeiraIcone(b) {
    b = (b || '').toLowerCase();
    return b.includes('visa') ? '<i class="fab fa-cc-visa"></i>' : b.includes('master') ? '<i class="fab fa-cc-mastercard"></i>' : (b.includes('amex') || b.includes('american')) ? '<i class="fab fa-cc-amex"></i>' : b.includes('diners') ? '<i class="fab fa-cc-diners-club"></i>' : '<span class="fp-band">' + escaparHTML(b.toUpperCase().slice(0, 8)) + '</span>';
}
function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L) return;
    const ym = _mesSel(), mesNome = MESES_C[parseInt(ym.slice(5)) - 1];
    const html = dados.cartoes.map(c => {
        const deb = c.tipo === 'Débito', cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : '#6366f1', fg = c.corFonte || '#fff';
        const fat = deb ? 0 : itensFatura(c, ymFat(c, ym)).reduce((s, i) => s + i.valor, 0), usado = limiteUsado(c), perc = c.limite > 0 ? Math.min(100, usado / c.limite * 100) : 0;
        return '<div class="fp-cartao" style="background:linear-gradient(135deg,' + cor + ' 0%,' + shade(cor, .45) + ' 100%);color:' + fg + '" onclick="if(!event.target.closest(\'.dropdown\'))verCompras(' + c.id + ')"><div class="fp-deco"></div>'
            + '<div class="fp-c-top"><div><b class="fp-c-nome">' + escaparHTML(c.nome) + '</b><small class="d-block fp-sub">' + (deb ? 'Débito' : 'Crédito') + (c.final ? ' •••• ' + escaparHTML(c.final) : '') + '</small></div>'
            + '<div class="d-flex align-items-center gap-2"><span class="fp-bandeira">' + bandeiraIcone(c.bandeira) + '</span><div class="dropdown"><button type="button" class="fp-menu-btn" data-bs-toggle="dropdown" aria-label="Opções do cartão"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar cartão</button></li></ul></div></div></div>'
            + '<div class="fp-mid"><small class="fp-sub">' + (deb ? 'Cartão de débito' : 'Fatura de ' + mesNome) + '</small><div class="fp-valor money-value">' + (deb ? 'Sem fatura' : brl(fat)) + '</div>' + (deb ? '' : '<span class="fp-pill">Vence dia ' + String(c.vence).padStart(2, '0') + ' • Fecha dia ' + String(c.fecha).padStart(2, '0') + '</span>') + '</div>'
            + '<div class="fp-bot"><div class="fp-bar"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Disponível <b class="money-value">' + brl(c.limite - usado) + '</b></span><span>Limite ' + brl(c.limite) + '</span></div></div></div>';
    }).join('') + '<div class="fp-cartao fp-novo" onclick="abrirModalCartao()"><i class="fas fa-plus"></i><span>Adicionar cartão</span></div>';
    L.innerHTML = html; if (H) H.innerHTML = html;
}
