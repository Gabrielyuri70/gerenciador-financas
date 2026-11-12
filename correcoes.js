/* ===== Finanças Pro — Correções (Rodada 1) | carregado DEPOIS do script.js ===== */

// ---------- Utilitários ----------
function hojeISO() { // data LOCAL (o toISOString original usava UTC e virava o dia às 21h)
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ordemMov(a, b) { return (b.data || '').localeCompare(a.data || '') || (b.hora || '').localeCompare(a.hora || '') || (b.id - a.id); }
function escaparHTML(s) {
    return (s === undefined || s === null) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function brl(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function lerMoeda(id) { return parseFloat((document.getElementById(id).value || '').replace(/\./g, '').replace(',', '.')) || 0; }
function ehVisitante() { return sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante'; }

// Proteção global: o modo visitante NUNCA pode sobrescrever os dados reais (toggleTema/olho faziam isso)
const _setItemOriginal = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && (k === 'financas_pro_max' || k === 'financas_notas') && ehVisitante()) return;
    return _setItemOriginal.call(this, k, v);
};

// ---------- Lançamentos ----------
const _salvarMovOriginal = window.salvarMov;
window.salvarMov = function () {
    if (!document.getElementById('mov-desc').value.trim() || lerMoeda('mov-valor') <= 0) {
        return alert('Informe a descrição e um valor maior que zero.');
    }
    _salvarMovOriginal();
};

function moverMovParaLixeira() {
    const id = Number(document.getElementById('mov-id-edit').value);
    const idx = dados.movs.findIndex(m => m.id === id);
    if (idx < 0 || !confirm('Deseja enviar para a lixeira?')) return;
    const item = dados.movs.splice(idx, 1)[0];
    if (item.fixo && item.data) { // evita que o lançamento fixo "ressuscite" no mesmo mês
        (dados.fixosIgnorados = dados.fixosIgnorados || []).push(item.tipo + '|' + item.desc + '|' + item.data.substring(0, 7));
    }
    item.origem = 'movs';
    item.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(item);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalMov')); if (m) m.hide();
}

// Recorrência: preenche TODOS os meses que faltam (não só o atual), sem duplicar e respeitando exclusões
function processarLancamentosFixos() {
    const ym = hojeISO().substring(0, 7);
    const ign = (dados.fixosIgnorados = dados.fixosIgnorados || []);
    const grupos = {};
    dados.movs.forEach(m => {
        if (!m.data || !m.desc) return;
        const k = m.tipo + '|' + m.desc;
        if (!grupos[k] || m.data > grupos[k].data) grupos[k] = m;
    });
    let mudou = false;
    Object.values(grupos).forEach(t => {
        if (!t.fixo) return; // desmarcar "Fixo" no lançamento mais recente cancela a repetição
        const prim = dados.movs.filter(x => x.fixo && x.tipo === t.tipo && x.desc === t.desc).sort((x, y) => x.data.localeCompare(y.data))[0];
        const dia = parseInt((prim || t).data.substring(8, 10)) || 1;
        let [a, mm] = t.data.substring(0, 7).split('-').map(Number);
        for (;;) {
            mm++; if (mm > 12) { mm = 1; a++; }
            const alvo = a + '-' + String(mm).padStart(2, '0');
            if (alvo > ym) break;
            const existe = dados.movs.some(x => x.tipo === t.tipo && x.desc === t.desc && x.data && x.data.startsWith(alvo));
            if (existe || ign.includes(t.tipo + '|' + t.desc + '|' + alvo)) continue;
            const ultimo = new Date(a, mm, 0).getDate();
            dados.movs.push({ ...t, id: Date.now() + Math.floor(Math.random() * 1e6), data: alvo + '-' + String(Math.min(dia, ultimo)).padStart(2, '0') });
            mudou = true;
        }
    });
    if (mudou) salvarERender();
}

// ---------- Lixeira ----------
function restaurarDaLixeira(id) {
    const i = dados.lixeira.findIndex(m => m.id === Number(id));
    if (i < 0) return;
    const it = dados.lixeira.splice(i, 1)[0];
    const dest = it.origem || 'movs';
    delete it.origem; delete it.deletadoEm; delete it.lixeiraTitulo;
    (dados[dest] = dados[dest] || []).push(it);
    salvarERender(); renderLixeira();
}

// ---------- Dívidas ----------
function excluirDivida() {
    const id = Number(document.getElementById('div-id-edit').value);
    const i = dados.dividas.findIndex(d => d.id === id);
    if (i < 0 || !confirm('Mover este registro para a lixeira?')) return;
    const it = dados.dividas.splice(i, 1)[0];
    it.origem = 'dividas'; it.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(it);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalDivida')); if (m) m.hide();
}

const _confirmarPagamentoOriginal = window.confirmarPagamento;
window.confirmarPagamento = function () {
    const modo = document.getElementById('pag-modo').value;
    const id = Number(document.getElementById('pag-id').value);
    const v = lerMoeda('pag-valor');
    if (modo === 'parcial' || modo === 'parcial-cartao') {
        if (v <= 0) return alert('Informe um valor maior que zero.');
        if (modo === 'parcial-cartao') {
            const card = dados.cartoes.find(x => x.id == cartaoContexto);
            const c = card && card.compras.find(x => x.id === id);
            const restante = c ? c.valorTotal - (c.pagamentos || []).reduce((s, p) => s + p.valor, 0) : 0;
            if (v > restante + 0.005) return alert('O valor é maior que o saldo restante desta compra (' + brl(restante) + ').');
        } else {
            const d = dados.dividas.find(x => x.id === id);
            if (d && v >= d.valor) document.getElementById('pag-modo').value = 'total'; // pagou tudo = quitada (antes ficava com saldo 0 para sempre)
        }
    }
    _confirmarPagamentoOriginal();
};

const _tratarFiltroOriginal = window.tratarFiltroEOrdenacao;
window.tratarFiltroEOrdenacao = function (v) {
    _tratarFiltroOriginal(v);
    if (v.startsWith('status-')) {
        const sel = document.getElementById('ordenar-divida'); if (sel) sel.value = v;
        document.querySelectorAll('#filtros-rapidos-status .btn-status-filter').forEach(b => {
            const m = (b.getAttribute('onclick') || '').match(/'([^']+)'/);
            b.classList.toggle('active', !!m && m[1] === v);
        });
    }
};
const _limparFiltrosOriginal = window.limparFiltrosDivida;
window.limparFiltrosDivida = function () { _limparFiltrosOriginal(); window.tratarFiltroEOrdenacao('status-todas'); };

// ---------- Metas ----------
const _salvarMetaOriginal = window.salvarMeta;
window.salvarMeta = function () {
    const ini = document.getElementById('meta-data-inicio').value, fim = document.getElementById('meta-data-fim').value;
    if (ini && fim && fim < ini) return alert('A data alvo não pode ser anterior à data de início.');
    const n = dados.metas.length;
    _salvarMetaOriginal();
    if (dados.metas.length > n) { const m = bootstrap.Modal.getInstance(document.getElementById('modalMeta')); if (m) m.hide(); }
};

// ---------- Calculadora ----------
const _calcResultadoOriginal = window.calcResultado;
window.calcResultado = function () { // "05+3" quebrava (zero à esquerda = erro de sintaxe)
    calcExpressao = calcExpressao.replace(/(^|[^\d.])0+(?=\d)/g, '$1');
    _calcResultadoOriginal();
};

// ---------- Notificações (virada de mês, vencidas, backup real) ----------
function coletarAvisos() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const lim = new Date(hoje); lim.setDate(lim.getDate() + 3);
    const av = [];
    dados.dividas.forEach(d => {
        if (!d.prazo) return;
        const p = new Date(d.prazo + 'T00:00:00'), dt = d.prazo.split('-').reverse().join('/');
        if (p < hoje) av.push('[erro] VENCIDA: ' + d.nome + ' (' + dt + ')');
        else if (p <= new Date(hoje.getTime() + (parseInt(d.lembrete) || 3) * 864e5)) av.push('[aviso] ' + (d.tipo === 'eu-devo' ? 'A PAGAR' : 'A RECEBER') + ': ' + d.nome + ' vence ' + dt);
    });
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence); if (!v) return;
        for (let i = 0; i <= 3; i++) { const x = new Date(hoje); x.setDate(x.getDate() + i); if (x.getDate() === v) { av.push('[cartao] Fatura do ' + c.nome + ' vence dia ' + v); break; } }
    });
    const mes = document.getElementById('mes-atual').value; let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mes)).forEach(m => { if (m.tipo === 'entrada') ent += m.valor; else sai += m.valor; });
    if (ent > 0 && sai > ent * 0.8) av.push('[grafico] Você já gastou ' + Math.round(sai / ent * 100) + '% das receitas de ' + mes.split('-').reverse().join('/') + '.');
    const ub = dados.config.ultimoBackup;
    if (dados.movs.length > 20 && (!ub || Date.now() - ub > 30 * 864e5)) av.push('[backup] Faça um backup: Menu → Sistema e Backup → Exportar Dados.');
    return av;
}
function verificarNotificacoes() {
    if (!document.getElementById('mes-atual')) return;
    const n = coletarAvisos().length, b = document.getElementById('badge-notificacao');
    if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); }
}
function abrirNotificacoes() {
    const a = coletarAvisos();
    alert(a.length ? 'CENTRAL DE LEMBRETES:\n\n' + a.join('\n\n') : 'Tudo sob controle! Nenhuma pendência urgente.');
}

// ---------- Backup / Importar / Zerar ----------
function exportarBackup() {
    dados.config.ultimoBackup = Date.now();
    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
    const pacote = { ...dados, notas: (typeof notas !== 'undefined' ? notas : []), _exportadoEm: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(pacote)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'backup_financas_' + hojeISO() + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    verificarNotificacoes();
}
function abrirImportar() {
    if (!verificarAcesso()) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = ev => {
            try {
                const n = JSON.parse(ev.target.result);
                if (!n || typeof n !== 'object' || Array.isArray(n) || !Array.isArray(n.movs)) throw new Error('formato');
                ['cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados', 'revenda', 'fixosIgnorados', 'clientes'].forEach(k => { if (!Array.isArray(n[k])) n[k] = []; });
                if (!n.config || typeof n.config !== 'object') n.config = { dark: false, oculto: false };
                if (!confirm('Importar ' + n.movs.length + ' lançamentos? Isso SUBSTITUI todos os dados atuais deste aparelho.')) return;
                const nn = Array.isArray(n.notas) ? n.notas : null; delete n.notas; delete n._exportadoEm;
                localStorage.setItem('financas_pro_max', JSON.stringify(n));
                if (nn) localStorage.setItem('financas_notas', JSON.stringify(nn));
                location.reload();
            } catch (err) { alert('Arquivo inválido! Use um backup exportado pelo próprio app.'); }
        };
        rd.readAsText(f);
    };
    inp.click();
}
function resetarApp() {
    if (!verificarAcesso()) return;
    if (!confirm('Isso apaga TODOS os dados e a conta deste aparelho. Exporte um backup antes. Continuar?')) return;
    if (!confirm('Última confirmação: apagar tudo de forma definitiva?')) return;
    ['financas_pro_max', 'financas_notas', 'financas_auth', 'user_lembrado'].forEach(k => localStorage.removeItem(k));
    sessionStorage.clear(); location.reload();
}

// ---------- Autenticação (senha e resposta agora são guardadas com hash + salt) ----------
/*SHA_START*/
function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    const mp = Math.pow, mw = mp(2, 32);
    let i, j, result = '', words = [], bitLen = ascii.length * 8;
    const hash = [], k = [], isC = {}; let pc = 0;
    for (let c = 2; pc < 64; c++) {
        if (!isC[c]) { for (i = 0; i < 313; i += c) isC[i] = c; hash[pc] = (mp(c, .5) * mw) | 0; k[pc++] = (mp(c, 1 / 3) * mw) | 0; }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bitLen / mw) | 0); words[words.length] = bitLen;
    let H = hash.slice(0, 8);
    for (j = 0; j < words.length;) {
        const w = words.slice(j, j += 16), old = H; let h = H.slice(0, 8);
        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2], a = h[0], e = h[4];
            const t1 = h[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & h[5]) ^ ((~e) & h[6])) + k[i]
                + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
            const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
            h = [(t1 + t2) | 0].concat(h); h[4] = (h[4] + t1) | 0; h.length = 8;
        }
        for (i = 0; i < 8; i++) h[i] = (h[i] + old[i]) | 0;
        H = h;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { const b = (H[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
}
/*SHA_END*/
function hashSenha(s, salt) { return sha256(unescape(encodeURIComponent(salt + '|' + s))); }
function normResp(r) { return String(r).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function getAuth() { try { return JSON.parse(localStorage.getItem('financas_auth')); } catch (e) { return null; } }
function salvarAuth(a) { localStorage.setItem('financas_auth', JSON.stringify(a)); }
function conferirSenha(a, p) { return a.passHash ? hashSenha(p, a.salt) === a.passHash : a.pass === p; }
function conferirResposta(a, r) { return a.respHash ? hashSenha(normResp(r), a.salt) === a.respHash : String(a.resposta) === r.trim().toLowerCase(); }
function migrarAuth(a) { // contas antigas (texto puro) são convertidas automaticamente no primeiro login
    if (a.passHash) return a;
    a.salt = Date.now().toString(36) + Math.random().toString(36).slice(2);
    a.passHash = hashSenha(a.pass || '', a.salt);
    a.respHash = hashSenha(normResp(a.resposta || ''), a.salt);
    delete a.pass; delete a.resposta;
    return a;
}
function cadastrarUsuario() {
    const u = document.getElementById('user-reg').value.trim(), p = document.getElementById('pass-reg').value.trim();
    const q = document.getElementById('pergunta-reg').value, r = document.getElementById('resposta-reg').value.trim();
    if (!u || !p || !r) return alert('Preencha todos os campos!');
    if (p.length < 4) return alert('A senha precisa ter pelo menos 4 caracteres.');
    if (getAuth()) return alert('Já existe uma conta neste aparelho. Use "Esqueci a senha" para redefinir o acesso.');
    const salt = Date.now().toString(36) + Math.random().toString(36).slice(2);
    salvarAuth({ user: u, salt, passHash: hashSenha(p, salt), pergunta: q, respHash: hashSenha(normResp(r), salt) });
    alert('Conta criada com sucesso!'); toggleAuth('login');
}
function fazerLogin() {
    const u = document.getElementById('user-login').value.trim(), p = document.getElementById('pass-login').value.trim();
    const a = getAuth();
    if (!a) return alert('Nenhuma conta encontrada! Por favor, cadastre-se.');
    if (u !== a.user || !conferirSenha(a, p)) return alert('Usuário ou senha incorretos!');
    salvarAuth(migrarAuth(a));
    if (document.getElementById('lembrar-login').checked) localStorage.setItem('user_lembrado', u); else localStorage.removeItem('user_lembrado');
    sessionStorage.setItem('user_ativo', u); usuarioAtivo = u;
    atualizarNomeUsuarioTela(u);
    document.getElementById('tela-login').style.display = 'none';
    processarLancamentosFixos(); renderTudo();
}
function validarRespostaSeguranca() {
    const a = getAuth();
    if (a && conferirResposta(a, document.getElementById('resposta-rec').value)) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else alert('Resposta incorreta!');
}
function redefinirSenha() {
    const np = document.getElementById('nova-pass-rec').value.trim();
    if (np.length < 4) return alert('A nova senha precisa ter pelo menos 4 caracteres.');
    const a = migrarAuth(getAuth());
    a.passHash = hashSenha(np, a.salt); salvarAuth(a);
    alert('Senha alterada! Faça login novamente.'); toggleAuth('login');
}
function atualizarPerfilUsuario() {
    if (!verificarAcesso()) return;
    let a = getAuth(); if (!a) return alert('Conta não encontrada!');
    const nu = document.getElementById('novo-user-perfil').value.trim(), np = document.getElementById('nova-pass-perfil').value.trim();
    if (!nu) return alert('O campo de usuário não pode ficar vazio!');
    if (!conferirSenha(a, document.getElementById('senha-atual-perfil').value.trim())) return alert('Senha atual incorreta!');
    if (np && np.length < 4) return alert('A nova senha precisa ter pelo menos 4 caracteres.');
    a = migrarAuth(a); a.user = nu;
    if (np) a.passHash = hashSenha(np, a.salt);
    salvarAuth(a);
    if (localStorage.getItem('user_lembrado')) localStorage.setItem('user_lembrado', nu);
    sessionStorage.setItem('user_ativo', nu); usuarioAtivo = nu; atualizarNomeUsuarioTela(nu);
    document.getElementById('nova-pass-perfil').value = ''; document.getElementById('senha-atual-perfil').value = '';
    alert('Perfil atualizado com sucesso!');
}

// ---------- Controle de Revenda (a tela existia, mas NENHUMA função estava implementada) ----------
function abrirModalRevenda(id) {
    if (!verificarAcesso()) return;
    dados.revenda = dados.revenda || [];
    const p = id ? dados.revenda.find(x => x.id === Number(id)) : null;
    const set = (k, v) => { document.getElementById(k).value = v; };
    const m2 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    set('revenda-id-edit', p ? p.id : ''); set('revenda-nome', p ? p.nome : ''); set('revenda-cat', p ? p.cat : 'Outros');
    set('revenda-vlr-compra', p ? m2(p.compra) : ''); set('revenda-vlr-venda', p ? m2(p.venda) : ''); set('revenda-qtd', p ? p.qtd : 1);
    document.getElementById('btn-excluir-revenda').classList.toggle('d-none', !p);
    const el = document.getElementById('modalProdutoRevenda');
    (bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el)).show();
}
function salvarProdutoRevenda() {
    if (!verificarAcesso()) return;
    const nome = document.getElementById('revenda-nome').value.trim(), compra = lerMoeda('revenda-vlr-compra'), venda = lerMoeda('revenda-vlr-venda');
    const qtd = parseInt(document.getElementById('revenda-qtd').value) || 0;
    if (!nome || venda <= 0 || qtd < 1) return alert('Informe o nome, o valor de venda e a quantidade (mínimo 1).');
    dados.revenda = dados.revenda || [];
    const id = Number(document.getElementById('revenda-id-edit').value) || 0;
    const antigo = id ? dados.revenda.find(x => x.id === id) : null;
    const p = { id: id || Date.now(), nome, cat: document.getElementById('revenda-cat').value, compra, venda, qtd, vendidos: antigo ? (antigo.vendidos || 0) : 0 };
    const idx = dados.revenda.findIndex(x => x.id === p.id);
    if (idx > -1) dados.revenda[idx] = p; else dados.revenda.push(p);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalProdutoRevenda')); if (m) m.hide();
}
function excluirProdutoRevenda() {
    const id = Number(document.getElementById('revenda-id-edit').value);
    const i = (dados.revenda || []).findIndex(x => x.id === id);
    if (i < 0 || !confirm('Mover este produto para a lixeira?')) return;
    const it = dados.revenda.splice(i, 1)[0];
    it.origem = 'revenda'; it.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(it);
    salvarERender();
    const m = bootstrap.Modal.getInstance(document.getElementById('modalProdutoRevenda')); if (m) m.hide();
}
function venderProdutoRevenda(id) {
    if (!verificarAcesso()) return;
    const p = (dados.revenda || []).find(x => x.id === Number(id));
    if (!p || p.qtd < 1) return;
    if (!confirm('Registrar a venda de 1 unidade de "' + p.nome + '" por ' + brl(p.venda) + '?\nSerá lançada como Receita no extrato.')) return;
    p.qtd--; p.vendidos = (p.vendidos || 0) + 1;
    const ag = new Date();
    dados.movs.push({ id: Date.now(), desc: 'Venda: ' + p.nome, valor: p.venda, tipo: 'entrada', cat: 'Outros', data: hojeISO(), hora: String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0'), fixo: false });
    salvarERender();
}
function renderRevenda() {
    const l = document.getElementById('lista-produtos-revenda'); if (!l) return;
    const R = dados.revenda || []; let prev = 0, luc = 0;
    R.forEach(p => { prev += p.venda * p.qtd; luc += (p.venda - p.compra) * p.qtd; });
    const t1 = document.getElementById('total-venda-revenda'), t2 = document.getElementById('lucro-total-revenda');
    t1.innerText = brl(prev); t2.innerText = brl(luc); t1.classList.add('money-value'); t2.classList.add('money-value');
    document.getElementById('revenda-vazio').classList.toggle('d-none', R.length > 0);
    l.innerHTML = R.map(p => {
        const lu = p.venda - p.compra, mg = p.venda > 0 ? Math.round(lu / p.venda * 100) : 0;
        return '<div class="col-12"><div class="card-mov align-items-start py-3"><div class="flex-grow-1">'
            + '<div class="fw-bold">' + escaparHTML(p.nome) + '</div>'
            + '<small class="text-muted d-block">' + escaparHTML(p.cat) + ' • Estoque: ' + p.qtd + ' • Vendidos: ' + (p.vendidos || 0) + '</small>'
            + '<small class="d-block money-value">Compra ' + brl(p.compra) + ' → Venda ' + brl(p.venda) + '</small>'
            + '<small class="fw-bold money-value ' + (lu >= 0 ? 'text-success' : 'text-danger') + '">Lucro/un.: ' + brl(lu) + ' (' + mg + '%)</small></div>'
            + '<div class="d-flex flex-column gap-1"><button class="btn btn-sm btn-outline-success" onclick="venderProdutoRevenda(' + p.id + ')"' + (p.qtd < 1 ? ' disabled' : '') + '>Vender 1</button>'
            + '<button class="btn btn-sm btn-outline-secondary" onclick="abrirModalRevenda(' + p.id + ')">Editar</button></div></div></div>';
    }).join('');
}
const _renderTudoOriginal = window.renderTudo;
window.renderTudo = function () { _renderTudoOriginal(); renderRevenda(); };

// ---------- Inicialização das correções ----------
document.addEventListener('DOMContentLoaded', () => {
    ['revenda', 'fixosIgnorados'].forEach(k => { if (!Array.isArray(dados[k])) dados[k] = []; });
    ['revenda-vlr-compra', 'revenda-vlr-venda'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', mascaraMoeda); });
    const mm = document.getElementById('modalMeta');
    if (mm) mm.addEventListener('show.bs.modal', () => { const i = document.getElementById('meta-data-inicio'); if (!i.value) i.value = hojeISO(); });
    ['user-login', 'pass-login'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); }); });
});
