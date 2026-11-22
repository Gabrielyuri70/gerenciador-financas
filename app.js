/* =====================================================================
   Finanças Pro — app.js (arquivo único do aplicativo)

   Índice
     1. Estado e utilitários
     2. Avisos na tela e janelas (modais)
     3. Autenticação e perfil
     4. Navegação e topo
     5. Lançamentos (extrato) e categorias
     6. Contas fixas
     7. Cartões, faturas e compras
     8. Dívidas
     9. Metas
    10. Notas
    11. Clientes
    12. Revenda
    13. Início, gráficos e análises
    14. Calculadora
    15. Tema, PIN, avisos, backup e calendário
    16. Inicialização
   ===================================================================== */

/* ===================================================================
   1. ESTADO E UTILITÁRIOS
   =================================================================== */
const CHAVE_DADOS = 'financas_pro_max', CHAVE_NOTAS = 'financas_notas', CHAVE_AUTH = 'financas_auth';
const MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const LISTAS = ['movs', 'cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados', 'revenda', 'fixosIgnorados', 'clientes', 'movDividas'];

function novoDados() {
    const d = { config: { dark: false, oculto: false } };
    LISTAS.forEach(k => { d[k] = []; });
    return d;
}
function normalizarDados(d) { // garante a estrutura mesmo com backups/versões antigas
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = novoDados();
    LISTAS.forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.config || typeof d.config !== 'object') d.config = { dark: false, oculto: false };
    try { migrarPagamentosCartao(d); } catch (e) { console.error('migração de parcelas', e); }
    try { migrarMovsDividas(d); } catch (e) { console.error('migração de dívidas', e); }
    return d;
}
// Pagamentos/recebimentos de dívidas saem do extrato geral e vão para o extrato próprio das Dívidas
function migrarMovsDividas(d) {
    if (d.config.migMovDiv) return; d.config.migMovDiv = 1;
    const ant = [], resto = [];
    d.movs.forEach(m => { if (m.cat === 'Dívidas' && /^(Pagamento|Recebimento): /.test(m.desc || '')) ant.push(m); else resto.push(m); });
    if (!ant.length) return;
    ant.forEach(m => d.movDividas.push({ id: m.id, dividaId: 0, nome: m.desc.replace(/^(Pagamento|Recebimento): /, '').replace(/ \(dia \d+\)$/, ''), tipo: m.tipo === 'entrada' ? 'me-devem' : 'eu-devo', desc: '', valor: m.valor, data: m.data, hora: m.hora || '', modo: 'migrado', ref: '', parcelas: 0, forma: '', obs: '', antes: null }));
    d.movs = resto;
}
// Pagamentos antigos eram um "saldo acumulado" da compra. Agora cada pagamento pertence a UMA parcela (p.ym = mês da fatura).
function migrarPagamentosCartao(d) {
    (d.cartoes || []).forEach(card => (card.compras || []).forEach(c => {
        if (c.pagV2) return; c.pagV2 = true; if (c.fixa) return;
        const pags = c.pagamentos || [], parc = c.valorTotal / (c.parcelas || 1), base = mesFatura(card, c), novos = [], ocup = {};
        let pool = 0, dt = '', hr = '';
        pags.forEach(p => {
            if (p.ym) { novos.push(p); ocup[p.ym] = (ocup[p.ym] || 0) + p.valor; return; }
            if (p.antecipada) { const ym = ymAdd(base, Number(p.numParcela) || 0); novos.push({ ...p, ym }); ocup[ym] = (ocup[ym] || 0) + p.valor; return; }
            pool += p.valor; dt = p.data; hr = p.hora;
        });
        for (let i = 0; i < (c.parcelas || 1) && pool > 0.004; i++) { // mesma regra antiga: o saldo pago cobre as parcelas em ordem
            const ym = ymAdd(base, i), falta = Math.max(0, parc - (ocup[ym] || 0)); if (falta <= 0.004) continue;
            const v = Math.min(falta, pool); novos.push({ valor: Math.round(v * 100) / 100, data: dt, hora: hr, ym, migrada: true }); pool -= v;
        }
        c.pagamentos = novos;
    }));
}
let dados = (() => {
    try { const s = localStorage.getItem(CHAVE_DADOS); return normalizarDados(s && s !== 'undefined' ? JSON.parse(s) : null); }
    catch (e) { console.error('Falha ao ler localStorage, usando dados vazios:', e); return novoDados(); }
})();
let notas = (() => { try { const n = JSON.parse(localStorage.getItem(CHAVE_NOTAS)); return Array.isArray(n) ? n : []; } catch (e) { return []; } })();

let usuarioAtivo = sessionStorage.getItem('user_ativo') || localStorage.getItem('user_lembrado') || null;
let mesAtual = '';                 // mês selecionado (AAAA-MM), definido na inicialização
let filtroAtual = 'tudo';          // extrato: todos | fatura | tudo | entrada | saida
let buscaAtual = '';               // extrato: texto da busca
let cartaoContexto = null;         // cartão aberto na tela de compras
let diaAtual = '';                 // extrato: '' = mês inteiro, ou um dia (AAAA-MM-DD)
let abaCartao = 'fatura';          // tela do cartão: fatura | todas
let buscaDividaAtual = '', ordemDividaAtual = 'data-recente', statusDividaAtual = 'todas';
let meuGrafico = null, _secAtual = 'inicio';

// ---------- datas e formatação ----------
function hojeISO() { // data LOCAL (toISOString usa UTC e virava o dia às 21h)
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const isoDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const horaAgora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const dataBR = s => s ? s.split('-').reverse().join('/') : '';
const dataCompletaBR = s => s.substring(8, 10) + '/' + s.substring(5, 7) + '/' + s.substring(0, 4);
const diaMes = s => s.substring(8, 10) + '/' + s.substring(5, 7);
const rotuloMes = ym => ym.split('-').reverse().join('/');
const _mesSel = () => mesAtual;
function ymAdd(ym, n) { let [a, m] = ym.split('-').map(Number); m += n; a += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return a + '-' + String(m).padStart(2, '0'); }
function addMesData(s) { const [a, m, d] = s.split('-').map(Number), ym = ymAdd(a + '-' + String(m).padStart(2, '0'), 1), [a2, m2] = ym.split('-').map(Number); return ym + '-' + String(Math.min(d, new Date(a2, m2, 0).getDate())).padStart(2, '0'); }
function ordemMov(a, b) { return (b.data || '').localeCompare(a.data || '') || (b.hora || '').localeCompare(a.hora || '') || (b.id - a.id); }
function escaparHTML(s) { return (s === undefined || s === null) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function brl(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const arred = v => Math.round(v * 100) / 100;
const fmtMoeda = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // valor para dentro de campos com máscara
const soDigitos = s => String(s || '').replace(/\D/g, '');

// ---------- campos de formulário ----------
const campo = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const setCampo = (id, v) => { const e = document.getElementById(id); if (e) e.value = (v === undefined || v === null) ? '' : v; };
const marcado = id => { const e = document.getElementById(id); return !!(e && e.checked); };
function lerMoeda(id) { return parseFloat((campo(id) || '').replace(/\./g, '').replace(',', '.')) || 0; }
function mascaraMoeda(ev) { // máscara 1.234,56 enquanto digita
    const n = ev.target.value.replace(/\D/g, '');
    ev.target.value = n ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(n) / 100) : '';
}

// ---------- gravação ----------
function ehVisitante() { return sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante'; }
// O modo visitante NUNCA grava: senão apagaria os dados reais do aparelho.
function persistir() { if (!ehVisitante()) localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados)); }
function persistirNotas() { if (!ehVisitante()) localStorage.setItem(CHAVE_NOTAS, JSON.stringify(notas)); }
function salvarERender() {
    if (ehVisitante()) { renderTudo(); return; }
    const mb = (JSON.stringify(dados).length * 2) / (1024 * 1024);
    if (mb > 4.5) avisar('ATENÇÃO: seu armazenamento local está quase cheio (' + mb.toFixed(2) + 'MB). Exporte um backup agora para não perder dados!', 'erro');
    persistir();
    renderTudo();
}

/* ===================================================================
   2. AVISOS NA TELA E JANELAS (MODAIS)
   =================================================================== */
function avisar(msg, tipo) { // aviso na tela (no lugar do alert bloqueante)
    let c = document.getElementById('toast-box');
    if (!c) { c = document.createElement('div'); c.id = 'toast-box'; document.body.appendChild(c); }
    const erro = tipo ? tipo === 'erro' : /incorret|inválid|Informe|insuficiente|maior que|Erro|não pode|Preencha|Cadastre|Selecione/i.test(msg);
    const t = document.createElement('div');
    t.className = 'toast-fp ' + (erro ? 'erro' : 'ok');
    t.innerHTML = '<i class="fas ' + (erro ? 'fa-circle-exclamation' : 'fa-circle-check') + ' me-2"></i>' + escaparHTML(msg);
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));
    t.onclick = () => t.remove();
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, Math.min(12000, 2500 + String(msg).length * 45));
}
const erro = msg => avisar(msg, 'erro');

// Uma única instância por janela (criar várias deixava fundos escuros "presos" na tela)
function mostrarModal(id) { const el = document.getElementById(id); if (el) bootstrap.Modal.getOrCreateInstance(el).show(); }
function ocultarModal(id) { const el = document.getElementById(id), i = el && bootstrap.Modal.getInstance(el); if (i) i.hide(); }
const _ocultar = ocultarModal;
function modalDin(id, html, form) { // janela criada por código (clientes, avisos...). form=true usa o layout de formulário
    let m = document.getElementById(id);
    if (!m) { m = document.createElement('div'); m.className = 'modal fade'; m.id = id; m.tabIndex = -1; document.body.appendChild(m); }
    m.classList.toggle('frm-modal', !!form);
    m.innerHTML = form ? '<div class="modal-dialog modal-dialog-centered"><div class="modal-content frm">' + html + '</div></div>'
        : '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><button type="button" class="btn-close fp-x" data-bs-dismiss="modal" aria-label="Fechar"></button>' + html + '</div></div>';
    if (form) iniciarFormularios(m);
    return bootstrap.Modal.getOrCreateInstance(m);
}
// ---------- controles dos formulários: segmentado, atalhos, prévias ----------
function iniciarFormularios(raiz) {
    (raiz || document).querySelectorAll('.frm-seg[data-for]').forEach(seg => {
        if (seg.dataset.pronto) return; const sel = document.getElementById(seg.dataset.for); if (!sel) return; seg.dataset.pronto = 1;
        seg.innerHTML = [...sel.options].map(o => '<button type="button" data-v="' + o.value + '">' + o.text + '</button>').join('');
        seg.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; sel.value = b.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true })); sincronizarFormularios(); });
    });
    (raiz || document).querySelectorAll('.frm-chips[data-for]').forEach(box => {
        if (box.dataset.pronto) return; const inp = document.getElementById(box.dataset.for); if (!inp) return; box.dataset.pronto = 1;
        box.innerHTML = box.dataset.vals.split(',').map(v => '<button type="button" data-v="' + v + '">' + v + (box.dataset.suf || '') + '</button>').join('');
        box.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b || inp.disabled) return; inp.value = b.dataset.v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); sincronizarFormularios(); });
    });
    sincronizarFormularios();
}
function sincronizarFormularios() {
    document.querySelectorAll('.frm-seg[data-for]').forEach(seg => {
        const sel = document.getElementById(seg.dataset.for); if (!sel) return;
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sel.value));
        if (seg.dataset.tones) { const m = seg.closest('.frm-modal'); if (m) m.dataset.tone = sel.value; }
    });
    document.querySelectorAll('.frm-chips[data-for]').forEach(box => { const i = document.getElementById(box.dataset.for); if (i) box.querySelectorAll('button').forEach(b => { b.classList.toggle('on', String(i.value) === b.dataset.v); b.disabled = i.disabled; }); });
    const cp = document.getElementById('card-preview');
    if (cp) { // cartão: prévia ao vivo e ciclo só para crédito
        const cor = campo('card-cor-custom') || '#57005F', final = soDigitos(campo('card-final')).slice(-4), deb = campo('card-tipo') === 'Débito';
        cp.style.background = 'linear-gradient(135deg,' + cor + ',' + shade(cor, .35) + ')'; cp.style.color = campo('card-cor-fonte') || '#fff';
        document.getElementById('cp-nome').innerText = campo('card-nome').trim() || 'Nome do cartão';
        document.getElementById('cp-num').innerText = '•••• •••• •••• ' + (final || '••••');
        document.getElementById('cp-info').innerText = [campo('card-banco'), campo('card-bandeira')].filter(Boolean).join(' • ');
        document.getElementById('cp-tipo').innerText = campo('card-tipo') || 'Crédito';
        const w = document.getElementById('card-ciclo-wrap'); if (w) w.classList.toggle('d-none', deb);
    }
    const rm = document.getElementById('revenda-margem');
    if (rm) { // revenda: lucro e margem
        const c = lerMoeda('revenda-vlr-compra'), v = lerMoeda('revenda-vlr-venda'), q = Math.max(1, parseInt(campo('revenda-qtd')) || 1);
        rm.innerHTML = (c > 0 && v > 0) ? 'Lucro por unidade: <b class="' + (v >= c ? 'text-success' : 'text-danger') + '">' + brl(v - c) + '</b> • Margem <b>' + (((v - c) / v) * 100).toFixed(0) + '%</b> • Lucro no estoque (' + q + '): <b>' + brl((v - c) * q) + '</b>' : 'Informe custo e venda para ver o lucro.';
    }
}
function ajustarQtdRevenda(n) { const i = document.getElementById('revenda-qtd'); i.value = Math.max(1, (parseInt(i.value) || 1) + n); sincronizarFormularios(); }
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.frm')) sincronizarFormularios(); });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('.frm')) sincronizarFormularios(); });
document.addEventListener('show.bs.modal', () => setTimeout(sincronizarFormularios, 0));
// Se sobrar algum fundo escuro sem janela aberta (toque duplo, por exemplo), limpa a tela.
function limparFundosPresos() {
    if (document.querySelector('.modal.show, .modal[style*="display: block"], .offcanvas.show')) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open'); document.body.style.removeProperty('overflow'); document.body.style.removeProperty('padding-right');
}

/* ===================================================================
   3. AUTENTICAÇÃO E PERFIL
      (senha e resposta secreta são guardadas com hash SHA-256 + salt;
       é proteção local do aparelho — o app não tem servidor)
   =================================================================== */
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
function hashSenha(s, salt) { return sha256(unescape(encodeURIComponent(salt + '|' + s))); }
function normResp(r) { return String(r).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function getAuth() { try { return JSON.parse(localStorage.getItem(CHAVE_AUTH)); } catch (e) { return null; } }
function salvarAuth(a) { localStorage.setItem(CHAVE_AUTH, JSON.stringify(a)); }
function novoSalt() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function conferirSenha(a, p) { return a.passHash ? hashSenha(p, a.salt) === a.passHash : a.pass === p; }
function conferirResposta(a, r) { return a.respHash ? hashSenha(normResp(r), a.salt) === a.respHash : String(a.resposta) === r.trim().toLowerCase(); }
function migrarAuth(a) { // contas antigas (texto puro) viram hash no primeiro login
    if (a.passHash) return a;
    a.salt = novoSalt();
    a.passHash = hashSenha(a.pass || '', a.salt);
    a.respHash = hashSenha(normResp(a.resposta || ''), a.salt);
    delete a.pass; delete a.resposta;
    return a;
}
function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId), ver = input.type === 'password';
    input.type = ver ? 'text' : 'password';
    icon.classList.replace(ver ? 'fa-eye' : 'fa-eye-slash', ver ? 'fa-eye-slash' : 'fa-eye');
}
function toggleAuth(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('recovery-form').style.display = mode === 'recovery' ? 'block' : 'none';
    if (mode === 'recovery') {
        document.getElementById('step-1-recovery').style.display = 'block';
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'none';
    }
}
function cadastrarUsuario() {
    const u = campo('user-reg').trim(), p = campo('pass-reg').trim(), q = campo('pergunta-reg'), r = campo('resposta-reg').trim();
    if (!u || !p || !r) return erro('Preencha todos os campos!');
    if (p.length < 4) return erro('A senha precisa ter pelo menos 4 caracteres.');
    if (getAuth()) return erro('Já existe uma conta neste aparelho. Use "Esqueci a senha" para redefinir o acesso.');
    const salt = novoSalt();
    salvarAuth({ user: u, salt, passHash: hashSenha(p, salt), pergunta: q, respHash: hashSenha(normResp(r), salt) });
    avisar('Conta criada com sucesso!'); toggleAuth('login');
}
function fazerLogin() {
    const u = campo('user-login').trim(), p = campo('pass-login').trim(), a = getAuth();
    if (!a) return erro('Nenhuma conta encontrada! Por favor, cadastre-se.');
    if (u !== a.user || !conferirSenha(a, p)) return erro('Usuário ou senha incorretos!');
    salvarAuth(migrarAuth(a));
    if (marcado('lembrar-login')) localStorage.setItem('user_lembrado', u); else localStorage.removeItem('user_lembrado');
    sessionStorage.setItem('user_ativo', u); usuarioAtivo = u;
    atualizarNomeUsuarioTela(u);
    document.getElementById('tela-login').style.display = 'none';
    processarLancamentosFixos(); renderTudo();
}
function verificarUsuarioRecuperacao() {
    const a = getAuth();
    if (a && campo('user-rec').trim() === a.user) {
        document.getElementById('txt-pergunta-exibida').innerText = a.pergunta;
        document.getElementById('step-1-recovery').style.display = 'none';
        document.getElementById('step-2-recovery').style.display = 'block';
    } else erro('Usuário não encontrado!');
}
function validarRespostaSeguranca() {
    const a = getAuth();
    if (a && conferirResposta(a, campo('resposta-rec'))) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else erro('Resposta incorreta!');
}
function redefinirSenha() {
    const np = campo('nova-pass-rec').trim();
    if (np.length < 4) return erro('A nova senha precisa ter pelo menos 4 caracteres.');
    const a = migrarAuth(getAuth());
    a.passHash = hashSenha(np, a.salt); salvarAuth(a);
    avisar('Senha alterada! Faça login novamente.'); toggleAuth('login');
}
function entrarVisitante() {
    sessionStorage.setItem('user_ativo', 'visitante'); usuarioAtivo = 'visitante';
    dados = novoDados(); notas = []; // estrutura isolada em memória: o visitante nunca grava
    atualizarNomeUsuarioTela('Visitante');
    document.getElementById('tela-login').style.display = 'none';
    renderTudo();
}
function verificarAcesso() {
    if (ehVisitante()) { erro('Crie uma conta para salvar seus dados!'); return false; }
    return true;
}
function carregarDadosPerfil() {
    if (ehVisitante()) return;
    const a = getAuth(), i = document.getElementById('novo-user-perfil');
    if (a && i) i.value = a.user;
}
function atualizarPerfilUsuario() {
    if (!verificarAcesso()) return;
    let a = getAuth(); if (!a) return erro('Conta não encontrada!');
    const nu = campo('novo-user-perfil').trim(), np = campo('nova-pass-perfil').trim();
    if (!nu) return erro('O campo de usuário não pode ficar vazio!');
    if (!conferirSenha(a, campo('senha-atual-perfil').trim())) return erro('Senha atual incorreta!');
    if (np && np.length < 4) return erro('A nova senha precisa ter pelo menos 4 caracteres.');
    a = migrarAuth(a); a.user = nu;
    if (np) a.passHash = hashSenha(np, a.salt);
    salvarAuth(a);
    if (localStorage.getItem('user_lembrado')) localStorage.setItem('user_lembrado', nu);
    sessionStorage.setItem('user_ativo', nu); usuarioAtivo = nu; atualizarNomeUsuarioTela(nu);
    setCampo('nova-pass-perfil', ''); setCampo('senha-atual-perfil', '');
    avisar('Perfil atualizado com sucesso!');
}
function atualizarNomeUsuarioTela(nome) {
    nome = nome || 'Visitante';
    ['txt-nome-usuario-sidebar', 'txt-perfil-nome-exibicao'].forEach(id => { const e = document.getElementById(id); if (e) e.innerText = nome; });
}
function sairApp() { sessionStorage.clear(); localStorage.removeItem('user_lembrado'); location.reload(); }
function resetarApp() {
    if (!verificarAcesso()) return;
    if (!confirm('Isso apaga TODOS os dados e a conta deste aparelho. Exporte um backup antes. Continuar?')) return;
    if (!confirm('Última confirmação: apagar tudo de forma definitiva?')) return;
    [CHAVE_DADOS, CHAVE_NOTAS, CHAVE_AUTH, 'user_lembrado'].forEach(k => localStorage.removeItem(k));
    sessionStorage.clear(); location.reload();
}

/* ===================================================================
   4. NAVEGAÇÃO E TOPO
   =================================================================== */
const TITULOS = { 'extrato': 'Extrato', 'cartoes': 'Cartões', 'compras-cartao': 'Cartão', 'dividas': 'Dívidas', 'metas': 'Metas', 'lixeira': 'Lixeira', 'aba-perfil': 'Perfil', 'aba-sobre': 'Sobre', 'aba-notas': 'Notas', 'aba-revenda': 'Revenda', 'aba-graficos': 'Análise de Gastos', 'aba-anual': 'Visão Anual', 'aba-orcamento': 'Orçamento', 'aba-fixos': 'Contas Fixas', 'aba-previsao': 'Previsão', 'aba-simulador': 'Simulador', 'aba-comparar': 'Comparar meses', 'aba-quitar': 'Quitar dívidas', 'aba-clientes': 'Clientes' };
const COM_MES = ['extrato', 'cartoes', 'compras-cartao', 'dividas', 'aba-graficos', 'aba-orcamento', 'aba-comparar'];
// O que cada tela desenha quando é aberta (e de novo a cada alteração de dados)
const RENDER_DA_TELA = {
    'extrato': () => renderExtrato(), 'compras-cartao': () => renderComprasCartao(), 'lixeira': () => renderLixeira(),
    'aba-graficos': () => renderGraficoRank(), 'aba-anual': () => renderAnual(), 'aba-orcamento': () => renderOrcamento(),
    'aba-fixos': () => renderFixos(), 'aba-previsao': () => renderPrevisao(), 'aba-comparar': () => renderComparar(),
    'aba-quitar': () => renderQuitar(), 'aba-clientes': () => renderClientes(), 'aba-perfil': () => carregarDadosPerfil(),
    'aba-revenda': () => renderRevenda(), 'dividas': () => { renderDividas(); }, 'metas': () => renderMetas(), 'aba-notas': () => renderizarNotas()
};
function showSection(id, btn) {
    const alvo = document.getElementById(id); if (!alvo) return;
    _secAtual = id;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    alvo.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const alvoBtn = btn || document.querySelector('.nav-btn[onclick*="showSection(\'' + id + '\'"]'); // destaca a aba mesmo quando aberta por atalho/ao iniciar
    if (alvoBtn) alvoBtn.classList.add('active');
    document.body.classList.toggle('na-home', id === 'inicio');
    if (RENDER_DA_TELA[id]) RENDER_DA_TELA[id]();
    atualizarTopo(); atualizarFab();
    window.scrollTo(0, 0);
}
function irPara(id) { // atalhos rápidos da Início
    if (id.startsWith('ajuste-')) return abrirAjusteSaldo(id.slice(7));
    if (id === 'novo') { abrirModalMov(); mostrarModal('modalMov'); return; }
    showSection(id);
}
function atualizarTopo() {
    const h = document.getElementById('fp-header'); if (!h) return;
    const [a, m] = mesAtual.split('-').map(Number), set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    let t = TITULOS[_secAtual] || '';
    if (_secAtual === 'compras-cartao') { const e = document.getElementById('titulo-compras-cartao'); if (e && e.textContent.trim()) t = e.textContent.trim().replace(/^Compras:\s*/, ''); }
    set('fp-titulo', t);
    const rotulos = (pref) => { set(pref + '-mes-ant', MESES_C[(m + 10) % 12]); set(pref + '-mes-prox', MESES_C[m % 12]); set(pref + '-mes-atual', MESES_C[m - 1] + (a !== new Date().getFullYear() ? ' ' + a : '')); };
    rotulos('fp'); rotulos('hero');
    if (diaAtual) { const [, dm, dd] = diaAtual.split('-').map(Number); ['fp', 'hero'].forEach(p => set(p + '-mes-atual', dd + ' ' + MESES_C[dm - 1])); }
    document.querySelectorAll('.hero-meses, .fp-meses-row').forEach(e => e.classList.toggle('com-dia', !!diaAtual)); // com dia escolhido, só o rótulo do dia (sobra espaço pros ícones)
    const chip = document.getElementById('hero-dia-chip');
    if (chip) chip.innerHTML = diaAtual ? '<button type="button" class="chip-dia" onclick="setDia(\'\')"><i class="far fa-calendar"></i> Vendo o dia ' + dataBR(diaAtual).slice(0, 5) + ' • ver mês todo <i class="fas fa-xmark"></i></button>' : '';
    const comMes = COM_MES.includes(_secAtual);
    document.getElementById('fp-meses-row').style.display = comMes ? 'flex' : 'none';
    h.style.paddingBottom = comMes ? '44px' : '40px';
    const hero = document.querySelector('#inicio .main-balance-card'); if (hero) h.style.backgroundImage = getComputedStyle(hero).backgroundImage; // mesma cor da Início (roxo/verde)
    atualizarBadges();
}
function setMes(ym) { if (!/^\d{4}-\d{2}$/.test(ym)) return; mesAtual = ym; if (diaAtual && !diaAtual.startsWith(ym)) diaAtual = ''; renderTudo(); }
function alterarMesNav(direcao) { setMes(ymAdd(mesAtual, direcao)); }
function irParaMes(ym) { setMes(ym); showSection('extrato'); }

// Calendário completo: escolhe mês, ano e dia (o dia filtra Início e Extrato)
const MESES_L = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA_C = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
let _calYm = '', _calVista = 'dias', _anoSeletor = new Date().getFullYear();
const _p2 = n => String(n).padStart(2, '0');
function rotuloDia(iso) { const [a, m, d] = iso.split('-').map(Number); return d + ' de ' + MESES_L[m - 1] + (a !== new Date().getFullYear() ? ' de ' + a : ''); }
function abrirSeletorMes() { _calYm = diaAtual ? diaAtual.slice(0, 7) : mesAtual; _calVista = 'dias'; desenharCalendario(); mostrarModal('modalMes'); }
function calMudar(n) { if (_calVista === 'dias') _calYm = ymAdd(_calYm, n); else _anoSeletor += n; desenharCalendario(); }
function calAlternarVista() { _calVista = _calVista === 'dias' ? 'meses' : 'dias'; _anoSeletor = +_calYm.slice(0, 4); desenharCalendario(); }
function calEscolherMes(ym) { _calYm = ym; _calVista = 'dias'; desenharCalendario(); }
function calEscolherDia(iso) { ocultarModal('modalMes'); setDia(iso); }
function calMesTodo() { ocultarModal('modalMes'); diaAtual = ''; setMes(_calYm); }
function calHoje() { ocultarModal('modalMes'); setDia(hojeISO()); }
function escolherMes(ym) { ocultarModal('modalMes'); diaAtual = ''; setMes(ym); }
function irParaHoje() { escolherMes(hojeISO().substring(0, 7)); }
function desenharCalendario() {
    const el = document.getElementById('cal-corpo'); if (!el) return;
    const hoje = hojeISO(), [a, m] = _calYm.split('-').map(Number); let corpo, titulo;
    if (_calVista === 'meses') {
        titulo = String(_anoSeletor);
        corpo = '<div class="mes-grade">' + MESES_C.map((nome, i) => { const ym = _anoSeletor + '-' + _p2(i + 1); return '<button type="button" class="mes-op' + (ym === _calYm ? ' ativo' : '') + (ym === hoje.slice(0, 7) ? ' hoje' : '') + '" onclick="calEscolherMes(\'' + ym + '\')">' + nome + '</button>'; }).join('') + '</div>';
    } else {
        titulo = MESES_L[m - 1] + ' ' + a;
        const marc = {};
        efetivosDe(_calYm).filter(x => x.data && x.data.startsWith(_calYm) && !x.virtual && !x.cartaoId && !x.idRelacionado).forEach(x => { (marc[x.data] = marc[x.data] || {})[x.tipo === 'entrada' ? 'e' : 's'] = 1; });
        const prim = new Date(a, m - 1, 1).getDay(), dias = new Date(a, m, 0).getDate();
        let cels = SEMANA_C.map(d => '<span class="cal-sem">' + d + '</span>').join('');
        for (let i = 0; i < prim; i++) cels += '<span></span>';
        for (let d = 1; d <= dias; d++) {
            const iso = _calYm + '-' + _p2(d), mk = marc[iso] || {};
            cels += '<button type="button" class="cal-dia' + (iso === diaAtual ? ' ativo' : '') + (iso === hoje ? ' hoje' : '') + '" onclick="calEscolherDia(\'' + iso + '\')">' + d + '<i class="cal-pts">' + (mk.e ? '<b class="e"></b>' : '') + (mk.s ? '<b class="s"></b>' : '') + '</i></button>';
        }
        corpo = '<div class="cal-grade">' + cels + '</div><div class="cal-leg"><span><b class="e"></b> Entrada</span><span><b class="s"></b> Saída</span></div>';
    }
    el.innerHTML = '<div class="d-flex justify-content-between align-items-center mb-2"><button type="button" class="btn btn-light btn-sm rounded-circle" onclick="calMudar(-1)" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>'
        + '<button type="button" class="cal-titulo" onclick="calAlternarVista()">' + titulo + ' <i class="fas fa-caret-down"></i></button>'
        + '<button type="button" class="btn btn-light btn-sm rounded-circle" onclick="calMudar(1)" aria-label="Próximo"><i class="fas fa-chevron-right"></i></button></div>' + corpo
        + '<div class="d-flex gap-2 mt-3"><button type="button" class="btn btn-outline-primary btn-sm flex-fill" onclick="calMesTodo()">Mês todo</button><button type="button" class="btn btn-sm flex-fill text-white" style="background:var(--purple)" onclick="calHoje()">Hoje</button></div>';
}

// Botão flutuante (+) de cada tela
const FAB_ACOES = { 'cartoes': () => abrirModalCartao(), 'compras-cartao': () => abrirModalCompraCartao(), 'dividas': () => abrirModalDivida(), 'aba-clientes': () => abrirModalCliente(), 'metas': () => mostrarModal('modalMeta'), 'aba-notas': () => abrirModalNota(), 'aba-revenda': () => abrirModalRevenda(), 'aba-fixos': () => novaContaFixa() };
const FAB_ROTULO = { 'cartoes': 'Novo cartão', 'compras-cartao': 'Nova compra', 'dividas': 'Novo registro', 'aba-clientes': 'Novo cliente', 'metas': 'Nova meta', 'aba-notas': 'Nova nota', 'aba-revenda': 'Novo produto', 'aba-fixos': 'Nova conta fixa' };
function atualizarFab() {
    const f = document.getElementById('fab-add'); if (!f) return;
    f.style.display = FAB_ACOES[_secAtual] ? 'flex' : 'none'; f.setAttribute('aria-label', FAB_ROTULO[_secAtual] || '');
}

/* ===================================================================
   5. LANÇAMENTOS (EXTRATO) E CATEGORIAS
   =================================================================== */
const FORMAS = ['Pix', 'Dinheiro', 'Débito', 'Crédito', 'Boleto', 'Transferência', 'Cheque', 'Outro'];
const CAT_IC = { 'Mercado': ['fa-cart-shopping', '#f59e0b'], 'Alimentação': ['fa-utensils', '#f97316'], 'Transporte': ['fa-car', '#3b82f6'], 'Moradia': ['fa-house', '#14b8a6'], 'Contas': ['fa-file-invoice-dollar', '#64748b'], 'Saúde': ['fa-heart-pulse', '#D62839'], 'Educação': ['fa-graduation-cap', '#57005F'], 'Lazer': ['fa-gamepad', '#7a1a85'], 'Assinaturas': ['fa-repeat', '#ec4899'], 'Salário': ['fa-money-bill-wave', '#10b981'], 'Freelance': ['fa-laptop-code', '#0ea5e9'], 'Investimentos': ['fa-chart-line', '#22c55e'], 'Vendas': ['fa-tag', '#84cc16'], 'Dívidas': ['fa-handshake', '#57005F'], 'Cartão': ['fa-credit-card', '#57005F'], 'Outros': ['fa-ellipsis', '#94a3b8'] };
const iconeCat = c => CAT_IC[c] || ['fa-receipt', '#57005F'];

function cats() { // categorias separadas por tipo (receita/despesa), com as personalizadas
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
function popularClientes(selId, sel) {
    const s = document.getElementById(selId); if (!s) return;
    s.innerHTML = '<option value="">Sem cliente</option>' + clientes().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join('');
    s.value = sel || '';
}
function toggleCartaoMov() { // "cartão da fatura" só aparece para despesa no crédito
    const w = document.getElementById('mov-cartao-wrap'); if (!w) return;
    w.classList.toggle('d-none', !(campo('mov-forma') === 'Crédito' && campo('mov-tipo') === 'saida'));
}
function abrirModalMov(id = null) {
    const m = id ? dados.movs.find(x => x.id == id) : null;
    setCampo('mov-id-edit', m ? m.id : '');
    setCampo('mov-desc', m ? m.desc : '');
    setCampo('mov-valor', m ? fmtMoeda(m.valor) : '');
    setCampo('mov-tipo', m ? m.tipo : 'saida');
    popularCategorias(campo('mov-tipo'), m ? m.cat : null);
    if (!m) setCampo('mov-cat', 'Outros');
    setCampo('mov-data', m ? m.data : hojeISO());
    document.getElementById('mov-fixo').checked = !!(m && m.fixo);
    document.getElementById('modalMovTitulo').innerText = m ? 'Editar Lançamento' : 'Novo Lançamento';
    document.getElementById('btn-excluir-mov').classList.toggle('d-none', !m);
    // detalhes extras
    popularClientes('mov-cliente', m && m.clienteId);
    setCampo('mov-forma', m && m.forma); setCampo('mov-local', m && m.local); setCampo('mov-tags', m && m.tags); setCampo('mov-obs', m && m.obs);
    const det = document.getElementById('mov-mais'); if (det) det.open = !!(m && (m.local || m.tags || m.obs));
    // cartão da fatura
    const sel = document.getElementById('mov-cartao');
    if (sel) { sel.innerHTML = dados.cartoes.filter(c => c.tipo !== 'Débito').map(c => '<option value="' + c.id + '">' + escaparHTML(c.nome) + '</option>').join(''); if (m && m.cartaoId) sel.value = m.cartaoId; }
    if (m && m.cartaoId) setCampo('mov-forma', 'Crédito');
    toggleCartaoMov();
}
function abrirAjusteSaldo(tipo) { // atalhos "Entrada" / "Saída" da Início
    if (!verificarAcesso()) return;
    abrirModalMov();
    setCampo('mov-tipo', tipo); popularCategorias(tipo, null); toggleCartaoMov();
    setCampo('mov-desc', 'Ajuste de Saldo');
    document.getElementById('modalMovTitulo').innerText = tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída';
    mostrarModal('modalMov');
}
function abrirTransacao(id) {
    if (id < 0) return verCompras(-id); // linha "Fatura" do extrato → abre o cartão
    abrirModalMov(id); mostrarModal('modalMov');
}
function salvarMov() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('mov-id-edit')) || 0, desc = campo('mov-desc').trim(), valor = lerMoeda('mov-valor');
    if (!desc || valor <= 0) return erro('Informe a descrição e um valor maior que zero.');
    const tipo = campo('mov-tipo'), usaCartao = campo('mov-forma') === 'Crédito' && tipo === 'saida', cid = Number(campo('mov-cartao')) || null;
    if (usaCartao && !cid) return erro('Cadastre um cartão de crédito para lançar na fatura.');
    const antigo = idEdit ? dados.movs.find(m => m.id === idEdit) : null;
    const mov = {
        ...(antigo || {}), id: idEdit || Date.now(), desc, valor, tipo, cat: campo('mov-cat'),
        data: campo('mov-data') || hojeISO(), hora: antigo ? (antigo.hora || horaAgora()) : horaAgora(), fixo: marcado('mov-fixo'),
        forma: campo('mov-forma'), clienteId: Number(campo('mov-cliente')) || null, local: campo('mov-local').trim(), tags: campo('mov-tags').trim(), obs: campo('mov-obs').trim(),
        cartaoId: usaCartao ? cid : null
    };
    if (mov.cat === '__nova__') mov.cat = 'Outros';
    // renomear uma conta fixa: acompanha todo o histórico dela (senão a conta antiga continuaria se repetindo)
    if (antigo && antigo.fixo && (antigo.desc !== desc || antigo.tipo !== tipo)) {
        dados.movs.forEach(m => { if (m.fixo && m.tipo === antigo.tipo && m.desc === antigo.desc) { m.desc = desc; m.tipo = tipo; } });
    }
    const idx = dados.movs.findIndex(m => m.id === mov.id);
    if (idx > -1) dados.movs[idx] = mov; else dados.movs.push(mov);
    salvarERender();
    ocultarModal('modalMov'); avisar('Lançamento salvo');
}
function moverMovParaLixeira() {
    const id = Number(campo('mov-id-edit')), idx = dados.movs.findIndex(m => m.id === id);
    if (idx < 0 || !confirm('Deseja enviar para a lixeira?')) return;
    const item = dados.movs.splice(idx, 1)[0];
    if (item.fixo && item.data) { // evita que o lançamento fixo "ressuscite" no mesmo mês
        dados.fixosIgnorados.push(item.tipo + '|' + item.desc + '|' + item.data.substring(0, 7));
    }
    item.origem = 'movs'; item.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(item);
    salvarERender(); ocultarModal('modalMov'); avisar('Lançamento enviado para a lixeira');
}
function setFiltro(f) { filtroAtual = f; renderExtrato(); }
function filtrarBusca(valor) { buscaAtual = valor.toLowerCase(); renderExtrato(); }
const _addDia = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDe(d); };
function _notaCartaoDia(d) { // compras no cartão feitas neste dia (não entram na lista, só um aviso)
    let t = 0, n = 0;
    dados.cartoes.forEach(c => (c.compras || []).forEach(x => { if (x.data === d && !x.emprestado) { t += x.valorTotal; n++; } }));
    dados.movs.forEach(m => { if (m.data === d && m.cartaoId && m.tipo === 'saida' && !m.idRelacionado) { t += m.valor; n++; } });
    return n ? '<div class="dia-nota"><i class="fas fa-credit-card"></i> No cartão neste dia: ' + n + ' compra' + (n > 1 ? 's' : '') + ' • <b class="money-value">' + brl(t) + '</b></div>' : '';
}
function setDia(iso) { // '' volta para o mês inteiro
    diaAtual = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
    if (diaAtual && !diaAtual.startsWith(mesAtual)) setMes(diaAtual.slice(0, 7)); else renderTudo();
}
function mudarDia(n) { setDia(_addDia(diaAtual || hojeISO(), n)); }
function escolherDiaModo() { if (!diaAtual) { const h = hojeISO(); diaAtual = h.startsWith(mesAtual) ? h : mesAtual + '-01'; renderTudo(); } abrirSeletorMes(); }
function _barraDia() {
    return '<div class="dia-seg"><button type="button" class="dia-op' + (!diaAtual ? ' ativo' : '') + '" onclick="setDia(\'\')"><i class="far fa-calendar"></i> Mês todo</button><button type="button" class="dia-op' + (diaAtual ? ' ativo' : '') + '" onclick="escolherDiaModo()"><i class="far fa-calendar-check"></i> Escolher dia</button></div>'
        + (diaAtual ? '<div class="dia-nav"><button type="button" class="dia-seta" onclick="mudarDia(-1)" aria-label="Dia anterior"><i class="fas fa-chevron-left"></i></button><div class="dia-label">' + rotuloDia(diaAtual) + '</div><button type="button" class="dia-seta" onclick="mudarDia(1)" aria-label="Próximo dia"><i class="fas fa-chevron-right"></i></button></div>' : '');
}
function renderExtrato() { // agrupado por dia, com ícone por categoria
    const barra = document.getElementById('dia-bar'); if (barra) barra.innerHTML = _barraDia();
    const R = document.getElementById('extrato-recentes'); if (R) R.innerHTML = diaAtual ? linhasCartaoDia(diaAtual) : linhasFaturas(6);
    const L = document.getElementById('lista-extrato'); if (!L) return;
    const ym = mesAtual, f = filtroAtual;
    let e = efetivos().filter(m => m.data && (diaAtual ? m.data === diaAtual : m.data.startsWith(ym)));
    e = e.filter(m => !m.virtual && !m.cartaoId && !m.idRelacionado); // nada de cartão aqui: só as entradas e saídas lançadas por você
    if (f === 'entrada' || f === 'saida') e = e.filter(m => m.tipo === f);
    if (buscaAtual) e = e.filter(m => (m.desc || '').toLowerCase().includes(buscaAtual) || (m.cat || '').toLowerCase().includes(buscaAtual));
    e.sort(ordemMov);
    const ent = e.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0), sai = e.filter(m => m.tipo !== 'entrada').reduce((s, m) => s + m.valor, 0);
    const hoje = hojeISO(), o = new Date(); o.setDate(o.getDate() - 1), ontem = isoDe(o);
    const rotulo = d => d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    let html = '<div class="home-tiles"><div class="home-tile"><i class="fas fa-arrow-trend-up"></i><div><small>Ganhos</small><b class="money-value">' + brl(ent) + '</b></div></div><div class="home-tile"><i class="fas fa-arrow-trend-down"></i><div><small>Gastos</small><b class="money-value">' + brl(sai) + '</b></div></div></div>' , dia = '';
    e.forEach(x => {
        if (x.data !== dia) { dia = x.data; html += '<div class="dia-titulo">' + rotulo(dia) + '</div>'; }
        html += linhaTransacao(x, true);
    });
    L.innerHTML = html + (e.length ? '' : '<div class="text-center text-muted py-4 small">Nenhuma movimentação encontrada.</div>');
}
function linhasCartaoDia(d) { // movimentos de cartão de um dia: faturas que vencem nele + compras feitas nele
    const itens = [];
    dados.cartoes.forEach(card => (card.compras || []).forEach(c => { if (c.data === d) itens.push({ card, desc: c.desc, valor: c.valorTotal, parc: c.parcelas > 1 ? c.parcelas + 'x' : '' }); }));
    dados.movs.forEach(m => { const card = m.cartaoId && dados.cartoes.find(c => c.id === m.cartaoId); if (card && m.data === d && m.tipo === 'saida' && !m.idRelacionado) itens.push({ card, desc: m.desc, valor: m.valor, parc: '' }); });
    const fat = efetivos().filter(x => x.virtual && x.data === d).map(x => linhaTransacao(x, true)).join('');
    const lin = itens.map(i => '<div class="trans" onclick="verCompras(' + i.card.id + ')"><span class="ic-box round" style="background:#7a1a8522;color:#7a1a85"><i class="fas fa-credit-card"></i></span><div class="trans-mid"><b>' + escaparHTML(i.desc) + '</b><small>' + escaparHTML(i.card.nome) + ' | Compra' + (i.parc ? ' • ' + i.parc : '') + '</small></div><div class="trans-end"><b class="money-value text-danger">-' + brl(i.valor) + '</b><small>' + diaMes(d) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>').join('');
    return fat + lin || '<div class="text-center text-muted py-3 small">Nenhum movimento de cartão neste dia.</div>';
}
function linhasFaturas(n) { // "Últimas transações" do Extrato: só as faturas dos cartões
    const tr = efetivos().filter(x => x.virtual && x.data && x.data.startsWith(mesAtual)).sort(ordemMov).slice(0, n);
    return tr.map(x => linhaTransacao(x, true)).join('') || '<div class="text-center text-muted py-3 small">Nenhuma fatura de cartão neste mês.</div>';
}
function linhaTransacao(x, comSetaIr) { // linha usada no extrato e nas "últimas transações"
    const [ic, cor] = iconeCat(x.cat), en = x.tipo === 'entrada';
    return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
        + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : en ? 'Receita' : 'Despesa') + (!comSetaIr && x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
        + '<div class="trans-end"><b class="money-value ' + (en ? 'text-success' : 'text-danger') + '">' + (en ? '' : '-') + brl(x.valor) + '</b><small>' + diaMes(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
}

// ---------- Lixeira ----------
function renderLixeira() {
    const lista = document.getElementById('lista-lixeira'); if (!lista) return;
    lista.innerHTML = dados.lixeira.length ? dados.lixeira.map(m => `
        <div class="card-mov opacity-75">
            <div class="icon-box bg-secondary text-white"><i class="fas fa-trash-restore"></i></div>
            <div class="flex-grow-1">
                <div class="fw-bold text-decoration-line-through">${escaparHTML(m.lixeiraTitulo || m.nome || m.desc)}</div>
                <small class="text-muted">Deletado em: ${escaparHTML(m.deletadoEm || '')}</small>
            </div>
            <div class="text-end"><button class="btn btn-sm btn-outline-success border-0" onclick="restaurarDaLixeira(${m.id})"><i class="fas fa-undo"></i></button></div>
        </div>`).join('') : '<p class="text-center text-muted py-4">A lixeira está vazia.</p>';
}
function restaurarDaLixeira(id) {
    const i = dados.lixeira.findIndex(m => m.id === Number(id)); if (i < 0) return;
    const it = dados.lixeira.splice(i, 1)[0], dest = it.origem || 'movs';
    delete it.origem; delete it.deletadoEm; delete it.lixeiraTitulo;
    (dados[dest] = dados[dest] || []).push(it);
    salvarERender(); avisar('Item restaurado');
}
function esvaziarLixeira() {
    if (!confirm('Tem certeza que deseja apagar permanentemente todos os itens da lixeira?')) return;
    dados.lixeira = []; salvarERender();
}

/* ===================================================================
   6. CONTAS FIXAS (lançamentos que se repetem todo mês)
   =================================================================== */
function ultimosPorGrupo() { // o lançamento mais recente de cada "tipo + descrição"
    const g = {};
    dados.movs.forEach(m => { if (!m.data || !m.desc) return; const k = m.tipo + '|' + m.desc; if (!g[k] || m.data > g[k].data) g[k] = m; });
    return Object.values(g);
}
const fixosAtivos = () => ultimosPorGrupo().filter(m => m.fixo);

// Preenche TODOS os meses que faltam (não só o atual), sem duplicar e respeitando exclusões
function processarLancamentosFixos() {
    const ym = hojeISO().substring(0, 7), ign = dados.fixosIgnorados; let mudou = false;
    fixosAtivos().forEach(t => { // desmarcar "Fixo" no lançamento mais recente cancela a repetição
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

// Tudo que se repete: lançamentos fixos + compras fixas dos cartões
function listaContasFixas() {
    const lista = fixosAtivos().map(m => ({ origem: 'mov', id: m.id, desc: m.desc, valor: m.valor, tipo: m.tipo, dia: m.data.substring(8, 10), cat: m.cat, cartaoId: m.cartaoId || null }));
    dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => lista.push({ origem: 'compra', id: x.id, desc: x.desc, valor: x.valorTotal, tipo: 'saida', dia: String(c.vence).padStart(2, '0'), cat: x.cat || 'Cartão', cartaoId: c.id })));
    return lista;
}
function renderFixos() {
    const lista = listaContasFixas();
    const ent = lista.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), sai = lista.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    document.getElementById('fixos-resumo').innerHTML = [['Receitas fixas', ent, 'text-success'], ['Despesas fixas', sai, 'text-danger'], ['Sobra fixa/mês', ent - sai, ent - sai >= 0 ? 'text-success' : 'text-danger'], ['Custo anual fixo', sai * 12, '']]
        .map(([t, v, c]) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + c + '">' + brl(v) + '</div></div></div>').join('');
    document.getElementById('fixos-lista').innerHTML = lista.sort((a, b) => a.dia - b.dia).map(x => {
        const cartao = x.cartaoId ? dados.cartoes.find(c => c.id === x.cartaoId) : null, args = "'" + x.origem + "'," + x.id + ',' + (x.cartaoId || 0);
        return '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><div class="fw-bold">' + escaparHTML(x.desc) + ' <span class="badge bg-info text-dark"><i class="fas fa-rotate"></i> dia ' + x.dia + '</span></div>'
            + '<small class="text-muted">' + escaparHTML(x.cat) + (cartao ? ' • <i class="fas fa-credit-card"></i> ' + escaparHTML(cartao.nome) : '') + '</small></div>'
            + '<b class="money-value ' + (x.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + (x.tipo === 'entrada' ? '+' : '-') + brl(x.valor) + '</b>'
            + '<div class="dropdown"><button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown" aria-label="Opções"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">'
            + '<li><button class="dropdown-item py-2" onclick="editarContaFixa(' + args + ')"><i class="fas fa-pen me-2"></i>Editar</button></li>'
            + '<li><button class="dropdown-item py-2 text-danger" onclick="excluirContaFixa(' + args + ')"><i class="fas fa-trash me-2"></i>Excluir</button></li></ul></div></div>';
    }).join('') || '<p class="text-muted text-center">Nenhuma conta fixa. Toque em <b>＋</b> ou marque "Fixo" ao lançar uma receita/despesa.</p>';
}
function novaContaFixa() {
    abrirModalMov(); document.getElementById('mov-fixo').checked = true;
    document.getElementById('modalMovTitulo').innerText = 'Nova Conta Fixa'; mostrarModal('modalMov');
}
function editarContaFixa(origem, id, cartaoId) {
    if (origem === 'compra') { cartaoContexto = cartaoId; abrirModalCompraCartao(id); }
    else abrirTransacao(id);
}
function excluirContaFixa(origem, id, cartaoId) {
    if (origem === 'compra') { // mesmo caminho da exclusão dentro do cartão
        const card = dados.cartoes.find(c => c.id === cartaoId), c = card && card.compras.find(x => x.id === id);
        if (!c || !confirm('Excluir a compra fixa "' + c.desc + '" do cartão ' + card.nome + '?')) return;
        card.compras = card.compras.filter(x => x.id !== id);
        dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== id);
        salvarERender(); avisar('Conta fixa excluída'); return;
    }
    const m = dados.movs.find(x => x.id === id); if (!m) return;
    modalDin('modalExcluirFixo', '<div class="modal-body p-4"><h5 class="fw-bold mb-2">Excluir conta fixa</h5>'
        + '<p class="mb-3"><b>' + escaparHTML(m.desc) + '</b> (' + brl(m.valor) + ') deixa de se repetir todo mês. O que fazer com os lançamentos que já existem?</p>'
        + '<button class="btn btn-outline-primary w-100 mb-2 py-2" onclick="confirmarExcluirFixo(' + id + ',false)">Só parar de repetir <small class="d-block text-muted">mantém todo o histórico no extrato</small></button>'
        + '<button class="btn btn-danger w-100 py-2" onclick="confirmarExcluirFixo(' + id + ',true)">Parar e apagar este mês em diante <small class="d-block">envia para a lixeira</small></button></div>').show();
}
function confirmarExcluirFixo(id, apagar) {
    const m = dados.movs.find(x => x.id === id); if (!m) return ocultarModal('modalExcluirFixo');
    const grupo = dados.movs.filter(x => x.fixo && x.tipo === m.tipo && x.desc === m.desc), ym = hojeISO().substring(0, 7);
    grupo.forEach(x => { x.fixo = false; }); // sem a marca "Fixo" nada mais é gerado (nem aparece em todas as faturas do cartão)
    if (apagar) grupo.filter(x => x.data.substring(0, 7) >= ym).forEach(x => {
        dados.movs.splice(dados.movs.indexOf(x), 1);
        dados.fixosIgnorados.push(x.tipo + '|' + x.desc + '|' + x.data.substring(0, 7));
        x.origem = 'movs'; x.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(x);
    });
    salvarERender(); ocultarModal('modalExcluirFixo'); avisar('Conta fixa excluída');
}

/* ===================================================================
   7. CARTÕES, FATURAS E COMPRAS
   =================================================================== */
const BANCOS = { 'Nubank': ['#8A05BE', '#ffffff'], 'Inter': ['#FF7A00', '#ffffff'], 'Itaú': ['#EC7000', '#ffffff'], 'Bradesco': ['#CC092F', '#ffffff'], 'Santander': ['#EC0000', '#ffffff'], 'Banco do Brasil': ['#FFEF38', '#000000'], 'Caixa': ['#0070AF', '#ffffff'], 'C6 Bank': ['#242424', '#ffffff'], 'PicPay': ['#11C76F', '#ffffff'], 'Mercado Pago': ['#009EE3', '#ffffff'], 'BTG Pactual': ['#001E62', '#ffffff'], 'Neon': ['#00E5E5', '#000000'], 'Next': ['#00FF5F', '#000000'], 'Original': ['#00A859', '#ffffff'], 'Sicredi': ['#3FA110', '#ffffff'], 'XP': ['#000000', '#ffffff'], 'Will Bank': ['#FFD100', '#000000'] };
function shade(hex, p) { // escurece uma cor #rrggbb em p (0–1)
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#3d0044';
    const n = parseInt(hex.slice(1), 16), f = v => Math.round(v * (1 - p));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
function aplicarBanco() {
    const b = BANCOS[campo('card-banco')]; if (!b) return;
    setCampo('card-cor-custom', b[0]); setCampo('card-cor-fonte', b[1]);
}
function detectarBanco() {
    const norm = s => s.toLowerCase().replace(/[ãáâ]/g, 'a').replace(/[íî]/g, 'i'), n = norm(campo('card-nome'));
    const k = Object.keys(BANCOS).find(b => n.includes(norm(b).split(' ')[0]));
    if (k && campo('card-banco') !== k) { setCampo('card-banco', k); aplicarBanco(); }
}
const cartaoAtual = () => dados.cartoes.find(x => x.id == cartaoContexto);

// ---------- regras de fatura ----------
function mesFatura(card, c) { // mês de fechamento da fatura em que a compra cai (ou o definido à mão em "1ª parcela aparece em")
    if (c.mesIni) return ymFat(card, c.mesIni);
    const d = parseInt(c.data.substring(8, 10)), f = parseInt(card.fecha) || 31;
    return ymAdd(c.data.substring(0, 7), (card.tipo !== 'Débito' && d > f) ? 1 : 0);
}
function _temCiclo(card) { return card.tipo !== 'Débito' && parseInt(card.fecha) > 0 && parseInt(card.vence) > 0; }
function ymFat(card, ym) { return (!_temCiclo(card) || parseInt(card.vence) > parseInt(card.fecha)) ? ym : ymAdd(ym, -1); } // fatura que é paga no mês "ym"
function mesPagamento(card, invYm) { return (!_temCiclo(card) || parseInt(card.vence) > parseInt(card.fecha)) ? invYm : ymAdd(invYm, 1); } // inverso: em que mês a fatura "invYm" é paga
function parcelasCompra(card, c) { // cronograma fixo: uma parcela por mês de fatura (pagar/antecipar só marca a parcela, não remove)
    const tot = Math.max(1, Number(c.parcelas) || 1), base = mesFatura(card, c);
    return Array.from({ length: tot }, (_, i) => ({ n: i + 1, total: tot, ym: ymAdd(base, i) }));
}
const _valParcela = c => c.valorTotal / (c.parcelas || 1);
const _pagoNaParcela = (c, ym) => (c.pagamentos || []).filter(p => p.ym === ym).reduce((a, p) => a + p.valor, 0);
const _pagoTotal = c => (c.pagamentos || []).reduce((a, p) => a + p.valor, 0);
function parcelaAlvo(card, c, ymF) { // parcela que o pagamento atinge: a da fatura aberta, ou a próxima em aberto
    const ps = parcelasCompra(card, c); if (ps.some(p => p.ym === ymF)) return ymF;
    const nao = ps.find(p => _pagoNaParcela(c, p.ym) < _valParcela(c) - 0.005); return (nao || ps[ps.length - 1]).ym;
}
function pseudoMov(m, fixo) { // lançamento feito "no crédito" vira um item da fatura
    return { id: 'm' + m.id, movId: m.id, mov: true, desc: m.desc, valorTotal: m.valor, parcelas: 1, data: m.data, local: m.local, cat: m.cat, fixa: fixo, emprestado: false, pagamentos: [] };
}
function itensFatura(card, ymF) { // tudo que compõe a fatura do mês de fechamento ymF
    const out = [];
    (card.compras || []).forEach(c => {
        if (c.fixa) { if (ymF >= mesFatura(card, c)) out.push({ c, info: 'Fixo', valor: c.valorTotal }); return; }
        const p = parcelasCompra(card, c).find(x => x.ym === ymF);
        if (p) out.push({ c, info: '(' + p.n + '/' + p.total + ')', valor: c.valorTotal / c.parcelas });
    });
    const fixos = {};
    dados.movs.forEach(m => { // conta fixa no cartão: aparece em TODAS as faturas a partir da primeira (vale o valor do último reajuste)
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        const inv = mesFatura(card, { data: m.data });
        if (!m.fixo) { if (inv === ymF) out.push({ c: pseudoMov(m, false), info: '', valor: m.valor }); return; }
        if (inv <= ymF) { const k = m.desc; if (!fixos[k] || inv > fixos[k].inv || (inv === fixos[k].inv && m.data > fixos[k].m.data)) fixos[k] = { inv, m }; }
    });
    Object.values(fixos).forEach(f => out.push({ c: pseudoMov(f.m, true), info: 'Fixo', valor: f.m.valor }));
    return out;
}
function limiteUsado(card) { // saldo real em aberto (parcelas futuras), não só o mês atual
    const hoje = hojeISO().substring(0, 7);
    const compras = (card.compras || []).reduce((s, c) => {
        const v = c.valorTotal / c.parcelas; if (c.fixa) return s + v;
        const aberto = parcelasCompra(card, c).filter(p => p.ym >= hoje).reduce((a, p) => a + Math.max(0, v - _pagoNaParcela(c, p.ym)), 0);
        return s + Math.max(0, Math.min(c.valorTotal - _pagoTotal(c), aberto));
    }, 0);
    return compras + dados.movs.filter(m => m.cartaoId === card.id && m.tipo === 'saida' && m.data && mesFatura(card, { data: m.data }) >= hoje).reduce((s, m) => s + m.valor, 0);
}
// Movimentações efetivas de um mês = lançamentos (sem compras de crédito) + 1 linha "Fatura" por cartão
function movsEfetivos(ym, comId) {
    const ids = new Set(), cred = new Set();
    dados.cartoes.forEach(c => { if (c.tipo !== 'Débito') { cred.add(c.id); (c.compras || []).forEach(x => ids.add(x.id)); } });
    const out = dados.movs.filter(m => !(m.idRelacionado && ids.has(m.idRelacionado)) && !(m.cartaoId && cred.has(m.cartaoId)));
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito') return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0); if (t <= 0) return;
        out.push(comId ? { id: -c.id, desc: 'Fatura ' + c.nome, valor: arred(t), tipo: 'saida', cat: 'Cartão', data: ym + '-' + String(Math.min(parseInt(c.vence) || 1, 28)).padStart(2, '0'), hora: '', virtual: true }
            : { desc: 'Fatura ' + c.nome, valor: t, tipo: 'saida', cat: 'Cartão', data: ym + '-01' });
    });
    return out;
}
const efetivos = () => movsEfetivos(mesAtual, true);
const efetivosDe = ym => movsEfetivos(ym, false);

// ---------- cartão: formulário ----------
function abrirModalCartao(id = null) {
    if (!verificarAcesso()) return;
    const c = id ? dados.cartoes.find(x => x.id == id) : null;
    setCampo('card-id-edit', c ? c.id : ''); setCampo('card-nome', c ? c.nome : '');
    setCampo('card-limite', c ? fmtMoeda(c.limite) : '');
    setCampo('card-bandeira', c ? c.bandeira : 'Visa'); setCampo('card-banco', '');
    setCampo('card-cor-custom', c ? c.cor : '#57005F'); setCampo('card-cor-fonte', c ? (c.corFonte || '#ffffff') : '#ffffff');
    setCampo('card-tipo', c ? c.tipo : 'Crédito'); setCampo('card-fecha', c ? c.fecha : '10'); setCampo('card-vence', c ? c.vence : '15');
    setCampo('card-final', c && c.final); setCampo('card-titular', c && c.titular); setCampo('card-anuidade', c && c.anuidade ? fmtMoeda(c.anuidade) : ''); setCampo('card-obs', c && c.obs);
    const det = document.getElementById('card-mais'); if (det) det.open = !!(c && (c.final || c.titular || c.anuidade || c.obs));
    document.getElementById('btn-excluir-cartao').classList.toggle('d-none', !c);
    document.getElementById('modalCartaoTitulo').innerText = c ? 'Editar Cartão' : 'Novo Cartão';
    mostrarModal('modalCartao');
}
function addCartao() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('card-id-edit')) || 0, antigo = idEdit ? dados.cartoes.find(x => x.id === idEdit) : null;
    const card = {
        ...(antigo || {}), id: idEdit || Date.now(), nome: campo('card-nome').trim(), limite: lerMoeda('card-limite'), bandeira: campo('card-bandeira'),
        cor: campo('card-cor-custom'), corFonte: campo('card-cor-fonte'), tipo: campo('card-tipo'), fecha: campo('card-fecha'), vence: campo('card-vence'),
        compras: antigo ? antigo.compras : [],
        final: soDigitos(campo('card-final')).slice(-4), titular: campo('card-titular').trim(), anuidade: lerMoeda('card-anuidade'), obs: campo('card-obs').trim()
    };
    if (!card.nome) return erro('Preencha o nome e limite!');
    const idx = dados.cartoes.findIndex(c => c.id === card.id);
    if (idx > -1) dados.cartoes[idx] = card; else dados.cartoes.push(card);
    salvarERender(); ocultarModal('modalCartao'); avisar('Cartão salvo');
}
function excluirCartaoNoModal() {
    const id = Number(campo('card-id-edit'));
    if (!confirm('Deseja mover este cartão para a lixeira?')) return;
    const idx = dados.cartoes.findIndex(c => c.id === id); if (idx < 0) return;
    const item = dados.cartoes.splice(idx, 1)[0];
    item.origem = 'cartoes'; item.deletadoEm = new Date().toLocaleDateString('pt-BR'); item.lixeiraTitulo = 'Cartão: ' + item.nome;
    dados.lixeira.push(item);
    salvarERender(); ocultarModal('modalCartao'); avisar('Cartão excluído');
    if (_secAtual === 'compras-cartao') showSection('cartoes');
}

// ---------- cartão: lista de cartões ----------
function bandeiraIcone(b) {
    b = (b || '').toLowerCase();
    return b.includes('visa') ? '<i class="fab fa-cc-visa"></i>' : b.includes('master') ? '<i class="fab fa-cc-mastercard"></i>' : (b.includes('amex') || b.includes('american')) ? '<i class="fab fa-cc-amex"></i>' : b.includes('diners') ? '<i class="fab fa-cc-diners-club"></i>' : '<span class="fp-band">' + escaparHTML(b.toUpperCase().slice(0, 8)) + '</span>';
}
function moverCartao(id, dir) { // reordena a lista de cartões (cima/baixo)
    const i = dados.cartoes.findIndex(c => c.id === id), j = i + dir; if (i < 0 || j < 0 || j >= dados.cartoes.length) return;
    const [c] = dados.cartoes.splice(i, 1); dados.cartoes.splice(j, 0, c); salvarERender();
}
function renderCartoes() {
    const L = document.getElementById('lista-cartoes'), H = document.getElementById('home-lista-cartoes'); if (!L) return;
    const ym = mesAtual, mesNome = MESES_C[parseInt(ym.slice(5)) - 1];
    const cardHtml = (c, idx, wallet, frente) => {
        const deb = c.tipo === 'Débito', cor = /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : '#57005F', fg = c.corFonte || '#fff';
        const itF = deb ? [] : itensFatura(c, ymFat(c, ym)), fat = itF.filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0), fatTerc = itF.filter(i => i.c.emprestado).reduce((s, i) => s + i.valor, 0), usado = limiteUsado(c), perc = c.limite > 0 ? Math.min(100, usado / c.limite * 100) : 0;
        const temF = itF.some(i => !i.c.emprestado), quit = temF && faturaQuitada(c, ymFat(c, ym), itF), stCls = !temF ? '' : quit ? ' fat-paga' : ' fat-pend';
        const stPill = !temF ? '' : quit ? '<span class="fp-pill fp-st ok"><i class="fas fa-circle-check"></i> Paga</span>' : '<span class="fp-pill fp-st pend"><i class="fas fa-clock"></i> Pendente</span>';
        const clique = wallet && !frente ? 'focarCartao(' + c.id + ')' : 'verCompras(' + c.id + ')';
        return '<div class="fp-cartao' + stCls + (wallet ? ' wallet-card' + (frente ? ' wallet-front' : '') : '') + '" style="background:linear-gradient(135deg,' + cor + ' 0%,' + shade(cor, .45) + ' 100%);color:' + fg + '" onclick="if(!event.target.closest(\'.dropdown\'))' + clique + '"><div class="fp-deco"></div>'
            + '<div class="fp-c-top"><div><b class="fp-c-nome">' + escaparHTML(c.nome) + '</b><small class="d-block fp-sub">' + (deb ? 'Débito' : 'Crédito') + (c.final ? ' •••• ' + escaparHTML(c.final) : '') + '</small></div>'
            + '<div class="d-flex align-items-center gap-2"><span class="fp-bandeira">' + bandeiraIcone(c.bandeira) + '</span><div class="dropdown"><button type="button" class="fp-menu-btn" data-bs-toggle="dropdown" aria-label="Opções do cartão"><i class="fas fa-ellipsis-v"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0"><li><button class="dropdown-item" onclick="abrirModalCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar cartão</button></li>' + (dados.cartoes.length > 1 ? (idx > 0 ? '<li><button class="dropdown-item" onclick="moverCartao(' + c.id + ',-1)"><i class="fas fa-arrow-up me-2"></i>Mover para cima</button></li>' : '') + (idx < dados.cartoes.length - 1 ? '<li><button class="dropdown-item" onclick="moverCartao(' + c.id + ',1)"><i class="fas fa-arrow-down me-2"></i>Mover para baixo</button></li>' : '') : '') + '</ul></div></div></div>'
            + '<div class="fp-mid"><small class="fp-sub">' + (deb ? 'Cartão de débito' : 'Fatura de ' + mesNome) + '</small><div class="fp-valor money-value">' + (deb ? 'Sem fatura' : brl(fat)) + '</div>' + (fatTerc > 0 ? '<small class="fp-sub d-block">+ ' + brl(fatTerc) + ' de terceiros</small>' : '') + (deb ? '' : '<span class="fp-pill">Vence dia ' + String(c.vence).padStart(2, '0') + ' • Fecha dia ' + String(c.fecha).padStart(2, '0') + '</span> ' + stPill) + '</div>'
            + '<div class="fp-bot"><div class="fp-bar"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Disponível <b class="money-value">' + brl(c.limite - usado) + '</b></span><span>Limite ' + brl(c.limite) + '</span></div></div></div>';
    };
    const lista = dados.cartoes.map((c, idx) => cardHtml(c, idx, false, false)).join('');
    const carteira = dados.config.cartoesVisual === 'carteira' && dados.cartoes.length > 0;
    if (carteira) {
        const foco = dados.cartoes.some(c => c.id === _walletFoco) ? _walletFoco : dados.cartoes[dados.cartoes.length - 1].id;
        const ordem = dados.cartoes.map((c, idx) => ({ c, idx })).filter(x => x.c.id !== foco).concat(dados.cartoes.map((c, idx) => ({ c, idx })).filter(x => x.c.id === foco));
        L.innerHTML = '<div class="wallet">' + ordem.map(x => cardHtml(x.c, x.idx, true, x.c.id === foco)).join('') + '</div>'
            + (dados.cartoes.length > 1 ? '<div class="wallet-dica"><i class="fas fa-hand-pointer"></i> Toque em um cartão para trazê-lo para a frente. Toque de novo para abrir a fatura.</div>' : '')
            + '<div class="wallet-acoes"><button type="button" onclick="verCompras(' + foco + ')"><i class="fas fa-file-invoice-dollar"></i> Abrir fatura</button><button type="button" onclick="abrirModalCartao(' + foco + ')"><i class="fas fa-pen"></i> Editar</button></div>';
    } else L.innerHTML = lista;
    if (H) H.innerHTML = lista;
    document.querySelectorAll('#vis-cartoes button').forEach(b => b.classList.toggle('on', b.dataset.v === (carteira ? 'carteira' : 'lista')));
}
let _walletFoco = null;
function focarCartao(id) { _walletFoco = id; renderCartoes(); }
function setVisualCartoes(v) { dados.config.cartoesVisual = v; persistir(); renderCartoes(); }

// ---------- cartão: tela de compras (fatura do mês / todas as compras) ----------
function verCompras(id) {
    cartaoContexto = id; abaCartao = 'fatura'; buscaCompra = ''; statusCompra = 'todos';
    ['busca-compra'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; }); const sc = document.getElementById('status-compra'); if (sc) sc.value = 'todos';
    const c = cartaoAtual(); if (!c) return;
    document.getElementById('titulo-compras-cartao').innerText = 'Compras: ' + c.nome;
    showSection('compras-cartao');
}
function setAbaCartao(a) { abaCartao = a; statusCompra = a === 'paga' ? 'paga' : a === 'pendente' ? 'pendente' : 'todos'; renderComprasCartao(); }
// ---- status de pagamento: fatura inteira (card.faturasPagas) e compra a compra (pagamentos) ----
let buscaCompra = '', statusCompra = 'todos';
const _norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const _soma = l => l.reduce((s, i) => s + i.valor, 0);
const _fixaKey = c => c.mov ? (c.fixa ? 'm:' + c.desc : 'x:' + c.movId) : 'c:' + c.id;
function fixaPaga(card, c, ymF) { return !!(card.fixasPagas && card.fixasPagas[ymF + '|' + _fixaKey(c)]); }
function alternarPagaFixa(keyEnc) { // marca/desfaz o pagamento da conta fixa na fatura que está aberta
    if (!verificarAcesso()) return; const card = cartaoAtual(), ymF = ymFat(card, mesAtual), k = ymF + '|' + decodeURIComponent(keyEnc);
    card.fixasPagas = card.fixasPagas || {};
    if (card.fixasPagas[k]) { delete card.fixasPagas[k]; avisar('Conta fixa voltou para pendente'); }
    else { card.fixasPagas[k] = { data: hojeISO() }; avisar('Conta fixa paga nesta fatura. Ela volta como pendente na próxima.'); }
    salvarERender();
}
function fatPaga(card, ymF) { return !!(card.faturasPagas && card.faturasPagas[ymF]); }
function _numParcela(card, c, ymF, todas) { // posição real da parcela no cronograma da compra
    const ps = parcelasCompra(card, c); if (todas) return ps.length;
    return Math.max(1, ps.findIndex(x => x.ym === ymF) + 1);
}
function itemPago(card, it, ymF, todas) {
    const { c } = it;
    if (c.fixa || c.mov) return fatPaga(card, ymF) || fixaPaga(card, c, ymF); // conta fixa: paga só nesta fatura; na próxima volta como pendente
    if (todas) return _pagoTotal(c) >= c.valorTotal - 0.005;                    // compra inteira quitada
    if (fatPaga(card, ymF)) return true;
    return _pagoNaParcela(c, ymF) >= _valParcela(c) - 0.005;                    // só esta parcela
}
function faturaQuitada(card, ymF, itens) { // paga = marcada como paga, ou todas as compras (sem fixas) quitadas
    if (fatPaga(card, ymF)) return true;
    const minhas = itens.filter(i => !i.c.emprestado);
    return minhas.length > 0 && minhas.every(i => itemPago(card, i, ymF, false));
}
function pagarFaturaCartao() {
    if (!verificarAcesso()) return; const card = cartaoAtual(), ymF = ymFat(card, mesAtual);
    card.faturasPagas = card.faturasPagas || {}; card.faturasPagas[ymF] = { data: hojeISO() };
    const data = new Date().toLocaleDateString('pt-BR'), hora = horaAgora(); // registra o pagamento de cada parcela desta fatura (a compra mostra o quanto já foi pago)
    itensFatura(card, ymF).forEach(i => { const c = i.c; if (c.fixa || c.mov) return; const f = _valParcela(c) - _pagoNaParcela(c, ymF); if (f > 0.004) (c.pagamentos = c.pagamentos || []).push({ valor: arred(f), data, hora, ym: ymF, viaFatura: true }); });
    salvarERender(); avisar('Fatura marcada como paga');
}
function desfazerPagamentoFatura() {
    if (!verificarAcesso()) return; const card = cartaoAtual(), ymF = ymFat(card, mesAtual);
    if (card.faturasPagas) delete card.faturasPagas[ymF];
    (card.compras || []).forEach(c => { c.pagamentos = (c.pagamentos || []).filter(p => !(p.viaFatura && p.ym === ymF)); }); // desfaz só o que a fatura registrou
    salvarERender(); avisar('Fatura voltou para pendente');
}
function filtrarCompras() {
    buscaCompra = _norm((document.getElementById('busca-compra') || {}).value);
    renderComprasCartao();
}
function _passaFiltro(card, it, ymF, todas) {
    const c = it.c;
    if (buscaCompra && !_norm([c.desc, c.pessoa, c.local, c.cat, c.obs].join(' ')).includes(buscaCompra)) return false;
    if (statusCompra === 'todos') return true;
    return (statusCompra === 'paga') === itemPago(card, it, ymF, todas);
}
const _PALETA_PESSOA = ['#57005F', '#f59e0b', '#14b8a6', '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#7a1a85'];
function _corPessoa() { return '#57005F'; } // cor única para todas as pessoas (interface menos poluída)

function badgeCompra(card, it, ymF, todas) {
    const { c } = it;
    if (c.fixa || c.mov) return c.mov ? 'Conta fixa' : 'Fixo';
    const ps = parcelasCompra(card, c);
    return todas ? (ps.length > 1 ? ps.length + 'x' : 'À vista') : _numParcela(card, c, ymF, false) + '/' + ps.length;
}
function _cardItem(card, it, ymF, todas) {
    const { c, valor } = it, dia = parseInt(c.data.substring(8, 10)) || 1, fixo = c.fixa || c.mov;
    const paga = itemPago(card, it, ymF, todas), st = paga ? 'paga' : 'pend';
    let meio, datas, pct = 100;
    if (fixo) {
        meio = '<div><small>Valor mensal</small><b class="money-value">' + brl(valor) + '</b></div><div><small>Duração</small><b>Todo mês</b></div>';
        datas = '<span><i class="far fa-calendar"></i> Início ' + dataCompletaBR(c.data) + '</span><span><i class="fas fa-infinity"></i> Sem data final</span>'; pct = 0;
    } else {
        const ps = parcelasCompra(card, c), tot = ps.length, n = todas ? 1 : _numParcela(card, c, ymF, false), last = ps[tot - 1].ym, [ay, am] = last.split('-').map(Number);
        const pgParc = _pagoNaParcela(c, ymF), falta = todas ? Math.max(0, c.valorTotal - _pagoTotal(c)) : (fatPaga(card, ymF) ? 0 : Math.max(0, valor - pgParc));
        pct = todas ? Math.min(100, _pagoTotal(c) / c.valorTotal * 100) : n / tot * 100;
        meio = '<div><small>Total da compra</small><b class="money-value">' + brl(c.valorTotal) + '</b></div><div><small>' + (todas ? 'Falta pagar' : 'Falta nesta parcela') + '</small><b class="money-value ' + (falta > 0 ? 'text-danger' : 'text-success') + '">' + brl(falta) + '</b></div>';
        const pagUlt = mesPagamento(card, last); // mês (da fatura) da última parcela
        datas = '<span><i class="far fa-calendar"></i> Início ' + dataCompletaBR(c.data) + '</span><span><i class="far fa-flag"></i> ' + (tot > 1 ? 'Última parcela: ' : 'Vence: ') + MESES_C[+pagUlt.slice(5) - 1] + '/' + pagUlt.slice(0, 4) + '</span>'
            + (!todas && tot > 1 ? '<span><i class="fas fa-hourglass-half"></i> Depois desta, restam ' + (tot - n) + '</span>' : '');
    }
    const itemFixa = (fixo && !fatPaga(card, ymF)) ? '<li><button class="dropdown-item py-2" onclick="alternarPagaFixa(\'' + _enc(_fixaKey(c)) + '\')"><i class="fas ' + (paga ? 'fa-rotate-left' : 'fa-circle-check') + ' me-2"></i>' + (paga ? 'Desfazer pagamento' : 'Marcar como paga') + '</button></li>' : '';
    const alvo = fixo ? ymF : parcelaAlvo(card, c, ymF), pgAlvo = fixo ? 0 : _pagoNaParcela(c, alvo), alvoPago = !fixo && (pgAlvo >= _valParcela(c) - 0.005 || fatPaga(card, alvo)), BT = (fn, ic, t) => '<li><button class="dropdown-item py-2" onclick="' + fn + '"><i class="fas ' + ic + ' me-2"></i>' + t + '</button></li>';
    const rot = fixo ? '' : _rotParcela(card, c, alvo), itemPag = fixo ? '' : (alvoPago ? '' : BT('prepararPagamentoCompra(' + c.id + ',\'total\')', 'fa-circle-check', 'Pagar parcela ' + rot) + BT('prepararPagamentoCompra(' + c.id + ',\'parcial\')', 'fa-coins', 'Pagamento parcial da parcela'))
        + (fixo ? '' : (pgAlvo > 0.004 ? BT('desfazerPagamentoParcela(' + c.id + ')', 'fa-rotate-left', 'Desfazer pagamento da parcela') : '') + BT('anteciparParcelaModal(' + c.id + ')', 'fa-forward', 'Antecipar parcelas') + BT('quitarCompraInteira(' + c.id + ')', 'fa-flag-checkered', 'Quitar compra inteira') + ((c.pagamentos || []).length ? BT('zerarPagamentosCompra(' + c.id + ')', 'fa-eraser', 'Apagar todos os pagamentos') : ''));
    const menu = (c.mov ? '<li><button class="dropdown-item py-2" onclick="abrirTransacao(' + c.movId + ')"><i class="fas fa-pen me-2"></i>Editar lançamento</button></li>'
        : '<li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(' + c.id + ')"><i class="fas fa-pen me-2"></i>Editar compra</button></li>'
        + (c.fixa ? '' : itemPag)) + itemFixa;
    const fxp = fixo && card.fixasPagas && card.fixasPagas[ymF + '|' + _fixaKey(c)];
    const pags = (c.pagamentos || []).filter(p => todas || p.ym === ymF).map(p => '<div>' + brl(p.valor) + ' em ' + escaparHTML(p.data) + (todas && p.ym ? ' • parc. ' + MESES_C[+p.ym.slice(5) - 1] + '/' + p.ym.slice(2, 4) : '') + (p.antecipada ? ' (antecipada)' : '') + '</div>').join('') + (fxp ? '<div>' + brl(valor) + ' em ' + dataBR(fxp.data) + ' (esta fatura)</div>' : '');
    const inv = mesPagamento(card, mesFatura(card, c)), entra = todas ? '<div class="cc-l3"><span><i class="fas fa-file-invoice"></i> ' + (fixo ? 'Entra na fatura de ' : '1ª fatura: ') + MESES_C[+inv.slice(5) - 1] + '/' + inv.slice(0, 4) + '</span></div>' : '';
    return '<div class="cc-item cc-compacto ' + st + '" onclick="if(!event.target.closest(\'.dropdown\'))this.classList.toggle(\'aberto\')"><div class="cc-l1"><i class="fas fa-chevron-down cc-seta"></i><b class="cc-desc">' + escaparHTML(c.desc) + '</b><span class="cc-parc money-value">' + brl(valor) + '</span><span class="cc-badge">' + badgeCompra(card, it, ymF, todas) + '</span>'
        + '<div class="dropdown"><button class="cc-menu" data-bs-toggle="dropdown" aria-label="Opções"><i class="fas fa-ellipsis-vertical"></i></button><ul class="dropdown-menu dropdown-menu-end shadow border-0">' + menu + '</ul></div></div>'
        + (c.emprestado && c.pessoa ? '<div class="cc-quem"><i class="fas fa-user-group"></i> ' + escaparHTML(c.pessoa) + '</div>' : '') + '<div class="cc-det">'
        + '<div class="cc-l3"><span class="cc-st ' + st + '"><i class="fas ' + (paga ? 'fa-circle-check' : 'fa-clock') + '"></i> ' + (paga ? 'Paga' : 'Pendente') + '</span>' + (c.pessoa ? '<span><i class="fas fa-user-group"></i> ' + escaparHTML(c.pessoa) + '</span>' : '') + '</div>'
        + '<div class="cc-l2">' + meio + '</div>' + (fixo ? '' : '<div class="cc-bar"><div style="width:' + pct + '%"></div></div>')
        + '<div class="cc-l3">' + datas + '</div>' + entra
        + ((c.local || c.cat) ? '<div class="cc-l3">' + (c.local ? '<span><i class="fas fa-store"></i> ' + escaparHTML(c.local) + '</span>' : '') + (c.cat ? '<span><i class="fas fa-tag"></i> ' + escaparHTML(c.cat) + '</span>' : '') + '</div>' : '')
        + (pags ? '<div class="cc-pags"><b>Pagamentos</b>' + pags + '</div>' : '') + '</div></div>';
}
function todasComprasCartao(card) { // todas as compras do cartão, em qualquer fatura
    const itens = (card.compras || []).map(c => ({ c, valor: c.fixa ? c.valorTotal : c.valorTotal / c.parcelas })), fixos = {};
    dados.movs.forEach(m => {
        if (m.cartaoId !== card.id || m.tipo !== 'saida' || !m.data) return;
        if (!m.fixo) { itens.push({ c: pseudoMov(m, false), valor: m.valor }); return; }
        if (!fixos[m.desc] || m.data > fixos[m.desc].data) fixos[m.desc] = m;
    });
    Object.values(fixos).forEach(m => itens.push({ c: pseudoMov(m, true), valor: m.valor }));
    return itens.sort((a, b) => (b.c.data || '').localeCompare(a.c.data || ''));
}
function renderComprasCartao() {
    const card = cartaoAtual(); if (!card) return;
    const ym = mesAtual, ymF = ymFat(card, ym), itens = itensFatura(card, ymF), usado = limiteUsado(card), corCard = /^#[0-9a-f]{6}$/i.test(card.cor || '') ? card.cor : '#57005F', fg = card.corFonte || '#fff';
    const minhas = itens.filter(i => !i.c.emprestado), emp = itens.filter(i => i.c.emprestado), perc = card.limite > 0 ? Math.min(100, usado / card.limite * 100) : 0;
    // cor do cartão: verde = fatura paga, vermelho = pendente (o roxo/cor do cartão só aparece quando não há nada na fatura)
    const quitada = faturaQuitada(card, ymF, itens), estado = !minhas.length ? 'vazia' : quitada ? 'paga' : 'pendente';
    const fundo = estado === 'paga' ? 'linear-gradient(135deg,#059669,#10b981)' : estado === 'pendente' ? 'linear-gradient(135deg,#a31d2a,#D62839)' : 'linear-gradient(135deg,' + corCard + ',' + shade(corCard, .45) + ')';
    const selo = estado === 'paga' ? '<span class="fat-selo ok"><i class="fas fa-circle-check"></i> Fatura paga</span>' : estado === 'pendente' ? '<span class="fat-selo pend"><i class="fas fa-clock"></i> Pendente</span>' : '';
    const botao = estado === 'vazia' ? '' : fatPaga(card, ymF) ? '<button type="button" class="fat-btn" onclick="desfazerPagamentoFatura()"><i class="fas fa-rotate-left me-1"></i>Desfazer pagamento</button>' : '<button type="button" class="fat-btn" onclick="pagarFaturaCartao()"><i class="fas fa-circle-check me-1"></i>Marcar fatura como paga</button>';
    document.getElementById('info-cartao-detalhe').innerHTML = '<div class="cc-resumo ' + estado + '" style="background:' + fundo + ';color:' + (estado === 'vazia' ? fg : '#fff') + '"><div class="d-flex justify-content-between align-items-end"><div><small class="fp-sub">Fatura de ' + MESES_C[parseInt(ym.slice(5)) - 1] + '</small><div class="fp-valor money-value">' + brl(_soma(minhas)) + '</div></div><div class="text-end">' + selo + '<small class="fp-sub d-block mt-1">Disponível <b class="money-value">' + brl(card.limite - usado) + '</b></small></div></div>'
        + '<div class="fp-bar mt-2"><div style="width:' + perc + '%"></div></div><div class="d-flex justify-content-between fp-sub"><span>Fecha dia ' + String(card.fecha).padStart(2, '0') + '</span><span>Vence ' + String(card.vence).padStart(2, '0') + '/' + ym.slice(5) + '/' + ym.slice(0, 4) + '</span></div>'
        + (emp.length ? '<div class="fp-sub mt-1">Emprestado (fora do seu extrato): <b class="money-value">' + brl(_soma(emp)) + '</b></div>' : '') + botao + '</div>';
    document.querySelectorAll('#cartao-abas button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === abaCartao));
    const sec = (ic, t, v, cls = '') => '<div class="cc-sec ' + cls + '"><span><i class="fas ' + ic + '"></i> ' + t + '</span><b class="money-value">' + brl(v) + '</b></div>';
    const todasAba = abaCartao === 'todas' || abaCartao === 'fixas', fixasAba = abaCartao === 'fixas', filtrando = !!buscaCompra || statusCompra !== 'todos';
    let html = '', listados = new Set();
    if (todasAba) {
        const todas = todasComprasCartao(card).filter(i => !!i.c.fixa === fixasAba).filter(i => _passaFiltro(card, i, ymF, true));
        html = todas.length ? (fixasAba ? sec('fa-rotate', 'Contas fixas (' + todas.length + ')', _soma(todas), 'cc-sec-fixas') : sec('fa-list', 'Todas as compras (' + todas.length + ')', _soma(todas.filter(i => !i.c.mov).map(i => ({ valor: i.c.valorTotal }))))) + todas.map(i => _cardItem(card, i, ymF, true)).join('') : '';
    } else {
        const mf = minhas.filter(i => _passaFiltro(card, i, ymF, false)), ef = emp.filter(i => _passaFiltro(card, i, ymF, false));
        html = mf.length ? sec('fa-user', 'Minhas compras', _soma(mf)) + mf.map(i => _cardItem(card, i, ymF, false)).join('') : '';
        listados = new Set([...mf, ...ef].map(i => i.c.id));
        if (ef.length) {
            const g = {}; ef.forEach(i => { const k = (i.c.pessoa || '').trim() || 'Sem nome'; (g[k] = g[k] || []).push(i); });
            html += '<div class="cc-titulo-emp"><i class="fas fa-people-arrows"></i> Cartão emprestado</div>' + Object.entries(g).map(([n, l]) => {
                const quit = l.every(i => itemPago(card, i, ymF, false)), cp = quit ? '#10b981' : '#D62839'; // linha: vermelho = pendente, verde = paga
                return '<div class="emp-pessoa" style="--pc:' + cp + '"><div class="emp-head"><span class="emp-av">' + escaparHTML(n.charAt(0).toUpperCase()) + '</span><b class="emp-nome">' + escaparHTML(n) + '</b><span class="cc-st ' + (quit ? 'paga' : 'pend') + '">' + (quit ? 'Pago' : 'Pendente') + '</span>' + _btnsEmp(card.id, n) + '</div>'
                    + l.map(i => _cardItem(card, i, ymF, false)).join('') + '</div>';
            }).join('');
        }
    }
    if (!todasAba && !buscaCompra) {
        if (statusCompra === 'todos') { // compras feitas neste mês que caem em outra fatura (ex.: depois do fechamento)
            const fora = todasComprasCartao(card).filter(i => !i.c.fixa && i.c.data && i.c.data.startsWith(ym) && !itens.some(x => x.c.id === i.c.id));
            if (fora.length) html += '<div class="cc-sec cc-sec-fora"><span><i class="fas fa-forward"></i> Compras do mês em outras faturas (' + fora.length + ')</span></div><div class="cc-aviso">Feitas depois do fechamento: entram na próxima fatura e não somam na fatura acima.</div>' + fora.map(i => _cardItem(card, i, ymF, true)).join('');
        } else if (statusCompra === 'paga') { // todas as compras já quitadas (inclui emprestadas), mesmo que a parcela seja de outra fatura
            const q = todasComprasCartao(card).filter(i => !i.c.fixa && !i.c.mov && !listados.has(i.c.id) && itemPago(card, i, ymF, true));
            if (q.length) html += '<div class="cc-sec cc-sec-paga"><span><i class="fas fa-circle-check"></i> Compras totalmente quitadas (' + q.length + ')</span></div>' + q.map(i => _cardItem(card, i, ymF, true)).join('');
        }
    }
    const vazio = abaCartao === 'fixas' && !filtrando ? 'Nenhuma conta fixa neste cartão.' : abaCartao === 'paga' && !filtrando ? 'Nenhuma compra paga nesta fatura.' : abaCartao === 'pendente' && !filtrando ? 'Nenhuma compra pendente nesta fatura.' : filtrando ? 'Nenhuma compra encontrada com esse filtro.' : todasAba ? 'Nenhuma compra neste cartão ainda.' : 'Nenhuma compra nesta fatura. Se você acabou de lançar, veja a aba <b>Todas as compras</b>.';
    document.getElementById('lista-compras-cartao').innerHTML = html || '<p class="text-center text-muted small py-4">' + vazio + '</p>';
}

// ---------- compra: formulário ----------
function togglePessoa() { const w = document.getElementById('compra-pessoa-wrap'); if (w) w.classList.toggle('d-none', !marcado('compra-emprestado')); }
function toggleCompraFixa() { // compra fixa = um valor que se repete todo mês (1 parcela)
    const fixa = marcado('compra-fixa'), p = document.getElementById('compra-parcelas');
    if (fixa) { if (!p.disabled) p.dataset.prev = p.value; p.value = 1; } else if (p.disabled && p.dataset.prev) p.value = p.dataset.prev; // volta às parcelas de antes
    p.disabled = fixa; previewCompra();
}
let _mesIniPend = null;
function previewCompra() {
    const card = cartaoAtual(), el = document.getElementById('compra-preview'); if (!card || !el) return;
    const v = lerMoeda('compra-valor'), n = Math.max(1, parseInt(campo('compra-parcelas')) || 1), data = campo('compra-data') || hojeISO(), fixa = marcado('compra-fixa');
    const L = ym => MESES_C[+ym.slice(5) - 1] + '/' + ym.slice(0, 4), sel = document.getElementById('compra-mesini');
    const dm = data.slice(0, 7), auto = mesPagamento(card, mesFatura(card, { data })), cur = _mesIniPend !== null ? _mesIniPend : (sel ? sel.value : ''); _mesIniPend = null;
    const ops = [['', 'Automático (' + L(auto) + ')']]; [dm, ymAdd(dm, 1)].forEach((y, i) => { if (y !== auto) ops.push([y, (i ? 'Mês seguinte ' : 'Mês da compra ') + '(' + L(y) + ')']); });
    if (cur && !ops.some(o => o[0] === cur)) ops.push([cur, L(cur)]);
    if (sel) { sel.innerHTML = ops.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join(''); sel.value = ops.some(o => o[0] === cur) ? cur : ''; }
    if (v <= 0) { el.innerHTML = '<i class="fas fa-circle-info me-1"></i>Informe o valor para ver em qual fatura a compra cai.'; return; }
    const ini = (sel && sel.value) || auto;
    el.innerHTML = '<i class="fas fa-circle-info me-1"></i>' + (fixa ? 'Todo mês, a partir de ' : n + 'x de ') + '<b>' + (fixa ? brl(v) + '</b> • ' : brl(v / n) + '</b> • 1ª parcela em <b>') + (fixa ? '<b>' : '') + L(ini) + '</b>' + (!fixa && n > 1 ? ' • termina em <b>' + L(ymAdd(ini, n - 1)) + '</b>' : '') + ' <span class="text-muted">(fecha dia ' + card.fecha + ')</span>';
}
function abrirModalCompraCartao(id = null) {
    const card = cartaoAtual(); if (!card) return erro('Abra um cartão para lançar compras.');
    const c = id ? card.compras.find(x => x.id == id) : null;
    setCampo('compra-id-edit', c ? c.id : ''); setCampo('compra-desc', c ? c.desc : '');
    setCampo('compra-valor', c ? fmtMoeda(c.valorTotal) : ''); setCampo('compra-parcelas', c ? c.parcelas : 1);
    setCampo('compra-data', c ? c.data : hojeISO());
    document.getElementById('compra-emprestado').checked = !!(c && c.emprestado);
    document.getElementById('compra-fixa').checked = !!(c && c.fixa); document.getElementById('compra-parcelas').disabled = !!(c && c.fixa);
    setCampo('compra-pessoa', c && c.pessoa); togglePessoa();
    const s = document.getElementById('compra-cat'), l = cats().saida.filter(x => x !== 'Cartão'); if (c && c.cat && !l.includes(c.cat)) l.push(c.cat);
    s.innerHTML = '<option value="">Sem categoria</option>' + l.map(x => '<option>' + escaparHTML(x) + '</option>').join(''); s.value = (c && c.cat) || '';
    setCampo('compra-local', c && c.local); setCampo('compra-obs', c && c.obs);
    document.getElementById('btn-excluir-compra').classList.toggle('d-none', !c);
    document.getElementById('modalCompraTitulo').innerText = c ? 'Editar Compra' : 'Nova Compra';
    _mesIniPend = c ? (c.mesIni || '') : ''; previewCompra(); mostrarModal('modalCompraCartao');
}
function compraVisivelNaFatura(card, c, ymF) { return c.fixa ? ymF >= mesFatura(card, c) : parcelasCompra(card, c).some(p => p.ym === ymF); }
function salvarCompraCartao() {
    const card = cartaoAtual(); if (!card) return erro('Erro: Cartão não encontrado.');
    const idEdit = Number(campo('compra-id-edit')) || 0, desc = campo('compra-desc').trim(), valorTotal = lerMoeda('compra-valor');
    if (!desc || valorTotal <= 0) return erro('Preencha a descrição e o valor da compra corretamente!');
    const fixa = marcado('compra-fixa'), emprestado = marcado('compra-emprestado');
    const parcelas = fixa ? 1 : Math.max(1, Math.floor(Number(campo('compra-parcelas'))) || 1); // sem limite máximo de parcelas
    const antiga = idEdit ? card.compras.find(c => c.id === idEdit) : null, hora = horaAgora();
    const compra = {
        ...(antiga || {}), id: idEdit || Date.now(), desc, valorTotal, parcelas, fixa, emprestado,
        data: campo('compra-data') || hojeISO(), hora: antiga ? (antiga.hora || hora) : hora, pagamentos: antiga ? (antiga.pagamentos || []) : [],
        pessoa: emprestado ? campo('compra-pessoa').trim() : '', cat: campo('compra-cat'), local: campo('compra-local').trim(), obs: campo('compra-obs').trim(), pagV2: true
    };
    const dataC = compra.data, autoPag = mesPagamento(card, mesFatura(card, { data: dataC })), escolhido = campo('compra-mesini');
    compra.mesIni = (escolhido && escolhido !== autoPag) ? escolhido : ''; // só guarda se o usuário mudou o automático
    const idx = card.compras.findIndex(c => c.id === compra.id);
    if (idx > -1) card.compras[idx] = compra; else card.compras.push(compra);
    // espelho no extrato (compra de cartão emprestado não entra no seu extrato)
    const movIdx = dados.movs.findIndex(m => m.idRelacionado === compra.id);
    if (emprestado) { if (movIdx > -1) dados.movs.splice(movIdx, 1); }
    else {
        const movData = { id: movIdx > -1 ? dados.movs[movIdx].id : Date.now() + 1, idRelacionado: compra.id, desc: parcelas > 1 ? compra.desc + ' (1/' + parcelas + ')' : compra.desc, valor: arred(valorTotal / parcelas), tipo: 'saida', cat: 'Cartão', data: compra.data, hora: compra.hora };
        if (movIdx > -1) dados.movs[movIdx] = movData; else dados.movs.push(movData);
    }
    // se a compra cai em outra fatura (ex.: depois do fechamento), mostra a fatura onde ela entrou
    let msg = 'Compra salva';
    const ymF = ymFat(card, mesAtual);
    if (_secAtual === 'compras-cartao' && !compraVisivelNaFatura(card, compra, ymF)) {
        const inv = mesFatura(card, compra), alvo = mesPagamento(card, inv);
        mesAtual = alvo; msg = 'Compra salva — entra na fatura de ' + MESES_C[+inv.slice(5) - 1] + '/' + inv.slice(0, 4) + ' (mostrando essa fatura)';
    }
    salvarERender(); ocultarModal('modalCompraCartao'); avisar(msg);
}
function excluirCompraNoModal() {
    const id = Number(campo('compra-id-edit')), card = cartaoAtual(); if (!id || !card) return;
    if (!confirm('Excluir esta compra?')) return;
    card.compras = card.compras.filter(c => Number(c.id) !== id);
    dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== id);
    salvarERender(); ocultarModal('modalCompraCartao'); avisar('Compra excluída');
}

// ---------- compra: pagamentos e antecipação ----------
function _rotParcela(card, c, ym) { return _numParcela(card, c, ym, false) + '/' + parcelasCompra(card, c).length + ' (' + MESES_C[+ym.slice(5) - 1] + ')'; }
function prepararPagamentoCompra(id, modo) { // "total" = quitar ESTA parcela; "parcial" = pagar parte dela
    const card = cartaoAtual(), c = card.compras.find(x => x.id == id), ym = parcelaAlvo(card, c, ymFat(card, mesAtual));
    const falta = Math.max(0, _valParcela(c) - _pagoNaParcela(c, ym));
    if (falta <= 0.004) return avisar('Esta parcela já está paga.');
    setCampo('pag-id', id); setCampo('pag-modo', modo + '-cartao'); setCampo('pag-ym', ym); setCampo('pag-data', hojeISO());
    document.getElementById('tituloPagamento').innerText = (modo === 'total' ? 'Pagar parcela ' : 'Pagamento parcial da parcela ') + _rotParcela(card, c, ym);
    setCampo('pag-valor', modo === 'total' ? fmtMoeda(falta) : '');
    document.getElementById('area-valor-pag').classList.toggle('d-none', modo === 'total');
    document.getElementById('pag-extrato-wrap').classList.add('d-none'); // lançar no extrato só vale para dívidas
    mostrarModal('modalPagamento');
}
function desfazerPagamentoParcela(id) {
    const card = cartaoAtual(), c = card.compras.find(x => x.id == id); if (!c) return;
    const ym = parcelaAlvo(card, c, ymFat(card, mesAtual));
    if (!confirm('Desfazer o pagamento da parcela ' + _rotParcela(card, c, ym) + '?')) return;
    c.pagamentos = (c.pagamentos || []).filter(p => p.ym !== ym); salvarERender(); avisar('Pagamento da parcela desfeito');
}
function quitarCompraInteira(id) {
    const card = cartaoAtual(), c = card.compras.find(x => x.id == id); if (!c) return;
    const aberto = parcelasCompra(card, c).map(p => ({ ym: p.ym, v: _valParcela(c) - _pagoNaParcela(c, p.ym) })).filter(x => x.v > 0.004);
    if (!aberto.length) return avisar('Todas as parcelas já estão pagas.');
    if (!confirm('Quitar a compra inteira? Serão pagas ' + aberto.length + ' parcela(s): ' + brl(aberto.reduce((a, x) => a + x.v, 0)))) return;
    const data = new Date().toLocaleDateString('pt-BR'), hora = horaAgora();
    aberto.forEach(x => c.pagamentos.push({ valor: arred(x.v), data, hora, ym: x.ym })); salvarERender(); avisar('Compra quitada');
}
function zerarPagamentosCompra(id) {
    const card = cartaoAtual(), c = card.compras.find(x => x.id == id); if (!c) return;
    if (!confirm('Apagar TODOS os pagamentos de "' + c.desc + '"? Todas as parcelas voltam a ficar pendentes.')) return;
    c.pagamentos = []; salvarERender(); avisar('Pagamentos apagados');
}
function anteciparParcelaModal(idCompra) {
    const card = cartaoAtual(), compra = card.compras.find(c => c.id == idCompra); if (!compra) return;
    const valorParcela = _valParcela(compra), ymF = ymFat(card, mesAtual); compra.pagamentos = compra.pagamentos || [];
    const disponiveis = parcelasCompra(card, compra).filter(p => p.ym > ymF && _pagoNaParcela(compra, p.ym) < valorParcela - 0.005);
    if (!disponiveis.length) return avisar('Não há parcelas futuras em aberto nesta compra.');
    const txt = prompt('Esta compra possui ' + disponiveis.length + ' parcela(s) futura(s) em aberto.\nQuantas parcelas você deseja antecipar?'); if (!txt) return;
    const qtd = parseInt(txt);
    if (isNaN(qtd) || qtd <= 0 || qtd > disponiveis.length) return erro('Quantidade inválida ou maior do que as parcelas restantes!');
    const sel = disponiveis.slice(-qtd), total = sel.reduce((a, p) => a + valorParcela - _pagoNaParcela(compra, p.ym), 0), nums = sel.map(p => _numParcela(card, compra, p.ym, false)).join(', ');
    if (!confirm('Confirmar a antecipação de ' + qtd + ' parcela(s) (Nº: ' + nums + ') no valor total de ' + brl(total) + '?')) return;
    const hora = horaAgora(), data = new Date().toLocaleDateString('pt-BR');
    sel.forEach(p => compra.pagamentos.push({ valor: arred(valorParcela - _pagoNaParcela(compra, p.ym)), data, hora, ym: p.ym, antecipada: true }));
    dados.movs.push({ id: Date.now(), desc: 'Antecipou ' + qtd + 'x: ' + compra.desc + ' (Parc. ' + nums + ')', valor: total, tipo: 'saida', cat: 'Cartão', data: hojeISO(), hora });
    salvarERender(); avisar(qtd + ' parcela(s) antecipada(s) com sucesso!');
}

/* ===================================================================
   8. DÍVIDAS
   =================================================================== */
// ---------- dívidas recorrentes (várias datas fixas no mês, ex.: dias 15, 20, 25 e 30) ----------
function diasRec(d) { return ((d.rec && d.rec.dias) || []).slice().sort((a, b) => a - b); }
function ocorrenciasRec(d, ym) { // datas deste mês em que a dívida se repete (dia 31 vira o último dia do mês)
    const [a, m] = ym.split('-').map(Number), ult = new Date(a, m, 0).getDate(), parc = (d.rec && d.rec.parc) || {};
    return diasRec(d).map(dia => {
        const dt = ym + '-' + String(Math.min(dia, ult)).padStart(2, '0'), pago = !!(d.rec.pagos && d.rec.pagos[dt]), p = pago ? 0 : (parc[dt] || 0);
        return { data: dt, dia, valor: d.valor, pago, parcial: p, restante: pago ? 0 : Math.max(0, Math.round((d.valor - p) * 100) / 100) };
    });
}
function prazoEfetivo(d) { // próxima data em aberto (recorrente) ou o prazo normal
    if (!d.rec) return d.prazo;
    const ym = hojeISO().substring(0, 7), o = ocorrenciasRec(d, ym).find(x => !x.pago) || ocorrenciasRec(d, ymAdd(ym, 1))[0];
    return o ? o.data : '';
}
const _dividasAbertas = new Set(); // dívidas expandidas (continuam abertas ao atualizar a lista)
function progressoDivida(d, pagar) { // barra de quanto já foi pago/recebido
    if (d.rec) return ''; const tot = d.valorTotal || d.valor, pago = Math.max(0, tot - d.valor); if (pago < 0.005) return '';
    return '<div class="dv-prog"><div class="dv-prog-t"><span>' + (pagar ? 'Já pago ' : 'Já recebido ') + '<b>' + brl(pago) + '</b></span><span>de ' + brl(tot) + '</span></div><div class="cp-prog"><div style="width:' + Math.min(100, pago / tot * 100) + '%"></div></div></div>';
}
function historicoDaDivida(d, pagar) { // últimos pagamentos desta dívida
    const l = dados.movDividas.filter(m => m.dividaId === d.id).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id); if (!l.length) return '';
    return '<div class="dv-sub">' + (pagar ? 'Pagamentos feitos' : 'Recebimentos') + '</div>' + l.slice(0, 4).map(m => '<div class="dv-linha"><span>' + dataBR(m.data).slice(0, 5) + ' • ' + _rotMovDiv(m).replace(/^(Pagamento|Recebimento)( de | • )?/, '') + (m.modo === 'parcial' ? ' (parcial)' : '') + '</span><b>' + brl(m.valor) + '</b></div>').join('') + (l.length > 4 ? '<div class="dv-sub">+ ' + (l.length - 4) + ' no extrato das Dívidas</div>' : '');
}
function toggleDivida(ev, id) {
    if (ev.target.closest('.dropdown, button, a, summary, details')) return;
    const el = ev.currentTarget; el.classList.toggle('aberto');
    if (el.classList.contains('aberto')) _dividasAbertas.add(id); else _dividasAbertas.delete(id);
}
function valorAbertoDivida(d) { return d.rec ? ocorrenciasRec(d, mesAtual).reduce((s, o) => s + o.restante, 0) : d.valor; }
// ======================= DÍVIDAS: pagamentos, confirmação e extrato próprio =======================
function registrarMovDivida(d, o) { // histórico de pagamentos/recebimentos (não entra no extrato geral)
    const m = { id: Date.now() + Math.floor(Math.random() * 1000), dividaId: d.id, nome: d.nome, tipo: d.tipo, desc: d.desc || '', valor: arred(o.valor), data: o.data || hojeISO(), hora: horaAgora(), modo: o.modo, ref: o.ref || '', parcelas: o.parcelas || 0, forma: o.forma || '', obs: o.obs || '', antes: o.antes || null };
    dados.movDividas.push(m); return m;
}
function pendentesDivida(d) { // itens que ainda podem ser confirmados: datas (fixa), parcelas (parcelada) ou nenhum (valor único)
    if (d.rec) return ocorrenciasRec(d, mesAtual).filter(o => !o.pago).map(o => ({ ref: o.data, rot: 'Dia ' + o.data.slice(8, 10), data: o.data, falta: o.restante, valor: o.valor, parcial: o.parcial }));
    if (d.parcelas > 1) {
        const r = d.parcelas - (d.pagas || 0), out = []; let pz = d.prazo, rest = d.valor;
        for (let k = 0; k < r; k++) { const vp = k === r - 1 ? rest : Math.min(d.valorParcela || d.valor, rest); out.push({ ref: String(k + 1), rot: 'Parcela ' + ((d.pagas || 0) + k + 1) + '/' + d.parcelas, data: pz || '', falta: vp, valor: vp, parcial: 0 }); rest = arred(rest - vp); pz = pz ? addMesData(pz) : ''; }
        return out;
    }
    return [];
}
function aplicarPagamentoDivida(d, cfg) { // cfg: {modo:'total'|'parcial', refs:[], qtd, valor, data, forma, obs}
    const data = cfg.data || hojeISO(), base = { data, forma: cfg.forma || '', obs: cfg.obs || '' };
    if (d.rec) {
        d.rec.pagos = d.rec.pagos || {}; d.rec.parc = d.rec.parc || {};
        if (cfg.modo === 'total') {
            cfg.refs.forEach(ref => {
                const oc = ocorrenciasRec(d, ref.slice(0, 7)).find(x => x.data === ref); if (!oc || oc.pago) return;
                d.rec.pagos[ref] = { feitoEm: data, valor: d.valor }; delete d.rec.parc[ref];
                registrarMovDivida(d, { ...base, valor: oc.restante, modo: 'dia', ref, antes: { parc: oc.parcial } });
            });
        } else {
            const ref = cfg.refs[0], oc = ocorrenciasRec(d, ref.slice(0, 7)).find(x => x.data === ref); if (!oc || oc.pago) return;
            const v = Math.min(cfg.valor, oc.restante);
            if (v >= oc.restante - 0.005) { d.rec.pagos[ref] = { feitoEm: data, valor: d.valor }; delete d.rec.parc[ref]; } else d.rec.parc[ref] = arred((d.rec.parc[ref] || 0) + v);
            registrarMovDivida(d, { ...base, valor: v, modo: 'parcial', ref, antes: { parc: oc.parcial } });
        }
        return;
    }
    const parc = d.parcelas > 1, restantes = d.parcelas - (d.pagas || 0), antes = { valor: d.valor, pagas: d.pagas || 0, prazo: d.prazo || '' };
    if (cfg.modo === 'total' && parc && cfg.qtd < restantes) { // só algumas parcelas
        let soma = 0;
        for (let k = 0; k < cfg.qtd; k++) { const vp = Math.min(d.valorParcela || d.valor, d.valor); soma += vp; d.pagas = (d.pagas || 0) + 1; d.valor = arred(d.valor - vp); if (d.prazo) d.prazo = addMesData(d.prazo); }
        d.valorParcela = arred(d.valor / Math.max(1, d.parcelas - d.pagas));
        registrarMovDivida(d, { ...base, valor: soma, modo: 'parcela', parcelas: cfg.qtd, antes });
        return;
    }
    const total = cfg.modo === 'total' || cfg.valor >= d.valor - 0.005, v = total ? d.valor : cfg.valor;
    registrarMovDivida(d, { ...base, valor: v, modo: total ? 'total' : 'parcial', parcelas: total && parc ? restantes : 0, antes });
    if (total) { dados.dividas = dados.dividas.filter(x => x !== d); d.valor = d.valorTotal || v; d.pagas = d.parcelas; d.origem = 'dividas'; d.dataQuitacaoMs = Date.now(); dados.historicoQuitados.push(d); }
    else { d.valor = arred(d.valor - v); if (parc) d.valorParcela = arred(d.valor / Math.max(1, d.parcelas - (d.pagas || 0))); }
}
function estornarMovDivida(id) { // desfaz um pagamento/recebimento do extrato das Dívidas
    const m = dados.movDividas.find(x => x.id === Number(id)); if (!m) return;
    if (!confirm('Estornar ' + (m.tipo === 'eu-devo' ? 'o pagamento' : 'o recebimento') + ' de ' + brl(m.valor) + ' (' + m.nome + ')? A dívida volta ao estado anterior.')) return;
    let d = dados.dividas.find(x => x.id === m.dividaId), daHist = false;
    if (!d) { const i = dados.historicoQuitados.findIndex(x => x.id === m.dividaId); if (i > -1) { d = dados.historicoQuitados.splice(i, 1)[0]; delete d.dataQuitacaoMs; delete d.origem; dados.dividas.push(d); daHist = true; } }
    if (d && d.rec && m.ref) {
        d.rec.pagos = d.rec.pagos || {}; d.rec.parc = d.rec.parc || {};
        if (m.modo === 'parcial') { const atual = d.rec.pagos[m.ref] ? d.valor : (d.rec.parc[m.ref] || 0); delete d.rec.pagos[m.ref]; const novo = arred(atual - m.valor); if (novo > 0.004) d.rec.parc[m.ref] = novo; else delete d.rec.parc[m.ref]; }
        else { delete d.rec.pagos[m.ref]; if (m.antes && m.antes.parc) d.rec.parc[m.ref] = m.antes.parc; }
    } else if (d) {
        if (daHist && m.antes) { d.valor = m.antes.valor; d.pagas = m.antes.pagas; d.prazo = m.antes.prazo; }
        else { d.valor = arred(d.valor + m.valor); if (m.modo === 'parcela' && m.antes) { d.pagas = Math.max(0, (d.pagas || 0) - m.parcelas); d.prazo = m.antes.prazo; } }
        if (d.parcelas > 1) d.valorParcela = arred(d.valor / Math.max(1, d.parcelas - (d.pagas || 0)));
    }
    dados.movDividas = dados.movDividas.filter(x => x.id !== m.id); salvarERender(); avisar('Estornado');
}
function alternarPagamentoRec(id, data) { // toque na data (mantido): marca como paga ou desfaz
    if (!verificarAcesso()) return;
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d || !d.rec) return;
    d.rec.pagos = d.rec.pagos || {}; d.rec.parc = d.rec.parc || {};
    const verbo = d.tipo === 'eu-devo' ? 'pagamento' : 'recebimento';
    if (d.rec.pagos[data]) {
        if (!confirm('Desfazer o ' + verbo + ' do dia ' + dataBR(data) + '?')) return;
        delete d.rec.pagos[data]; delete d.rec.parc[data];
        dados.movDividas = dados.movDividas.filter(m => !(m.dividaId === d.id && m.ref === data));
        salvarERender(); return avisar('Voltou para pendente');
    }
    const oc = ocorrenciasRec(d, data.slice(0, 7)).find(x => x.data === data);
    if (!confirm('Registrar ' + verbo + ' de ' + brl(oc ? oc.restante : d.valor) + ' (' + dataBR(data) + ')?')) return;
    aplicarPagamentoDivida(d, { modo: 'total', refs: [data] }); salvarERender(); avisar(d.tipo === 'eu-devo' ? 'Pagamento registrado' : 'Recebimento registrado');
}

// ---- janela "Confirmar pagamento" ----
let _cp = null;
function abrirConfirmarPagamento(id) {
    if (!verificarAcesso()) return;
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const pend = pendentesDivida(d), rec = d.tipo === 'me-devem';
    if (d.rec && !pend.length) return avisar('Todas as datas deste mês já estão ' + (rec ? 'recebidas' : 'pagas') + '. Troque o mês no topo para ver outras.');
    _cp = { id: d.id, modo: 'total', sel: new Set(pend.length ? [pend[0].ref] : []), pend };
    const formas = ['', 'Pix', 'Dinheiro', 'Transferência', 'Débito', 'Crédito', 'Boleto', 'Outro'].map(f => '<option value="' + f + '">' + (f || 'Não informar') + '</option>').join('');
    modalDin('modalConfirmarPag',
        '<div class="frm-head"><span class="frm-ic"><i class="fas fa-circle-check"></i></span><div class="frm-ht"><h5>' + (rec ? 'Confirmar recebimento' : 'Confirmar pagamento') + '</h5><small>' + escaparHTML(d.nome) + (d.desc ? ' • ' + escaparHTML(d.desc) : '') + '</small></div><button type="button" class="frm-x" data-bs-dismiss="modal" aria-label="Fechar"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="frm-body"><div id="cp-resumo"></div>'
        + '<div class="frm-seg mt-3" id="cp-seg"><button type="button" data-v="total" onclick="cpModo(\'total\')">' + (rec ? 'Recebi tudo' : 'Pagamento total') + '</button><button type="button" data-v="parcial" onclick="cpModo(\'parcial\')">' + (rec ? 'Recebi parte' : 'Pagamento parcial') + '</button></div>'
        + '<div id="cp-lista-wrap"><div class="frm-sec" id="cp-tit-lista">Quais datas?</div><div id="cp-lista"></div></div>'
        + '<label class="frm-l" for="cp-valor">Valor</label><div class="frm-money"><span>R$</span><input type="text" id="cp-valor" class="form-control" inputmode="numeric" placeholder="0,00" oninput="mascaraMoeda(event);cpValida()"></div><small class="frm-hint" id="cp-hint"></small>'
        + '<div class="row g-2"><div class="col-6"><label class="frm-l" for="cp-data">Data ' + (rec ? 'do recebimento' : 'do pagamento') + '</label><input type="date" id="cp-data" class="form-control" value="' + hojeISO() + '"></div><div class="col-6"><label class="frm-l" for="cp-forma">Forma</label><select id="cp-forma" class="form-select">' + formas + '</select></div></div>'
        + '<label class="frm-l" for="cp-obs">Observação</label><input id="cp-obs" class="form-control" placeholder="Opcional"></div>'
        + '<div class="frm-foot"><button type="button" class="frm-cancel" data-bs-dismiss="modal">Cancelar</button><button type="button" class="frm-save" id="cp-ok" onclick="cpConfirmar()"><i class="fas fa-check"></i> Confirmar</button></div>', true).show();
    cpRender();
}
function cpDivida() { return dados.dividas.find(x => x.id === _cp.id); }
function cpTotalSel() { return _cp.pend.filter(p => _cp.sel.has(p.ref)).reduce((a, p) => a + p.falta, 0); }
function cpRender() {
    const d = cpDivida(); if (!d || !_cp) return; const rec = d.tipo === 'me-devem', parcelada = d.parcelas > 1 && !d.rec, tot = d.valorTotal || d.valor;
    const aberto = d.rec ? _cp.pend.reduce((a, p) => a + p.falta, 0) : d.valor, jaPago = d.rec ? 0 : Math.max(0, tot - d.valor);
    document.getElementById('cp-resumo').innerHTML = '<div class="cp-resumo"><div><small>' + (d.rec ? 'Em aberto neste mês' : 'Em aberto') + '</small><b class="' + (rec ? 'text-success' : 'text-danger') + '">' + brl(aberto) + '</b></div>'
        + (jaPago > 0.004 ? '<div class="text-end"><small>Já ' + (rec ? 'recebido' : 'pago') + '</small><b>' + brl(jaPago) + '</b></div>' : '') + '</div>'
        + (jaPago > 0.004 ? '<div class="cp-prog"><div style="width:' + Math.min(100, jaPago / tot * 100) + '%"></div></div>' : '');
    document.querySelectorAll('#cp-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === _cp.modo));
    const mostraLista = _cp.pend.length > 0 && !(parcelada && _cp.modo === 'parcial'), multi = _cp.modo === 'total';
    document.getElementById('cp-lista-wrap').classList.toggle('d-none', !mostraLista);
    document.getElementById('cp-tit-lista').innerText = d.rec ? (multi ? 'Quais datas ' + (rec ? 'você recebeu' : 'você pagou') + '?' : 'Em qual data?') : (multi ? 'Quais parcelas?' : '');
    const hoje = hojeISO(), todas = multi && _cp.pend.length > 1;
    document.getElementById('cp-lista').innerHTML = (todas ? '<div class="cp-row cp-todas' + (_cp.sel.size === _cp.pend.length ? ' on' : '') + '" onclick="cpTodos()"><span class="cp-chk"><i class="fas fa-check"></i></span><span class="cp-info"><b>Todas as pendentes</b><small>' + _cp.pend.length + ' itens • ' + brl(_cp.pend.reduce((a, p) => a + p.falta, 0)) + '</small></span></div>' : '')
        + _cp.pend.map(p => '<div class="cp-row' + (_cp.sel.has(p.ref) ? ' on' : '') + (multi ? '' : ' radio') + '" onclick="cpToggle(\'' + p.ref + '\')"><span class="cp-chk"><i class="fas fa-check"></i></span><span class="cp-info"><b>' + p.rot + '</b><small>' + (p.data ? 'vence ' + dataBR(p.data).slice(0, 5) + (p.data < hoje ? ' • <i class="text-danger-i">atrasada</i>' : '') : '') + (p.parcial > 0 ? ' • já ' + (rec ? 'recebido ' : 'pago ') + brl(p.parcial) : '') + '</small></span><b class="cp-val">' + brl(p.falta) + '</b></div>').join('');
    const inp = document.getElementById('cp-valor');
    if (_cp.modo === 'total') { inp.readOnly = true; inp.value = fmtMoeda(d.rec || parcelada ? cpTotalSel() : d.valor); }
    else { inp.readOnly = false; }
    cpValida();
}
function cpValida() {
    const d = cpDivida(); if (!d || !_cp) return; const ok = document.getElementById('cp-ok'), hint = document.getElementById('cp-hint'), v = lerMoeda('cp-valor');
    let falta = d.valor; if (d.rec) { const p = _cp.pend.find(x => _cp.sel.has(x.ref)); falta = p ? p.falta : 0; }
    let valido;
    if (_cp.modo === 'total') { valido = (d.rec || d.parcelas > 1) ? _cp.sel.size > 0 : true; hint.innerText = valido ? '' : 'Escolha ao menos um item acima.'; }
    else { valido = v > 0.004 && v <= falta + 0.005 && (!d.rec || _cp.sel.size === 1); hint.innerText = d.rec && !_cp.sel.size ? 'Escolha a data.' : 'Falta ' + brl(falta) + (v > falta + 0.005 ? ' • o valor passou do que falta' : (v > 0.004 ? ' • depois: ' + brl(Math.max(0, falta - v)) : '')); }
    ok.disabled = !valido;
}
function cpModo(m) {
    _cp.modo = m; const d = cpDivida();
    if (m === 'parcial') { if (d.rec && _cp.sel.size !== 1) _cp.sel = new Set(_cp.pend.length ? [[..._cp.sel][0] || _cp.pend[0].ref] : []); document.getElementById('cp-valor').value = ''; }
    else if (!_cp.sel.size && _cp.pend.length) _cp.sel = new Set([_cp.pend[0].ref]);
    cpRender();
}
function cpToggle(ref) {
    const d = cpDivida(), idx = _cp.pend.findIndex(p => p.ref === ref), parcelada = d.parcelas > 1 && !d.rec;
    if (_cp.modo === 'parcial') _cp.sel = new Set([ref]);
    else if (parcelada) { const q = (_cp.sel.has(ref) && _cp.sel.size === idx + 1) ? idx : idx + 1; _cp.sel = new Set(_cp.pend.slice(0, q).map(p => p.ref)); } // parcelas pagas em ordem
    else { if (_cp.sel.has(ref)) _cp.sel.delete(ref); else _cp.sel.add(ref); }
    cpRender();
}
function cpTodos() { _cp.sel = _cp.sel.size === _cp.pend.length ? new Set() : new Set(_cp.pend.map(p => p.ref)); cpRender(); }
function cpConfirmar() {
    const d = cpDivida(); if (!d) return; const data = campo('cp-data') || hojeISO(), forma = campo('cp-forma'), obs = campo('cp-obs').trim(), rec = d.tipo === 'me-devem', parcelada = d.parcelas > 1 && !d.rec;
    if (_cp.modo === 'total') aplicarPagamentoDivida(d, { modo: 'total', refs: [..._cp.sel], qtd: _cp.sel.size, data, forma, obs });
    else aplicarPagamentoDivida(d, { modo: 'parcial', refs: [..._cp.sel], valor: lerMoeda('cp-valor'), data, forma, obs });
    salvarERender(); ocultarModal('modalConfirmarPag'); avisar(_cp.modo === 'total' ? (rec ? 'Recebimento confirmado' : 'Pagamento confirmado') : 'Pagamento parcial registrado'); _cp = null;
}

// ---- extrato próprio das Dívidas ----
let modoDividas = 'contas', extDivFiltro = 'todos';
function setModoDividas(m) {
    modoDividas = m; document.getElementById('dv-contas').classList.toggle('d-none', m === 'extrato'); document.getElementById('dv-extrato').classList.toggle('d-none', m !== 'extrato');
    document.querySelectorAll('#dv-modo button').forEach(b => b.classList.toggle('on', b.dataset.v === m)); if (m === 'extrato') renderExtratoDividas();
}
function filtrarExtratoDividas(f) { extDivFiltro = f; document.querySelectorAll('#filtros-ext-div button').forEach(b => b.classList.toggle('active', b.dataset.f === f)); renderExtratoDividas(); }
function _rotMovDiv(m) {
    const rec = m.tipo === 'me-devem', v = rec ? 'Recebimento' : 'Pagamento';
    return m.modo === 'dia' ? v + ' • dia ' + m.ref.slice(8, 10) : m.modo === 'parcial' ? v + ' parcial' : m.modo === 'parcela' ? v + ' de ' + m.parcelas + ' parcela' + (m.parcelas > 1 ? 's' : '') : m.modo === 'total' ? v + ' total' : v;
}
function renderExtratoDividas() {
    const el = document.getElementById('lista-extrato-dividas'); if (!el) return;
    const ym = mesAtual, q = _norm((document.getElementById('busca-ext-div') || {}).value || '');
    const per = dados.movDividas.filter(m => m.data && (diaAtual ? m.data === diaAtual : m.data.startsWith(ym)));
    const rec = per.filter(m => m.tipo === 'me-devem').reduce((a, m) => a + m.valor, 0), pag = per.filter(m => m.tipo === 'eu-devo').reduce((a, m) => a + m.valor, 0);
    document.getElementById('ext-div-rec').innerText = brl(rec); document.getElementById('ext-div-pag').innerText = brl(pag);
    document.getElementById('ext-div-periodo').innerText = diaAtual ? rotuloDia(diaAtual) : MESES_L[+ym.slice(5) - 1] + ' de ' + ym.slice(0, 4);
    let l = per.filter(m => (extDivFiltro === 'todos' || (extDivFiltro === 'rec' ? m.tipo === 'me-devem' : m.tipo === 'eu-devo')) && (!q || _norm(m.nome).includes(q)));
    l.sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || '') || b.id - a.id);
    if (!l.length) { el.innerHTML = '<div class="text-center text-muted py-4 small"><i class="fas fa-receipt fs-3 d-block mb-2 opacity-50"></i>Nenhum pagamento ou recebimento neste período.</div>'; return; }
    let dia = '';
    el.innerHTML = l.map(m => {
        const r = m.tipo === 'me-devem', cab = m.data !== dia ? '<div class="extrato-dia">' + new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase()) + '</div>' : ''; dia = m.data;
        return cab + '<div class="trans dv-mov"><span class="ic-box round" style="background:' + (r ? 'rgba(16,185,129,.14);color:#10b981' : 'rgba(214,40,57,.12);color:#D62839') + '"><i class="fas fa-arrow-' + (r ? 'down' : 'up') + '-long"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(m.nome) + '</b><small>' + _rotMovDiv(m) + (m.forma ? ' • ' + escaparHTML(m.forma) : '') + (m.obs ? ' • ' + escaparHTML(m.obs) : '') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (r ? 'text-success' : 'text-danger') + '">' + (r ? '+' : '-') + brl(m.valor) + '</b><small>' + (m.hora || '') + '</small></div>'
            + '<button type="button" class="av-btn" title="Estornar" aria-label="Estornar" onclick="estornarMovDivida(' + m.id + ')"><i class="fas fa-rotate-left"></i></button></div>';
    }).join('');
}

function toggleDividaRec() {
    const r = marcado('div-rec');
    ['div-rec-wrap'].forEach(i => document.getElementById(i).classList.toggle('d-none', !r));
    ['div-parc-wrap', 'div-datas-wrap'].forEach(i => document.getElementById(i).classList.toggle('d-none', r));
}
function abrirModalDivida(id = null) {
    if (!verificarAcesso()) return;
    const d = id ? dados.dividas.find(x => x.id == id) : null;
    setCampo('div-id-edit', d ? d.id : ''); setCampo('div-tipo', d ? d.tipo : 'eu-devo'); setCampo('div-nome', d ? d.nome : '');
    setCampo('div-valor', d ? fmtMoeda(d.valor) : ''); setCampo('div-parcelas', d ? (d.parcelas || 1) : 1);
    setCampo('div-desc', d && d.desc); setCampo('div-whats', d && d.whats); setCampo('div-inicio', d ? d.inicio : hojeISO()); setCampo('div-prazo', d && d.prazo); setCampo('div-obs', d && d.obs);
    document.getElementById('div-rec').checked = !!(d && d.rec); setCampo('div-dias', d && d.rec ? diasRec(d).join(', ') : ''); toggleDividaRec();
    popularClientes('div-cliente', d && d.clienteId);
    setCampo('div-doc', d && d.doc); setCampo('div-email', d && d.email); setCampo('div-juros', d && d.juros); setCampo('div-forma', d && d.forma);
    setCampo('div-prio', (d && d.prio) || 'normal'); setCampo('div-lembrete', (d && d.lembrete) || 3);
    const x = document.getElementById('div-mais'); if (x) x.open = !!(d && (d.clienteId || d.doc || d.email || d.juros || d.forma || d.prio === 'alta'));
    document.getElementById('modalDividaTitulo').innerText = d ? 'Editar Registro' : 'Novo Registro de Dívida';
    document.getElementById('btn-excluir-divida').classList.toggle('d-none', !d);
    mostrarModal('modalDivida');
}
function preencherDeCliente() {
    const c = clientes().find(x => x.id === Number(campo('div-cliente'))); if (!c) return;
    setCampo('div-nome', c.nome); setCampo('div-whats', c.tel); setCampo('div-doc', c.doc); setCampo('div-email', c.email); setCampo('div-tipo', 'me-devem');
}
function addDivida() {
    if (!verificarAcesso()) return;
    const idEdit = Number(campo('div-id-edit')) || 0, antiga = idEdit ? dados.dividas.find(x => x.id === idEdit) : null;
    const valor = lerMoeda('div-valor'), nome = campo('div-nome');
    if (!nome || valor <= 0) return erro('Por favor, preencha o nome e um valor válido para a dívida.');
    const rec = marcado('div-rec'), dias = [...new Set(campo('div-dias').split(/[^0-9]+/).map(Number).filter(n => n >= 1 && n <= 31))].sort((a, b) => a - b);
    if (rec && !dias.length) return erro('Informe os dias do mês (ex.: 15, 20, 25, 30).');
    const n = rec ? 1 : Math.max(1, Math.min(120, parseInt(campo('div-parcelas')) || 1)), pagas = antiga && !rec ? (antiga.pagas || 0) : 0;
    const d = {
        ...(antiga || {}), id: idEdit || Date.now(), tipo: campo('div-tipo'), nome, valor, desc: campo('div-desc'), whats: campo('div-whats'),
        inicio: campo('div-inicio'), prazo: rec ? '' : campo('div-prazo'), obs: campo('div-obs'), pago: false,
        parcelas: n, pagas, valorTotal: antiga ? (antiga.valorTotal || valor) : valor, valorParcela: arred(valor / Math.max(1, n - pagas)),
        clienteId: Number(campo('div-cliente')) || null, doc: campo('div-doc').trim(), email: campo('div-email').trim(),
        juros: parseFloat(campo('div-juros').replace(',', '.')) || 0, forma: campo('div-forma'), prio: campo('div-prio'), lembrete: parseInt(campo('div-lembrete')) || 3
    };
    if (rec) d.rec = { dias, pagos: (antiga && antiga.rec && antiga.rec.pagos) || {} }; else delete d.rec;
    const idx = dados.dividas.findIndex(x => x.id === d.id);
    if (idx > -1) dados.dividas[idx] = d; else dados.dividas.push(d);
    salvarERender(); ocultarModal('modalDivida'); avisar('Registro salvo');
}
function excluirDivida() {
    const id = Number(campo('div-id-edit')), i = dados.dividas.findIndex(d => d.id === id);
    if (i < 0 || !confirm('Mover este registro para a lixeira?')) return;
    const it = dados.dividas.splice(i, 1)[0];
    it.origem = 'dividas'; it.deletadoEm = new Date().toLocaleDateString('pt-BR');
    dados.lixeira.push(it);
    salvarERender(); ocultarModal('modalDivida'); avisar('Registro enviado para a lixeira');
}

// ---------- filtros ----------
function tratarFiltroEOrdenacao(v) {
    const status = v.startsWith('status-');
    if (status) statusDividaAtual = v.replace('status-', ''); else ordemDividaAtual = v;
    if (status) {
        const sel = document.getElementById('ordenar-divida'); if (sel) sel.value = v;
        document.querySelectorAll('#filtros-rapidos-status .btn-status-filter').forEach(b => { const m = (b.getAttribute('onclick') || '').match(/'([^']+)'/); b.classList.toggle('active', !!m && m[1] === v); });
    }
    renderDividas();
}
function limparFiltrosDivida() {
    buscaDividaAtual = ''; ordemDividaAtual = 'data-recente';
    const b = document.getElementById('busca-divida'); if (b) b.value = '';
    tratarFiltroEOrdenacao('status-todas');
}

// ---------- lista ----------
function renderDividas() {
    const hojeStr = hojeISO(), q = buscaDividaAtual;
    let euDevo = dados.dividas.filter(d => d.tipo === 'eu-devo'), meDevem = dados.dividas.filter(d => d.tipo === 'me-devem');
    if (q) { const casa = d => (d.nome && d.nome.toLowerCase().includes(q)) || (d.desc && d.desc.toLowerCase().includes(q)); euDevo = euDevo.filter(casa); meDevem = meDevem.filter(casa); }
    if (statusDividaAtual === 'pendentes') { const f = d => { const p = prazoEfetivo(d); return !p || p >= hojeStr; }; euDevo = euDevo.filter(f); meDevem = meDevem.filter(f); }
    else if (statusDividaAtual === 'vencidas') { const f = d => { const p = prazoEfetivo(d); return p && p < hojeStr; }; euDevo = euDevo.filter(f); meDevem = meDevem.filter(f); }
    const ordenar = lista => lista.sort((a, b) => {
        if (ordemDividaAtual === 'data-recente') return new Date(prazoEfetivo(b) || b.inicio) - new Date(prazoEfetivo(a) || a.inicio);
        if (ordemDividaAtual === 'data-antiga') return new Date(prazoEfetivo(a) || a.inicio) - new Date(prazoEfetivo(b) || b.inicio);
        if (ordemDividaAtual === 'alfa-crescente') return (a.nome || '').localeCompare(b.nome || '');
        if (ordemDividaAtual === 'alfa-decrescente') return (b.nome || '').localeCompare(a.nome || '');
        return 0;
    });
    euDevo = ordenar(euDevo); meDevem = ordenar(meDevem);
    document.getElementById('total-eu-devo').innerText = brl(euDevo.reduce((a, b) => a + valorAbertoDivida(b), 0));
    document.getElementById('total-me-devem').innerText = brl(meDevem.reduce((a, b) => a + valorAbertoDivida(b), 0));
    const recChips = d => '<div class="rec-chips">' + ocorrenciasRec(d, mesAtual).map(o => {
        const atras = !o.pago && o.data < hojeStr, cls = o.pago ? 'ok' : o.parcial > 0 ? 'parc' : atras ? 'atr' : '';
        return '<button type="button" class="rec-chip ' + cls + '" onclick="alternarPagamentoRec(' + d.id + ',\'' + o.data + '\')">' + (o.pago ? '<i class="fas fa-check"></i> ' : '') + 'Dia ' + o.data.substring(8, 10) + (o.parcial > 0 ? ' • parcial' : '') + '</button>';
    }).join('') + '</div>';
    const linhaDet = (ic, t, v) => '<div class="dv-linha"><span><i class="' + ic + '"></i> ' + t + '</span><b>' + v + '</b></div>';
    const item = d => {
        const pz = prazoEfetivo(d), venc = pz && pz < hojeStr, hoje = pz === hojeStr, parc = d.parcelas > 1 && !d.rec, pagar = d.tipo === 'eu-devo';
        const st = !pz ? '' : venc ? '<span class="chip-st st-venc">Vencida</span>' : hoje ? '<span class="chip-st st-hoje">Vence hoje</span>' : '';
        const aberto = _dividasAbertas.has(d.id) ? ' aberto' : '';
        const badge = d.rec ? 'Fixa' : parc ? ((d.pagas || 0) + 1) + '/' + d.parcelas : '';
        const det = (d.rec ? linhaDet('fas fa-rotate', 'Repete', 'Todo mês, dias ' + diasRec(d).join(', ')) + '<div class="dv-sub">' + (pagar ? 'Datas a pagar' : 'Datas a receber') + ' (toque para marcar)</div>' + recChips(d) : (d.inicio ? linhaDet('far fa-calendar', 'Data de início', dataBR(d.inicio)) : '') + linhaDet('far fa-flag', 'Prazo', pz ? dataBR(pz) : 'Sem prazo'))
            + (parc ? linhaDet('fas fa-layer-group', 'Parcela', ((d.pagas || 0) + 1) + ' de ' + d.parcelas + ' • ' + brl(d.valorParcela || 0) + '/parcela') : '')
            + (d.juros ? linhaDet('fas fa-percent', 'Juros', d.juros + '%/mês') : '') + (d.forma ? linhaDet('fas fa-wallet', 'Forma', escaparHTML(d.forma)) : '')
            + (d.prio === 'alta' ? '<span class="chip-st st-venc">Prioridade alta</span> ' : '') + st
            + progressoDivida(d, pagar) + historicoDaDivida(d, pagar)
            + '<div class="dv-acoes"><button type="button" class="btn-confirmar" onclick="abrirConfirmarPagamento(' + d.id + ')"><i class="fas fa-circle-check me-1"></i>' + (pagar ? 'Confirmar pagamento' : 'Confirmar recebimento') + '</button>' + (d.tipo === 'me-devem' ? '<button type="button" class="btn-cobrar" onclick="cobrarDividaWA(' + d.id + ')"><i class="fab fa-whatsapp me-1"></i>Cobrar</button>' : '') + '</div>'
            + '<div class="dv-desc"><b>Descrição</b><div>' + (d.desc ? escaparHTML(d.desc) : '<span class="text-muted">Sem descrição</span>') + '</div></div>'
            + (d.obs ? '<details class="div-hist"><summary>Histórico</summary><div>' + escaparHTML(d.obs) + '</div></details>' : '');
        return `<div class="div-item dv-compacto${aberto}" data-id="${d.id}" onclick="toggleDivida(event, ${d.id})">
            <div class="dv-l1">
                <i class="fas fa-chevron-down cc-seta"></i>
                <span class="div-av ${pagar ? 'pagar' : 'receber'}">${escaparHTML((d.nome || '?').trim().charAt(0).toUpperCase())}</span>
                <b class="dv-nome">${escaparHTML(d.nome)}</b>
                <span class="div-val ${pagar ? 'text-danger' : 'text-success'} money-value">${brl(d.valor)}</span>
                ${badge ? '<span class="cc-badge">' + badge + '</span>' : ''}
                <div class="dropdown">
                    <button class="btn btn-link" data-bs-toggle="dropdown" aria-label="Opções"><i class="fas fa-ellipsis-vertical"></i></button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        <li><button class="dropdown-item py-2" onclick="abrirConfirmarPagamento(${d.id})"><i class="fas fa-circle-check me-2"></i>${pagar ? 'Confirmar pagamento' : 'Confirmar recebimento'}</button></li>
                        ${d.tipo === 'me-devem' ? `<li><button class="dropdown-item py-2" onclick="cobrarDividaWA(${d.id})"><i class="fab fa-whatsapp me-2"></i>Cobrar no WhatsApp</button></li>` : ''}
                        <li><button class="dropdown-item py-2" onclick="abrirModalDivida(${d.id})"><i class="fas fa-pen me-2"></i>Editar</button></li>
                        ${pz ? `<li><button class="dropdown-item py-2" onclick="eventoCalendarioDivida(${d.id})"><i class="far fa-calendar-plus me-2"></i>Adicionar ao calendário</button></li>` : ''}
                    </ul>
                </div>
            </div>
            <div class="dv-det">${det}</div>
        </div>`;
    };
    document.getElementById('lista-eu-devo').innerHTML = euDevo.map(item).join('') || '<p class="text-center small py-3">Sem dívidas registradas.</p>';
    document.getElementById('lista-me-devem').innerHTML = meDevem.map(item).join('') || '<p class="text-center small py-3">Sem valores a receber.</p>';
    renderizarHistoricoDividas(); renderExtratoDividas();
}

// ---------- pagamentos de dívidas ----------
function prepararPagamento(id, modo) {
    const div = dados.dividas.find(d => d.id == id); if (!div) return;
    setCampo('pag-id', id); setCampo('pag-modo', modo); setCampo('pag-data', hojeISO());
    document.getElementById('tituloPagamento').innerText = modo === 'total' ? 'Pagamento Total' : 'Pagamento Parcial';
    setCampo('pag-valor', modo === 'total' ? fmtMoeda(div.valor) : '');
    document.getElementById('area-valor-pag').classList.toggle('d-none', modo === 'total');
    document.getElementById('pag-extrato-wrap').classList.remove('d-none');
    mostrarModal('modalPagamento');
}
function confirmarPagamento() {
    const id = Number(campo('pag-id')), modo = campo('pag-modo'), dataRaw = campo('pag-data'), valor = lerMoeda('pag-valor');
    if (!dataRaw) return erro('Selecione a data!');
    const dataBr = dataBR(dataRaw), hora = horaAgora();
    // --- compra de cartão ---
    if (modo.includes('-cartao')) {
        const card = cartaoAtual(), c = card && card.compras.find(x => x.id === id); if (!c) return;
        const ym = campo('pag-ym') || parcelaAlvo(card, c, ymFat(card, mesAtual)), falta = Math.max(0, _valParcela(c) - _pagoNaParcela(c, ym));
        const v = modo === 'total-cartao' ? falta : valor; // total = o que falta DESTA parcela
        if (v <= 0.004) return erro(modo === 'total-cartao' ? 'Esta parcela já está paga.' : 'Informe um valor maior que zero.');
        if (v > falta + 0.005) return erro('O valor é maior que o que falta desta parcela (' + brl(falta) + ').');
        (c.pagamentos = c.pagamentos || []).push({ valor: arred(v), data: dataBr, hora, ym });
        salvarERender(); ocultarModal('modalPagamento'); avisar(v >= falta - 0.005 ? 'Parcela paga' : 'Pagamento parcial registrado'); return;
    }
    // --- dívida ---
    const idx = dados.dividas.findIndex(d => d.id === id); if (idx < 0) return;
    const div = dados.dividas[idx], quer = marcado('pag-extrato');
    let total = modo === 'total';
    if (modo === 'parcial') {
        if (valor <= 0) return erro('Informe um valor maior que zero.');
        if (valor > div.valor + 0.005) return erro('Valor inválido!');
        if (valor >= div.valor - 0.005) total = true; // pagou tudo = quitada (antes ficava com saldo 0 para sempre)
    }
    const pago = total ? div.valor : valor;
    if (total) {
        dados.dividas.splice(idx, 1);
        div.origem = 'dividas'; div.dataQuitacaoMs = Date.now();
        div.obs = (div.obs || '') + '\n- QUITADO TOTAL (' + brl(div.valor) + ') em ' + dataBr + ' às ' + hora;
        dados.historicoQuitados.push(div);
    } else {
        div.valor = arred(div.valor - valor);
        div.obs = (div.obs || '') + '\n→ Pago: ' + brl(valor) + ' (' + dataBr + ' às ' + hora + ')';
    }
    if (pago > 0) lancarDividaNoExtrato(div, pago, false);
    salvarERender(); ocultarModal('modalPagamento'); avisar(total ? 'Dívida quitada e adicionada ao histórico!' : 'Pagamento parcial registrado!');
}
function lancarDividaNoExtrato(d, v, renderizar = true) { // agora registra no extrato próprio das Dívidas (não no extrato geral)
    registrarMovDivida(d, { valor: v, modo: 'pagamento', data: hojeISO() });
    if (renderizar) salvarERender();
}
function pagarParcelaDivida(id) {
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const n = (d.pagas || 0) + 1, vp = Math.min(d.valorParcela || d.valor, d.valor), ultima = n >= d.parcelas || vp >= d.valor - 0.005;
    if (!confirm('Registrar o pagamento da parcela ' + n + '/' + d.parcelas + ' (' + brl(vp) + ')?')) return;
    const noExtrato = confirm('Lançar esta parcela no extrato?'), copia = { ...d };
    d.obs = (d.obs || '') + '\n→ Parcela ' + n + '/' + d.parcelas + ' paga: ' + brl(vp) + ' (' + new Date().toLocaleDateString('pt-BR') + ')';
    d.pagas = n;
    if (ultima) {
        dados.dividas = dados.dividas.filter(x => x !== d);
        d.valor = d.valorTotal || vp; d.origem = 'dividas'; d.dataQuitacaoMs = Date.now(); dados.historicoQuitados.push(d);
    } else { d.valor = arred(d.valor - vp); if (d.prazo) d.prazo = addMesData(d.prazo); }
    if (noExtrato) lancarDividaNoExtrato(copia, vp, false);
    salvarERender(); avisar('Parcela paga');
}

// ---------- histórico de quitadas (30 dias) ----------
function limparHistoricoAntigo() { // remove do histórico o que foi quitado há mais de 30 dias
    const lim = 30 * 24 * 60 * 60 * 1000, agora = Date.now(), antes = dados.historicoQuitados.length;
    dados.historicoQuitados = dados.historicoQuitados.filter(i => !i.dataQuitacaoMs || (agora - i.dataQuitacaoMs) < lim);
    if (dados.historicoQuitados.length !== antes) salvarERender();
}
function renderizarHistoricoDividas() {
    const lista = document.getElementById('lista-historico-dividas'); if (!lista) return;
    if (!dados.historicoQuitados.length) { lista.innerHTML = '<div class="text-center text-muted py-3">Nenhuma dívida quitada nos últimos 30 dias.</div>'; return; }
    lista.innerHTML = [...dados.historicoQuitados].reverse().map(item => {
        const eu = item.tipo === 'eu-devo', data = item.dataQuitacaoMs ? new Date(item.dataQuitacaoMs).toLocaleDateString('pt-BR') : '---';
        return `<div class="card-mov p-3 mb-2"><div class="d-flex justify-content-between align-items-center w-100">
            <div><span class="badge ${eu ? 'bg-danger' : 'bg-success'} mb-1">${eu ? 'Eu devia' : 'Me deviam'}</span>
                <h6 class="mb-0 fw-bold text-main">${escaparHTML(item.nome || item.desc || 'Sem nome')}</h6>
                <small class="text-muted d-block" style="font-size:.75rem">Quitado em: ${data}</small></div>
            <div class="text-end d-flex align-items-center gap-3"><span class="fw-bold money-value text-muted">${brl(item.valor)}</span>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="excluirItemHistoricoManual(${item.id})" title="Mover para a lixeira"><i class="fas fa-trash-alt"></i></button></div>
        </div></div>`;
    }).join('');
}
function excluirItemHistoricoManual(id) {
    if (!confirm('Deseja mover este registro do histórico para a lixeira?')) return;
    const idx = dados.historicoQuitados.findIndex(i => i.id === Number(id)); if (idx < 0) return;
    const item = dados.historicoQuitados.splice(idx, 1)[0];
    item.origem = 'historicoQuitados'; item.deletadoEm = new Date().toLocaleDateString('pt-BR'); item.lixeiraTitulo = 'Quitada: ' + (item.nome || 'Dívida');
    dados.lixeira.push(item); salvarERender();
}

/* ===================================================================
   9. METAS DE POUPANÇA
   =================================================================== */
function salvarMeta() {
    if (!verificarAcesso()) return;
    const nome = campo('meta-nome').trim(), objetivo = lerMoeda('meta-objetivo'), inicio = campo('meta-data-inicio'), fim = campo('meta-data-fim');
    if (!nome || objetivo <= 0 || !inicio || !fim) return erro('Preencha todos os campos da meta corretamente!');
    if (fim < inicio) return erro('A data alvo não pode ser anterior à data de início.');
    dados.metas.push({ id: Date.now(), nome, objetivo, guardado: 0, inicio, fim, historico: [] });
    ['meta-nome', 'meta-objetivo', 'meta-data-inicio', 'meta-data-fim'].forEach(i => setCampo(i, ''));
    salvarERender(); ocultarModal('modalMeta'); avisar('Meta salva');
}
function renderMetas() {
    const lista = document.getElementById('lista-metas'); if (!lista) return;
    lista.innerHTML = dados.metas.length ? dados.metas.map(m => {
        const perc = Math.min((m.guardado / m.objetivo) * 100, 100).toFixed(0);
        return `<div class="col-12 col-md-6 mb-3"><div class="card p-3 border-0 shadow-sm rounded-4 bg-white">
            <div class="d-flex justify-content-between align-items-start mb-2"><div><h6 class="fw-bold text-dark mb-0">${escaparHTML(m.nome)}</h6>
                <small class="text-muted" style="font-size:.75rem">${dataBR(m.inicio)} até ${dataBR(m.fim)}</small></div><span class="badge bg-purple text-white">${perc}%</span></div>
            <div class="d-flex justify-content-between my-2" style="font-size:.85rem"><span class="text-muted">Acumulado: <b class="text-success">${brl(m.guardado)}</b></span><span class="text-muted">Alvo: <b>${brl(m.objetivo)}</b></span></div>
            <div class="progress mb-2" style="height:10px;border-radius:10px"><div class="progress-bar bg-success" role="progressbar" style="width:${perc}%;border-radius:10px"></div></div>
            ${m.historico && m.historico.length ? `<div class="mt-2 mb-3 p-2 bg-light rounded-3 border-start border-purple border-3 shadow-sm" style="font-size:.75rem;max-height:100px;overflow-y:auto">
                <div class="text-uppercase fw-bold text-muted mb-1" style="font-size:.65rem">Histórico da Meta:</div>
                ${m.historico.map((h, i) => `<div class="text-dark d-flex justify-content-between align-items-center py-1 border-bottom-dashed">
                    <span>${h.tipo === 'poupar' ? '<i class="fas fa-arrow-down text-success me-1"></i>Guardou' : '<i class="fas fa-arrow-up text-danger me-1"></i>Retirou'}: ${brl(h.valor)}</span>
                    <div class="d-flex align-items-center gap-2"><span class="text-muted" style="font-size:.7rem">${escaparHTML(h.data)} às ${escaparHTML(h.hora)}</span>
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="excluirHistoricoMeta(${m.id}, ${i})" style="font-size:.85rem;line-height:1">&times;</button></div></div>`).reverse().join('')}
            </div>` : '<div class="text-muted text-center my-2" style="font-size:.75rem">Nenhum depósito realizado.</div>'}
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-success flex-grow-1" onclick="movimentarMeta(${m.id}, 'poupar')"><i class="fas fa-piggy-bank me-1"></i> Poupar</button>
                <button class="btn btn-sm btn-outline-warning flex-grow-1" onclick="movimentarMeta(${m.id}, 'resgatar')"><i class="fas fa-hand-holding-usd me-1"></i> Resgatar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirMeta(${m.id})"><i class="fas fa-trash"></i></button>
            </div></div></div>`;
    }).join('') : '<p class="text-center text-muted py-4 w-100">Nenhuma meta cadastrada ainda.</p>';
}
function movimentarMeta(id, acao) { // o valor guardado NÃO sai do extrato (fica só no histórico da meta)
    if (!verificarAcesso()) return;
    const meta = dados.metas.find(m => m.id == id); if (!meta) return;
    const txt = prompt(acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?'); if (!txt) return;
    const valor = parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return erro('Valor inválido!');
    if (acao !== 'poupar' && valor > meta.guardado) return erro('Saldo insuficiente na meta para resgate!');
    meta.guardado = arred(meta.guardado + (acao === 'poupar' ? valor : -valor));
    (meta.historico = meta.historico || []).push({ tipo: acao, valor, data: new Date().toLocaleDateString('pt-BR'), hora: horaAgora() });
    salvarERender(); avisar('Movimentação da meta registrada');
}
function excluirHistoricoMeta(metaId, index) {
    if (!confirm('Tem certeza que deseja apagar este registro do histórico? O saldo da meta será corrigido automaticamente.')) return;
    const meta = dados.metas.find(m => m.id === metaId); if (!meta || !meta.historico || !meta.historico[index]) return;
    const h = meta.historico[index];
    meta.guardado = arred(meta.guardado + (h.tipo === 'poupar' ? -h.valor : h.valor));
    meta.historico.splice(index, 1);
    if (h.idMovimento) dados.movs = dados.movs.filter(m => m.id !== h.idMovimento); // registros antigos geravam lançamento no extrato
    salvarERender();
}
function excluirMeta(id) {
    if (!confirm('Deseja realmente excluir esta meta? O valor guardado não será devolvido automaticamente ao saldo geral.')) return;
    dados.metas = dados.metas.filter(m => m.id !== Number(id)); salvarERender();
}

/* ===================================================================
   10. NOTAS
   =================================================================== */
function abrirModalNota(id = null) {
    if (!verificarAcesso()) return;
    const nota = id ? notas.find(n => n.id === id) : null;
    setCampo('nota-id-edit', id || ''); setCampo('nota-titulo', nota ? nota.titulo : ''); setCampo('nota-texto', nota ? nota.texto : '');
    setCampo('nota-fixada', nota ? String(nota.fixada) : 'false');
    selecionarCorNota(nota ? nota.cor : '#ffffff'); setCampo('nota-cor-custom', nota ? nota.cor : '#ffffff');
    document.getElementById('btn-fixar-nota').classList.toggle('active', !!(nota && nota.fixada));
    document.getElementById('modalNotaTitulo').innerText = id ? 'Editar Nota' : 'Nova Nota';
    document.getElementById('btn-excluir-nota').classList.toggle('d-none', !id);
    document.getElementById('btn-copiar-nota').classList.toggle('d-none', !id);
    mostrarModal('modalNota');
}
function selecionarCorNota(cor) { setCampo('nota-cor-fundo', cor); document.getElementById('cor-fundo-modal-nota').style.backgroundColor = cor; }
function toggleFixarNota() {
    const fixa = campo('nota-fixada') === 'true';
    setCampo('nota-fixada', fixa ? 'false' : 'true'); document.getElementById('btn-fixar-nota').classList.toggle('active');
}
function salvarNota() {
    if (!verificarAcesso()) return;
    const id = campo('nota-id-edit'), titulo = campo('nota-titulo').trim(), texto = campo('nota-texto').trim(), cor = campo('nota-cor-fundo'), fixada = campo('nota-fixada') === 'true';
    if (!titulo && !texto) return; // não salva nota vazia
    const i = id ? notas.findIndex(n => n.id == id) : -1;
    if (i > -1) notas[i] = { ...notas[i], titulo, texto, cor, fixada };
    else notas.push({ id: Date.now(), titulo, texto, cor, fixada, data: new Date().toISOString() });
    persistirNotas(); ocultarModal('modalNota'); renderizarNotas(); avisar('Nota salva');
}
function renderizarNotas() {
    const listaGeral = document.getElementById('lista-notas'), listaFixadas = document.getElementById('lista-notas-fixadas'), contFix = document.getElementById('container-notas-fixadas'), tituloOutras = document.getElementById('titulo-outras-notas'), vazio = document.getElementById('notas-vazio');
    if (!listaGeral || !listaFixadas || !vazio || !contFix) return;
    listaGeral.innerHTML = ''; listaFixadas.innerHTML = '';
    if (!notas.length) { vazio.classList.remove('d-none'); contFix.classList.add('d-none'); return; }
    vazio.classList.add('d-none');
    const fixadas = notas.filter(n => n.fixada), normais = notas.filter(n => !n.fixada);
    contFix.classList.toggle('d-none', !fixadas.length);
    tituloOutras.classList.toggle('d-none', !fixadas.length || !normais.length);
    const card = nota => `
        <div class="col-6 col-md-4 mb-3"><div class="nota-card shadow-sm position-relative text-start" style="background-color:${escaparHTML(nota.cor)};min-height:120px;border-radius:15px;overflow:hidden">
            <div class="dropdown position-absolute top-0 end-0 m-2" style="z-index:10">
                <button class="btn btn-link text-muted p-1 lh-1 border-0 shadow-none" data-bs-toggle="dropdown" aria-expanded="false"><i class="fas fa-ellipsis-v" style="font-size:.9rem"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size:.85rem">
                    <li><button class="dropdown-item py-2" onclick="copiarNotaRapida(${nota.id})"><i class="fas fa-copy text-secondary me-2"></i> Copiar Texto</button></li>
                    <li><button class="dropdown-item py-2 text-danger" onclick="event.stopPropagation(); excluirNotaDireta(${nota.id})"><i class="fas fa-trash-alt me-2"></i> Excluir Nota</button></li>
                </ul></div>
            <div onclick="abrirModalNota(${nota.id})" class="w-100 p-3 pt-4" style="cursor:pointer;min-height:120px">
                ${nota.fixada ? '<i class="fas fa-thumbtack pin-icon mb-1 d-block text-muted" style="font-size:.8rem"></i>' : ''}
                <div class="nota-titulo-card fw-bold text-dark text-truncate pe-3" style="font-size:.95rem;line-height:1.2">${escaparHTML(nota.titulo || 'Sem título')}</div>
                <div class="nota-resumo-card text-muted mt-1 small text-wrap text-break pe-2" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escaparHTML(nota.texto || '')}</div>
            </div></div></div>`;
    listaFixadas.innerHTML = fixadas.map(card).join(''); listaGeral.innerHTML = normais.map(card).join('');
}
function excluirNota() {
    if (!confirm('Deseja excluir esta nota permanentemente?')) return;
    const id = campo('nota-id-edit');
    notas = notas.filter(n => n.id != id); persistirNotas(); ocultarModal('modalNota'); renderizarNotas(); avisar('Nota excluída');
}
function excluirNotaDireta(id) {
    if (!confirm('Deseja excluir esta nota permanentemente?')) return;
    notas = notas.filter(n => n.id != id); persistirNotas(); renderizarNotas(); avisar('Nota excluída');
}
function copiarTexto(t) { return navigator.clipboard.writeText(t).then(() => avisar('Texto copiado para a área de transferência!')).catch(() => erro('Não foi possível copiar.')); }
function copiarNota() { copiarTexto(campo('nota-texto')); }
function copiarNotaRapida(id) {
    const nota = notas.find(n => n.id == id);
    if (!nota || !nota.texto) return erro('Esta nota não possui texto para copiar.');
    copiarTexto(nota.texto);
}

/* ===================================================================
   11. CLIENTES
   =================================================================== */
function clientes() { return dados.clientes || (dados.clientes = []); }
let _cliFiltro = 'todos';
function resumoCliente(c) {
    const movs = dados.movs.filter(m => m.clienteId === c.id), ent = movs.filter(m => m.tipo === 'entrada'), hoje = hojeISO();
    const abertas = dados.dividas.filter(d => d.clienteId === c.id && d.tipo === 'me-devem'), rec = ent.reduce((s, m) => s + m.valor, 0);
    return { movs, abertas, recebido: rec, aberto: abertas.reduce((s, d) => s + d.valor, 0), vencido: abertas.filter(d => d.prazo && d.prazo < hoje).reduce((s, d) => s + d.valor, 0), ticket: ent.length ? rec / ent.length : 0, ultimo: ent.map(m => m.data).sort().pop() || '' };
}
function niverMes(c) { return c.nasc && c.nasc.substring(5, 7) === hojeISO().substring(5, 7); }
function setCliFiltro(f) { _cliFiltro = f; renderClientes(); }
function renderClientes() {
    const L = document.getElementById('lista-clientes'); if (!L) return; const q = (campo('busca-cliente') || '').toLowerCase(), C = clientes();
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
function abrirModalCliente(id) {
    if (!verificarAcesso()) return; const c = id ? clientes().find(x => x.id === Number(id)) : {}, val = k => escaparHTML(c[k] || '');
    const o = (arr, v) => arr.map(([k, t]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + t + '</option>').join('');
    const f = (rot, idc, k, ph = '', tp = 'text') => '<label class="frm-l" for="cli-' + idc + '">' + rot + '</label><input type="' + tp + '" id="cli-' + idc + '" class="form-control" placeholder="' + ph + '" value="' + val(k) + '">';
    modalDin('modalCliente',
        '<div class="frm-head"><span class="frm-ic"><i class="fas fa-user"></i></span><div class="frm-ht"><h5>' + (id ? 'Editar cliente' : 'Novo cliente') + '</h5><small>Cadastro para vendas e cobranças</small></div><button type="button" class="frm-x" data-bs-dismiss="modal" aria-label="Fechar"><i class="fas fa-xmark"></i></button></div>'
        + '<div class="frm-body">'
        + '<div class="frm-seg" data-for="cli-tipo"></div><select id="cli-tipo" class="d-none">' + o([['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']], c.tipo || 'PF') + '</select>'
        + f('Nome / Razão social *', 'nome', 'nome', 'Nome completo') + f('WhatsApp / Telefone', 'tel', 'tel', 'DDD + número', 'tel') + f('E-mail', 'email', 'email', 'nome@email.com', 'email')
        + '<div class="row g-2"><div class="col-7"><label class="frm-l" for="cli-doc">CPF / CNPJ</label><input id="cli-doc" class="form-control" placeholder="000.000.000-00" value="' + val('doc') + '"></div><div class="col-5"><label class="frm-l" for="cli-status">Status</label><select id="cli-status" class="form-select">' + o([['ativo', 'Ativo'], ['lead', 'Lead'], ['inativo', 'Inativo']], c.status || 'ativo') + '</select></div></div>'
        + '<details class="mais-det"><summary>Endereço</summary><div class="mais-in"><div class="row g-2"><div class="col-5"><label class="frm-l" for="cli-cep">CEP</label><input id="cli-cep" class="form-control" inputmode="numeric" value="' + val('cep') + '"></div><div class="col-7"><label class="frm-l" for="cli-cidade">Cidade / UF</label><input id="cli-cidade" class="form-control" value="' + val('cidade') + '"></div></div>' + f('Endereço', 'end', 'endereco', 'Rua, número, bairro') + '</div></details>'
        + '<details class="mais-det"><summary>Mais informações</summary><div class="mais-in"><div class="row g-2"><div class="col-6"><label class="frm-l" for="cli-nasc">Aniversário</label><input type="date" id="cli-nasc" class="form-control" value="' + val('nasc') + '"></div><div class="col-6"><label class="frm-l" for="cli-origem">Como chegou</label><select id="cli-origem" class="form-select">' + o([['', 'Não informar'], ['Indicação', 'Indicação'], ['Instagram', 'Instagram'], ['WhatsApp', 'WhatsApp'], ['Site', 'Site'], ['Presencial', 'Presencial'], ['Outro', 'Outro']], c.canal || '') + '</select></div></div>'
        + f('Segmento', 'seg', 'segmento', 'Ex: Revenda, Serviço, Atacado') + f('Tags', 'tags', 'tags', 'vip, parcelado') + '<label class="frm-l" for="cli-obs">Observações</label><textarea id="cli-obs" class="form-control" rows="2">' + val('obs') + '</textarea></div></details>'
        + '</div><div class="frm-foot">' + (id ? '<button class="frm-del" onclick="excluirCliente(' + Number(id) + ')" aria-label="Excluir"><i class="fas fa-trash"></i></button>' : '') + '<button class="frm-save" onclick="salvarCliente(' + (id ? Number(id) : 0) + ')"><i class="fas fa-check"></i> Salvar cliente</button></div>', true).show();
}
function salvarCliente(id) {
    const nome = campo('cli-nome').trim(); if (!nome) return erro('Informe o nome do cliente.');
    const ant = id ? clientes().find(x => x.id === id) : null, c = { id: id || Date.now(), nome, tipo: campo('cli-tipo'), status: campo('cli-status'), doc: campo('cli-doc').trim(), tel: campo('cli-tel').trim(), email: campo('cli-email').trim(), cep: campo('cli-cep').trim(), cidade: campo('cli-cidade').trim(), endereco: campo('cli-end').trim(), nasc: campo('cli-nasc'), canal: campo('cli-origem'), segmento: campo('cli-seg').trim(), tags: campo('cli-tags').trim(), obs: campo('cli-obs').trim(), criado: ant ? ant.criado : hojeISO(), interacoes: ant ? ant.interacoes || [] : [] };
    const i = clientes().findIndex(x => x.id === c.id); if (i > -1) clientes()[i] = c; else clientes().push(c);
    salvarERender(); ocultarModal('modalCliente'); avisar('Cliente salvo');
}
function excluirCliente(id) {
    const i = clientes().findIndex(x => x.id === id); if (i < 0 || !confirm('Mover este cliente para a lixeira? Os lançamentos e dívidas continuam, mas deixam de estar ligados a ele.')) return;
    const c = clientes().splice(i, 1)[0]; c.origem = 'clientes'; c.deletadoEm = new Date().toLocaleDateString('pt-BR'); c.lixeiraTitulo = 'Cliente: ' + c.nome; dados.lixeira.push(c); salvarERender(); ocultarModal('modalCliente'); ocultarModal('modalClienteDet'); avisar('Cliente enviado para a lixeira');
}
function verCliente(id) {
    const c = clientes().find(x => x.id === Number(id)); if (!c) return; const r = resumoCliente(c), wa = soDigitos(c.tel), waN = wa.length <= 11 ? '55' + wa : wa, hoje = hojeISO();
    const tile = (t, v, cls = '') => '<div class="home-tile"><div><small>' + t + '</small><b class="money-value ' + cls + '">' + v + '</b></div></div>', lin = (ic, t) => t ? '<div class="cli-lin"><i class="fas ' + ic + '"></i><span>' + escaparHTML(t) + '</span></div>' : '';
    const tags = (c.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '<span class="chip-st st-inativo">' + escaparHTML(t) + '</span>').join(' ');
    modalDin('modalClienteDet', '<div class="modal-body p-4"><div class="d-flex align-items-center gap-3 mb-3"><span class="div-av receber" style="width:52px;height:52px;flex:0 0 52px;font-size:1.3rem">' + escaparHTML(c.nome.trim().charAt(0).toUpperCase()) + '</span><div class="flex-grow-1 min-w-0"><h5 class="fw-bold mb-0">' + escaparHTML(c.nome) + '</h5><small class="text-muted">' + (c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') + ' • cliente desde ' + dataBR(c.criado) + '</small></div><button class="div-icon-btn" onclick="ocultarModal(\'modalClienteDet\');abrirModalCliente(' + c.id + ')" title="Editar"><i class="fas fa-pen"></i></button></div>'
        + '<div class="d-flex gap-2 mb-3">' + (wa ? '<a class="btn btn-sm btn-outline-primary flex-fill" target="_blank" href="https://wa.me/' + waN + '"><i class="fab fa-whatsapp me-1"></i>WhatsApp</a><a class="btn btn-sm btn-outline-primary flex-fill" href="tel:' + wa + '"><i class="fas fa-phone me-1"></i>Ligar</a>' : '') + (c.email ? '<a class="btn btn-sm btn-outline-primary flex-fill" href="mailto:' + escaparHTML(c.email) + '"><i class="fas fa-envelope me-1"></i>E-mail</a>' : '') + '</div>'
        + '<div class="home-tiles" style="margin-bottom:12px">' + tile('Total recebido', brl(r.recebido), 'text-success') + tile('Em aberto', brl(r.aberto), r.aberto > 0 ? 'text-danger' : '') + tile('Vencido', brl(r.vencido), r.vencido > 0 ? 'text-danger' : '') + tile('Ticket médio', brl(r.ticket)) + '</div>'
        + '<div class="d-flex gap-2 mb-3"><button class="btn btn-primary btn-sm flex-fill" onclick="novoLancCliente(' + c.id + ')"><i class="fas fa-plus me-1"></i>Novo lançamento</button><button class="btn btn-outline-primary btn-sm flex-fill" onclick="novaCobranca(' + c.id + ')"><i class="fas fa-file-invoice-dollar me-1"></i>Nova cobrança</button></div>'
        + '<div class="mb-3">' + lin('fa-id-card', c.doc) + lin('fa-phone', c.tel) + lin('fa-envelope', c.email) + lin('fa-location-dot', [c.endereco, c.cidade, c.cep].filter(Boolean).join(' • ')) + lin('fa-cake-candles', c.nasc ? 'Aniversário: ' + dataBR(c.nasc).substring(0, 5) : '') + lin('fa-bullseye', c.canal ? 'Origem: ' + c.canal : '') + lin('fa-briefcase', c.segmento) + (tags ? '<div class="mt-2">' + tags + '</div>' : '') + (c.obs ? '<div class="cli-obs">' + escaparHTML(c.obs) + '</div>' : '') + '</div>'
        + '<h6 class="fw-bold small text-uppercase text-muted">Cobranças em aberto</h6>' + (r.abertas.map(d => '<div class="div-item mb-2"><div class="div-mid"><b>' + escaparHTML(d.desc || d.nome) + '</b><small>' + (d.prazo ? 'Vence ' + dataBR(d.prazo) : 'Sem prazo') + ((d.parcelas || 1) > 1 ? ' • Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : '') + '</small>' + (d.prazo && d.prazo < hoje ? '<span class="chip-st st-venc">Vencida</span>' : '') + '</div><div class="div-val money-value">' + brl(d.valor) + '</div><button class="btn btn-sm btn-outline-success" onclick="ocultarModal(\'modalClienteDet\');prepararPagamento(' + d.id + ',\'total\')">Receber</button></div>').join('') || '<p class="small text-muted">Nada em aberto.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Últimos lançamentos</h6>' + (r.movs.slice().sort(ordemMov).slice(0, 5).map(m => '<div class="d-flex justify-content-between small py-1 border-bottom"><span>' + dataBR(m.data).substring(0, 5) + ' • ' + escaparHTML(m.desc) + '</span><b class="money-value ' + (m.tipo === 'entrada' ? 'text-success' : 'text-danger') + '">' + brl(m.valor) + '</b></div>').join('') || '<p class="small text-muted">Sem lançamentos ligados a este cliente.</p>')
        + '<h6 class="fw-bold small text-uppercase text-muted mt-3">Histórico de contatos</h6><div id="cli-hist">' + (c.interacoes || []).slice().reverse().map(i => '<div class="cli-int"><small class="text-muted">' + dataBR(i.data) + '</small><div>' + escaparHTML(i.texto) + '</div></div>').join('') + '</div>'
        + '<div class="d-flex gap-2 mt-2"><input id="cli-int-txt" class="form-control form-control-sm" placeholder="Registrar contato (ligou, enviou orçamento...)"><button class="btn btn-sm btn-primary" onclick="addInteracao(' + c.id + ')"><i class="fas fa-plus"></i></button></div></div>').show();
}
function addInteracao(id) { const t = campo('cli-int-txt').trim(); if (!t) return; const c = clientes().find(x => x.id === id); (c.interacoes = c.interacoes || []).push({ data: hojeISO(), texto: t.slice(0, 300) }); salvarERender(); verCliente(id); }
function novoLancCliente(id) {
    ocultarModal('modalClienteDet');
    setTimeout(() => { abrirModalMov(); setCampo('mov-tipo', 'entrada'); popularCategorias('entrada', null); toggleCartaoMov(); popularClientes('mov-cliente', id); mostrarModal('modalMov'); }, 250);
}
function novaCobranca(id) {
    ocultarModal('modalClienteDet'); setTimeout(() => { abrirModalDivida(); setCampo('div-tipo', 'me-devem'); popularClientes('div-cliente', id); preencherDeCliente(); }, 250);
}
function exportarClientesCSV() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    if (!clientes().length) return erro('Nenhum cliente para exportar.');
    const csv = '\uFEFFNome;Tipo;Status;Documento;Telefone;E-mail;Cidade;Segmento;Origem;Tags;Recebido;Em aberto\r\n' + clientes().map(c => { const r = resumoCliente(c); return [q(c.nome), c.tipo, c.status, q(c.doc), q(c.tel), q(c.email), q(c.cidade), q(c.segmento), q(c.canal), q(c.tags), r.recebido.toFixed(2).replace('.', ','), r.aberto.toFixed(2).replace('.', ',')].join(';'); }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ===================================================================
   12. REVENDA
   =================================================================== */
function abrirModalRevenda(id) {
    if (!verificarAcesso()) return;
    const p = id ? dados.revenda.find(x => x.id === Number(id)) : null;
    setCampo('revenda-id-edit', p ? p.id : ''); setCampo('revenda-nome', p ? p.nome : ''); setCampo('revenda-cat', p ? p.cat : 'Outros');
    setCampo('revenda-vlr-compra', p ? fmtMoeda(p.compra) : ''); setCampo('revenda-vlr-venda', p ? fmtMoeda(p.venda) : ''); setCampo('revenda-qtd', p ? p.qtd : 1);
    document.getElementById('btn-excluir-revenda').classList.toggle('d-none', !p);
    mostrarModal('modalProdutoRevenda');
}
function salvarProdutoRevenda() {
    if (!verificarAcesso()) return;
    const nome = campo('revenda-nome').trim(), compra = lerMoeda('revenda-vlr-compra'), venda = lerMoeda('revenda-vlr-venda'), qtd = parseInt(campo('revenda-qtd')) || 0;
    if (!nome || venda <= 0 || qtd < 1) return erro('Informe o nome, o valor de venda e a quantidade (mínimo 1).');
    const id = Number(campo('revenda-id-edit')) || 0, antigo = id ? dados.revenda.find(x => x.id === id) : null;
    const p = { id: id || Date.now(), nome, cat: campo('revenda-cat'), compra, venda, qtd, vendidos: antigo ? (antigo.vendidos || 0) : 0 };
    const idx = dados.revenda.findIndex(x => x.id === p.id);
    if (idx > -1) dados.revenda[idx] = p; else dados.revenda.push(p);
    salvarERender(); ocultarModal('modalProdutoRevenda'); avisar('Produto salvo');
}
function excluirProdutoRevenda() {
    const id = Number(campo('revenda-id-edit')), i = dados.revenda.findIndex(x => x.id === id);
    if (i < 0 || !confirm('Mover este produto para a lixeira?')) return;
    const it = dados.revenda.splice(i, 1)[0];
    it.origem = 'revenda'; it.deletadoEm = new Date().toLocaleDateString('pt-BR'); dados.lixeira.push(it);
    salvarERender(); ocultarModal('modalProdutoRevenda'); avisar('Produto enviado para a lixeira');
}
function venderProdutoRevenda(id) {
    if (!verificarAcesso()) return;
    const p = dados.revenda.find(x => x.id === Number(id)); if (!p || p.qtd < 1) return;
    if (!confirm('Registrar a venda de 1 unidade de "' + p.nome + '" por ' + brl(p.venda) + '?\nSerá lançada como Receita no extrato.')) return;
    p.qtd--; p.vendidos = (p.vendidos || 0) + 1;
    dados.movs.push({ id: Date.now(), desc: 'Venda: ' + p.nome, valor: p.venda, tipo: 'entrada', cat: 'Outros', data: hojeISO(), hora: horaAgora(), fixo: false });
    salvarERender(); avisar('Venda registrada');
}
function renderRevenda() {
    const l = document.getElementById('lista-produtos-revenda'); if (!l) return;
    const R = dados.revenda; let prev = 0, luc = 0;
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

/* ============================================================
   13. INÍCIO, RESUMO, GRÁFICOS E ANÁLISES
   ============================================================ */
const TELAS_EXTRAS = ['compras-cartao', 'lixeira', 'aba-graficos', 'aba-anual', 'aba-orcamento', 'aba-fixos', 'aba-previsao', 'aba-comparar', 'aba-quitar', 'aba-clientes'];
function renderTudo() {
    renderResumo(); renderExtrato(); renderCartoes(); renderDividas(); renderMetas(); renderizarNotas(); renderRevenda(); renderClientes();
    if (TELAS_EXTRAS.includes(_secAtual) && RENDER_DA_TELA[_secAtual]) RENDER_DA_TELA[_secAtual]();
    atualizarTopo();
}

// ---------- Saldos ----------
function saldoMesDe(ym) {
    let e = 0, s = 0;
    efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; });
    return { e, s };
}
function saldoDiaDe(dia) {
    let e = 0, s = 0;
    efetivosDe(dia.slice(0, 7)).filter(m => m.data === dia).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else s += m.valor; });
    return { e, s };
}
function acumuladoAte(ym) {
    const datas = dados.movs.map(m => m.data && m.data.substring(0, 7)).filter(Boolean).sort(); let a = 0;
    if (datas.length) for (let c = datas[0]; c <= ym; c = ymAdd(c, 1)) { const r = saldoMesDe(c); a += r.e - r.s; }
    return a;
}

function renderResumo() {
    const elSaldo = document.getElementById('txt-saldo-geral'); if (!elSaldo) return;
    const ym = _mesSel(), dia = diaAtual && diaAtual.startsWith(ym) ? diaAtual : '', r = dia ? saldoDiaDe(dia) : saldoMesDe(ym), saldo = r.e - r.s;
    elSaldo.innerText = brl(saldo); elSaldo.classList.toggle('neg', saldo < 0); const lb = document.querySelector('.saldo-label'); if (lb && lb.lastChild) lb.lastChild.nodeValue = dia ? 'Saldo do dia' : 'Saldo do mês';
    elSaldo.classList.toggle('saldo-negativo', saldo < 0);
    const ent = document.getElementById('txt-entradas'), sai = document.getElementById('txt-saidas');
    if (ent) ent.innerText = brl(r.e);
    if (sai) sai.innerText = '- ' + brl(r.s);
    const ac = document.getElementById('txt-saldo-acum');
    if (ac) ac.innerHTML = dia ? 'Saldo do dia ' + dataBR(dia).slice(0, 5) : 'Acumulado até aqui: <b class="money-value">' + brl(acumuladoAte(ym)) + '</b>';
    // quanto posso gastar por dia (só no mês corrente)
    const d = document.getElementById('card-diario'), info = document.getElementById('diario-info');
    if (d && info) {
        const hoje = new Date();
        if (hojeISO().substring(0, 7) !== ym || dia) d.style.display = 'none';
        else {
            const restam = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate() + 1;
            d.style.display = '';
            info.innerHTML = saldo > 0
                ? '<div class="diario-resumo"><span class="diario-pill money-value">' + brl(saldo / restam) + '</span><span>por dia</span></div><small class="text-muted">Restam ' + restam + ' dia(s) e ' + brl(saldo) + ' livres no mês (já descontadas faturas e fixos lançados).</small>'
                : '<div class="fw-bold text-danger">Sem saldo livre no mês</div><small class="text-muted">As despesas já superam as receitas lançadas.</small>';
        }
    }
    renderHome();
}

// ---------- Início ----------
function sequenciaDias() { // dias seguidos com pelo menos 1 lançamento
    const s = new Set(dados.movs.map(m => m.data)), d = new Date(); let n = 0;
    if (!s.has(hojeISO())) d.setDate(d.getDate() - 1);
    for (;;) { if (!s.has(isoDe(d))) break; n++; d.setDate(d.getDate() - 1); }
    return n;
}
function mudarAbaDivida(a) { const b = document.querySelector('#pills-tab button[data-bs-target="#aba-' + a + '"]'); if (b) b.click(); }
document.addEventListener('shown.bs.tab', e => { // os cartões A pagar / A receber acompanham a aba aberta
    const t = e.target.getAttribute('data-bs-target'); if (!t || !t.startsWith('#aba-')) return;
    document.querySelectorAll('.dv-tab').forEach(x => x.classList.toggle('active', '#aba-' + x.dataset.aba === t));
});
function toggleDiario() { const d = document.getElementById('card-diario'); if (d) d.classList.toggle('aberto'); }
const _dm = s => s.substring(8, 10) + '/' + s.substring(5, 7);

function proximos() { // fixos, parcelas/dívidas e faturas dos próximos 35 dias
    const hoje = hojeISO(), lim = new Date(); lim.setDate(lim.getDate() + 35); const limS = isoDe(lim), out = [];
    fixosAtivos().forEach(t => {
        const dia = parseInt(t.data.substring(8, 10));
        for (let i = 0; i <= 1; i++) {
            const ym = ymAdd(hoje.substring(0, 7), i), [a, mm] = ym.split('-').map(Number), dt = ym + '-' + String(Math.min(dia, new Date(a, mm, 0).getDate())).padStart(2, '0');
            if (dt >= hoje && dt <= limS) out.push({ data: dt, titulo: t.desc, sub: t.cat + ' | Recorrência', valor: t.valor, tipo: t.tipo, ic: iconeCat(t.cat) });
        }
    });
    dados.dividas.filter(d => d.rec).forEach(d => {
        for (let i = 0; i <= 1; i++) ocorrenciasRec(d, ymAdd(hoje.substring(0, 7), i)).forEach(o => {
            if (o.pago || o.data > limS || (o.data < hoje && i > 0)) return;
            out.push({ data: o.data, titulo: d.nome, sub: (d.tipo === 'eu-devo' ? 'A pagar' : 'A receber') + ' | Recorrente', valor: d.valor, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', ic: ['fa-handshake', '#57005F'], atrasada: o.data < hoje, dividas: 1 });
        });
    });
    dados.dividas.filter(d => !d.rec).forEach(d => {
        if (!d.prazo || d.prazo > limS) return; const parc = (d.parcelas || 1) > 1;
        out.push({ data: d.prazo, titulo: d.nome, sub: (d.tipo === 'eu-devo' ? 'A pagar' : 'A receber') + (parc ? ' | Parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas : ' | Dívida'), valor: parc ? (d.valorParcela || d.valor) : d.valor, tipo: d.tipo === 'eu-devo' ? 'saida' : 'entrada', ic: ['fa-handshake', '#57005F'], atrasada: d.prazo < hoje, dividas: 1 });
    });
    dados.cartoes.forEach(c => {
        if (c.tipo === 'Débito' || !parseInt(c.vence)) return;
        const v = String(parseInt(c.vence)).padStart(2, '0'); let ym = hoje.substring(0, 7); if (ym + '-' + v < hoje) ym = ymAdd(ym, 1);
        const dt = ym + '-' + v; if (dt > limS) return;
        const t = itensFatura(c, ymFat(c, ym)).filter(i => !i.c.emprestado).reduce((s, i) => s + i.valor, 0);
        if (t > 0) out.push({ data: dt, titulo: 'Fatura ' + c.nome, sub: 'Cartão | Fatura', valor: t, tipo: 'saida', ic: ['fa-credit-card', c.cor || '#57005F'], cartao: c.id });
    });
    return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 10);
}
function linhasRecentes(n) { // "Últimas transações" do mês (Início e Extrato)
    const ym = mesAtual, tr = efetivos().filter(x => x.data && (diaAtual ? x.data === diaAtual : x.data.startsWith(ym)) && !x.virtual && !x.cartaoId && !x.idRelacionado).sort(ordemMov).slice(0, n); // sem cartão/fatura: isso fica no Extrato
    return tr.map(x => {
        const [ic, cor] = iconeCat(x.cat), ent = x.tipo === 'entrada';
        return '<div class="trans" onclick="abrirTransacao(' + x.id + ')"><span class="ic-box round" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span>'
            + '<div class="trans-mid"><b>' + escaparHTML(x.desc) + (x.fixo ? ' <i class="fas fa-rotate text-info" title="Fixo" style="font-size:.7rem"></i>' : '') + '</b><small>' + escaparHTML(x.cat) + ' | ' + (x.virtual ? 'Fatura' : ent ? 'Receita' : 'Despesa') + (x.forma ? ' • ' + escaparHTML(x.forma) : '') + '</small></div>'
            + '<div class="trans-end"><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + (ent ? '' : '-') + brl(x.valor) + '</b><small>' + _dm(x.data) + '</small></div><i class="fas fa-chevron-right trans-go"></i></div>';
    }).join('') || '<div class="text-center text-muted py-4 small">Nenhuma transação neste mês.<br>Toque em <b>＋</b> para lançar a primeira.</div>';
}
function renderHome() {
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.innerText = t; };
    const h = new Date(); set('hero-atualizado', 'Atualizado às ' + String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0'));
    const seq = sequenciaDias(), sq = document.getElementById('hero-seq');
    if (sq) sq.innerHTML = seq > 0 ? '<span class="chip-seq"><i class="fas fa-fire me-1"></i>' + seq + (seq === 1 ? ' dia' : ' dias') + '</span>' : '';
    const P = document.getElementById('home-proximos');
    if (P) P.innerHTML = proximos().map(x => {
        const [ic, cor] = x.ic, ent = x.tipo === 'entrada', acao = x.cartao ? 'verCompras(' + x.cartao + ')' : x.dividas ? "showSection('dividas')" : "showSection('aba-fixos')";
        return '<div class="prox-card" onclick="' + acao + '"><div class="prox-top"><span class="ic-box" style="background:' + cor + '22;color:' + cor + '"><i class="fas ' + ic + '"></i></span><b>' + escaparHTML(x.titulo) + '</b></div>'
            + '<small class="text-muted d-block mt-1">' + escaparHTML(x.sub) + '</small><div class="prox-bot"><small class="' + (x.atrasada ? 'text-danger fw-bold' : 'text-muted') + '">' + _dm(x.data) + (x.atrasada ? ' • vencida' : '') + '</small><b class="money-value ' + (ent ? 'text-success' : 'text-danger') + '">' + brl(x.valor) + '</b></div></div>';
    }).join('') || '<div class="prox-card text-muted small">Nada previsto para os próximos 35 dias</div>';
    const L = document.getElementById('lista-recente'); if (L) L.innerHTML = linhasRecentes(6);
}

// ---------- Gráfico do mês (rosca: entradas por fora, saídas por dentro) ----------
const CORES_GRAFICO = { 'Mercado': '#4ecca3', 'Transporte': '#57005F', 'Saúde': '#D62839', 'Saude': '#D62839', 'Lazer': '#ffc107', 'Salário': '#0dcaf0', 'Salario': '#0dcaf0', 'Aluguel': '#ff8c00', 'Cartão': '#e83e8c', 'Outros': '#adb5bd' };
function renderGraficoRank() {
    renderFormasPagamento();
    const ctx = document.getElementById('chartGastos'), bal = document.getElementById('txt-balanco-grafico'), leg = document.getElementById('legenda-grafico-html');
    if (!ctx || !bal || !leg) return;
    if (meuGrafico && meuGrafico.destroy) { meuGrafico.destroy(); meuGrafico = null; }
    const ym = _mesSel(), cat = {}; let tE = 0, tS = 0;
    efetivos().filter(m => m.data && (diaAtual ? m.data === diaAtual : m.data.startsWith(ym))).forEach(m => {
        const c = m.cat || 'Outros'; cat[c] = cat[c] || { entrada: 0, saida: 0 };
        if (m.tipo === 'entrada') { cat[c].entrada += m.valor; tE += m.valor; } else { cat[c].saida += m.valor; tS += m.valor; }
    });
    const b = tE - tS; bal.innerText = brl(b);
    bal.classList.remove('text-success', 'text-danger', 'text-dark'); bal.classList.add(b < 0 ? 'text-danger' : b > 0 ? 'text-success' : 'text-dark');
    const ks = Object.keys(cat).sort((x, y) => (cat[y].entrada + cat[y].saida) - (cat[x].entrada + cat[x].saida));
    if (!ks.length) { leg.innerHTML = '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>'; return; }
    const corDe = c => CORES_GRAFICO[c.trim()] || CORES_GRAFICO.Outros, cores = ks.map(corDe);
    meuGrafico = new Chart(ctx, { type: 'doughnut', data: { labels: ks, datasets: [{ label: 'Entradas', data: ks.map(c => cat[c].entrada), backgroundColor: cores, borderWidth: 0, hoverOffset: 10, cutout: '70%' }, { label: 'Saídas', data: ks.map(c => cat[c].saida), backgroundColor: cores, borderWidth: 0, hoverOffset: 10, cutout: '65%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, layout: { padding: 20 } } });
    const vol = tE + tS;
    leg.innerHTML = ks.map(c => {
        const d = cat[c], bc = d.entrada - d.saida, perc = vol > 0 ? Math.round((d.entrada + d.saida) / vol * 100) + '%' : '0%';
        return '<div class="list-group-item d-flex justify-content-between align-items-start border-0 rounded-3 p-3 mb-2 shadow-sm"><div class="icon-box bg-light border" style="color:' + corDe(c) + ';min-width:45px"><i class="fas fa-tags"></i></div>'
            + '<div class="flex-grow-1 ms-3"><div class="fw-bold text-dark d-flex justify-content-between">' + escaparHTML(c) + '<span class="' + (bc >= 0 ? 'text-success' : 'text-danger') + '" style="font-size:.8rem">' + brl(bc) + '</span></div>'
            + '<div class="d-flex justify-content-between mt-1" style="font-size:.7rem"><span class="text-success">↑ ' + brl(d.entrada) + '</span><span class="text-danger">↓ ' + brl(d.saida) + '</span></div></div><div class="ms-2 fw-bold small text-muted">' + perc + '</div></div>';
    }).join('');
}

// ---------- Visão anual ----------
let _anoAnual = new Date().getFullYear(), _chAnual = null;
function mudarAnoAnual(n) { _anoAnual += n; renderAnual(); }
function renderAnual() {
    const meses = [], cats = {};
    for (let i = 1; i <= 12; i++) {
        const ym = _anoAnual + '-' + String(i).padStart(2, '0'); let e = 0, s = 0;
        efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).forEach(m => { if (m.tipo === 'entrada') e += m.valor; else { s += m.valor; cats[m.cat || 'Outros'] = (cats[m.cat || 'Outros'] || 0) + m.valor; } });
        meses.push({ ym, e, s, saldo: e - s });
    }
    const T = meses.reduce((a, m) => ({ e: a.e + m.e, s: a.s + m.s }), { e: 0, s: 0 }), ativos = meses.filter(m => m.e || m.s);
    const melhor = ativos.length ? ativos.reduce((a, b) => b.saldo > a.saldo ? b : a) : null, maior = ativos.length ? ativos.reduce((a, b) => b.s > a.s ? b : a) : null;
    document.getElementById('anual-ano').innerText = _anoAnual;
    const card = (t, v, cor) => '<div class="col-6"><div class="card border-0 shadow-sm rounded-4 p-3 h-100"><small class="text-muted">' + t + '</small><div class="fw-bold money-value ' + cor + '">' + v + '</div></div></div>';
    document.getElementById('anual-cards').innerHTML = card('Receitas no ano', brl(T.e), 'text-success') + card('Despesas no ano', brl(T.s), 'text-danger')
        + card('Saldo do ano', brl(T.e - T.s), T.e - T.s >= 0 ? 'text-success' : 'text-danger') + card('Gasto médio/mês', brl(ativos.length ? T.s / ativos.length : 0), '')
        + card('Melhor mês', melhor ? MESES_C[+melhor.ym.slice(5) - 1] + ' · ' + brl(melhor.saldo) : '—', 'text-success') + card('Mês mais caro', maior ? MESES_C[+maior.ym.slice(5) - 1] + ' · ' + brl(maior.s) : '—', 'text-danger');
    if (_chAnual) _chAnual.destroy();
    _chAnual = new Chart(document.getElementById('grafico-anual'), { type: 'bar', data: { labels: MESES_C, datasets: [{ label: 'Receitas', data: meses.map(m => m.e), backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Despesas', data: meses.map(m => m.s), backgroundColor: '#D62839', borderRadius: 6 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } } });
    document.getElementById('anual-meses').innerHTML = meses.map((m, i) => '<div class="card-mov py-2 mb-2" style="cursor:pointer" onclick="irParaMes(\'' + m.ym + '\')"><div class="flex-grow-1 fw-bold">' + MESES_C[i] + '</div><small class="text-success me-3 money-value">+' + brl(m.e) + '</small><small class="text-danger me-3 money-value">-' + brl(m.s) + '</small><b class="money-value ' + (m.saldo >= 0 ? 'text-success' : 'text-danger') + '">' + brl(m.saldo) + '</b></div>').join('');
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = top.length ? top[0][1] : 1;
    document.getElementById('anual-cats').innerHTML = top.map(([c, v]) => '<div class="mb-2"><div class="d-flex justify-content-between small"><span>' + escaparHTML(c) + '</span><b class="money-value">' + brl(v) + '</b></div><div class="progress" style="height:8px"><div class="progress-bar" style="width:' + (v / mx * 100) + '%;background:var(--purple)"></div></div></div>').join('') || '<p class="text-muted small">Sem despesas neste ano.</p>';
}

// ---------- Orçamento por categoria ----------
let _orcCats = [];
function gastoPorCategoria(ym) { const g = {}; efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && m.data.startsWith(ym)).forEach(m => { g[m.cat] = (g[m.cat] || 0) + m.valor; }); return g; }
function renderOrcamento() {
    dados.orcamentos = dados.orcamentos || {};
    const gasto = gastoPorCategoria(_mesSel());
    _orcCats = [...new Set([...cats().saida, ...Object.keys(dados.orcamentos)])];
    document.getElementById('orc-lista').innerHTML = _orcCats.map((c, i) => {
        const lim = dados.orcamentos[c] || 0, g = gasto[c] || 0, p = lim > 0 ? g / lim * 100 : 0, cor = p >= 100 ? '#D62839' : p >= 80 ? '#f59e0b' : '#10b981';
        return '<div class="card border-0 shadow-sm rounded-4 p-3 mb-2"><div class="d-flex justify-content-between align-items-center"><b>' + escaparHTML(c) + '</b>'
            + '<input type="number" inputmode="decimal" min="0" class="form-control form-control-sm text-end" style="width:110px" placeholder="Limite" value="' + (lim || '') + '" onchange="salvarOrcamento(' + i + ',this.value)"></div>'
            + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, p) + '%;background:' + cor + '"></div></div>'
            + '<small class="text-muted money-value">Gasto ' + brl(g) + (lim > 0 ? ' de ' + brl(lim) + ' (' + Math.round(p) + '%)' : ' — sem limite definido') + '</small></div>';
    }).join('');
}
function salvarOrcamento(i, v) { const n = parseFloat(v) || 0, c = _orcCats[i]; if (n > 0) dados.orcamentos[c] = n; else delete dados.orcamentos[c]; salvarERender(); }

// ---------- Previsão, reserva de emergência e simulador ----------
const _lbl = ym => ym.split('-').reverse().join('/');
function listaFixos(comCartao) {
    const l = fixosAtivos().map(m => ({ tipo: m.tipo, valor: m.valor }));
    if (comCartao) dados.cartoes.forEach(c => (c.compras || []).filter(x => x.fixa).forEach(x => l.push({ tipo: 'saida', valor: x.valorTotal })));
    return l;
}
function dividasMes(ym) {
    let e = 0, s = 0;
    dados.dividas.filter(d => d.rec).forEach(d => ocorrenciasRec(d, ym).forEach(o => { if (!o.pago) { if (d.tipo === 'eu-devo') s += o.valor; else e += o.valor; } }));
    dados.dividas.filter(d => !d.rec).forEach(d => {
        if (!d.prazo) return; let dt = d.prazo; const q = Math.max(1, (d.parcelas || 1) - (d.pagas || 0));
        for (let i = 0; i < q; i++) { if (dt.substring(0, 7) === ym) { const v = (d.parcelas || 1) > 1 ? (d.valorParcela || d.valor) : d.valor; if (d.tipo === 'eu-devo') s += v; else e += v; } dt = addMesData(dt); }
    });
    return { e, s };
}
function previsao(n) { // fixos + lançamentos futuros já feitos + faturas/parcelas + dívidas a pagar/receber
    const hoje = hojeISO().substring(0, 7), fx = listaFixos(false);
    const fe = fx.filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0), fs = fx.filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0);
    let acum = acumuladoAte(hoje); const out = [];
    for (let i = 1; i <= n; i++) {
        const ym = ymAdd(hoje, i); let ve = 0, vs = 0;
        efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym) && !m.fixo).forEach(m => { if (m.tipo === 'entrada') ve += m.valor; else vs += m.valor; });
        const dv = dividasMes(ym), ent = fe + ve + dv.e, sai = fs + vs + dv.s; acum += ent - sai; out.push({ ym, ent, sai, acum });
    }
    return out;
}
function renderPrevisao() {
    const reservas = dados.metas.filter(m => /reserva|emerg/i.test(m.nome)), guard = (reservas.length ? reservas : dados.metas).reduce((s, m) => s + (m.guardado || 0), 0);
    const custo = listaFixos(true).filter(x => x.tipo !== 'entrada').reduce((s, x) => s + x.valor, 0), meses = custo > 0 ? guard / custo : 0;
    document.getElementById('prev-reserva').innerHTML = '<small class="text-muted">Reserva de emergência (meta: 6 meses de gastos fixos)</small><div class="fw-bold fs-5 money-value">' + brl(guard) + ' <small class="text-muted fw-normal">≈ ' + meses.toFixed(1).replace('.', ',') + ' mês(es)</small></div>'
        + '<div class="progress my-2" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, meses / 6 * 100) + '%;background:' + (meses >= 6 ? '#10b981' : meses >= 3 ? '#f59e0b' : '#D62839') + '"></div></div>'
        + '<small class="text-muted">' + (custo > 0 ? 'Custo fixo mensal: ' + brl(custo) + '. Crie uma meta chamada "Reserva de emergência" para acompanhar aqui.' : 'Cadastre despesas fixas para calcular a reserva ideal.') + '</small>';
    document.getElementById('prev-lista').innerHTML = previsao(6).map(p => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b><small class="d-block text-muted money-value">+' + brl(p.ent) + ' / -' + brl(p.sai) + '</small></div><div class="text-end"><small class="text-muted d-block">saldo projetado</small><b class="money-value ' + (p.acum >= 0 ? 'text-success' : 'text-danger') + '">' + brl(p.acum) + '</b></div></div>').join('');
}
function simular() {
    const V = parseFloat(document.getElementById('sim-valor').value) || 0, n = Math.max(1, Math.min(48, parseInt(document.getElementById('sim-parc').value) || 1)), i = (parseFloat(document.getElementById('sim-juros').value) || 0) / 100;
    if (V <= 0) return erro('Informe o valor da compra.');
    const pmt = i > 0 ? V * i / (1 - Math.pow(1 + i, -n)) : V / n, total = pmt * n, base = previsao(Math.max(6, n));
    const renda = listaFixos(false).filter(x => x.tipo === 'entrada').reduce((s, x) => s + x.valor, 0);
    let neg = 0, html = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><div>Parcela: <b class="money-value">' + brl(pmt) + '</b> × ' + n + '</div><div>Total: <b class="money-value">' + brl(total) + '</b> <small class="text-muted">(juros: ' + brl(total - V) + ')</small></div>'
        + (renda > 0 ? '<small class="text-muted">A parcela pesa ' + Math.round(pmt / renda * 100) + '% da sua renda fixa.</small>' : '') + '</div>';
    html += base.map((p, k) => { const dep = p.acum - pmt * Math.min(k + 1, n), ruim = dep < 0; if (ruim && p.acum >= 0) neg++; return '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + _lbl(p.ym) + '</b>' + (k < n ? '<small class="d-block text-muted">parcela ' + (k + 1) + '/' + n + '</small>' : '') + '</div><div class="text-end"><small class="text-muted d-block">antes: <span class="money-value">' + brl(p.acum) + '</span></small><b class="money-value ' + (dep >= 0 ? 'text-success' : 'text-danger') + '">' + brl(dep) + '</b></div></div>'; }).join('');
    document.getElementById('sim-resultado').innerHTML = (neg ? '<div class="alert alert-danger rounded-4"><i class="fas fa-triangle-exclamation me-1"></i>Esta compra deixa o saldo projetado negativo em ' + neg + ' mês(es) em que ele estaria positivo.</div>' : '<div class="alert alert-success rounded-4"><i class="fas fa-circle-check me-1"></i>Cabe no orçamento projetado.</div>') + html;
}

// ---------- Comparar meses e ordem para quitar dívidas ----------
function renderComparar() {
    const ym = _mesSel(), ant = ymAdd(ym, -1), a = gastoPorCategoria(ym), b = gastoPorCategoria(ant);
    const ta = Object.values(a).reduce((s, v) => s + v, 0), tb = Object.values(b).reduce((s, v) => s + v, 0);
    const ks = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (a[y] || 0) - (a[x] || 0));
    const seta = (n, o) => { const d = n - o; return d === 0 ? '<span class="text-muted">=</span>' : '<b class="money-value ' + (d > 0 ? 'text-danger' : 'text-success') + '">' + (d > 0 ? '▲ +' : '▼ ') + brl(d) + '</b>'; };
    document.getElementById('comp-lista').innerHTML = '<div class="card border-0 shadow-sm rounded-4 p-3 mb-3"><small class="text-muted">Despesas ' + _lbl(ant) + ' → ' + _lbl(ym) + '</small><div class="fw-bold money-value">' + brl(tb) + ' → ' + brl(ta) + '</div><div>' + seta(ta, tb) + (tb > 0 ? ' <small class="text-muted">(' + Math.round((ta - tb) / tb * 100) + '%)</small>' : '') + '</div></div>'
        + (ks.map(c => '<div class="card-mov py-2 mb-2"><div class="flex-grow-1"><b>' + escaparHTML(c) + '</b><small class="d-block text-muted money-value">' + brl(b[c] || 0) + ' → ' + brl(a[c] || 0) + '</small></div>' + seta(a[c] || 0, b[c] || 0) + '</div>').join('') || '<p class="text-muted text-center">Sem despesas nos dois meses.</p>');
}
let _estQuitar = 'menor';
function setEstQuitar(e) { _estQuitar = e; renderQuitar(); }
function renderQuitar() {
    const l = dados.dividas.filter(d => d.tipo === 'eu-devo').sort(_estQuitar === 'menor' ? (x, y) => x.valor - y.valor : _estQuitar === 'juros' ? (x, y) => (y.juros || 0) - (x.juros || 0) : (x, y) => (x.prazo || '9999').localeCompare(y.prazo || '9999')); let ac = 0;
    ['menor', 'prazo', 'juros'].forEach(k => { const b = document.getElementById('quit-' + k); if (b) { b.classList.toggle('btn-primary', _estQuitar === k); b.classList.toggle('btn-outline-primary', _estQuitar !== k); } });
    document.getElementById('quit-lista').innerHTML = l.map((d, i) => { ac += d.valor; return '<div class="card-mov py-2 mb-2"><div class="me-3 fw-bold fs-5 text-primary">' + (i + 1) + 'º</div><div class="flex-grow-1"><b>' + escaparHTML(d.nome) + '</b><small class="d-block text-muted">' + (d.prazo ? 'Vence ' + d.prazo.split('-').reverse().join('/') : 'Sem prazo') + ' • acumulado ' + brl(ac) + '</small></div><b class="money-value text-danger">' + brl(d.valor) + '</b></div>'; }).join('') || '<p class="text-muted text-center">Você não tem dívidas a pagar.</p>';
}

// ---------- Exportar o extrato do mês em CSV ----------
function exportarCSV() {
    const ym = _mesSel(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const linhas = efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data));
    if (!linhas.length) return erro('Nenhum lançamento neste mês.');
    const csv = '﻿Data;Descrição;Categoria;Tipo;Valor;Fixo\r\n' + linhas.map(m => [m.data.split('-').reverse().join('/'), q(m.desc), q(m.cat), m.tipo === 'entrada' ? 'Receita' : 'Despesa', m.valor.toFixed(2).replace('.', ','), m.fixo ? 'Sim' : 'Não'].join(';')).join('\r\n');
    baixarArquivo(csv, 'extrato_' + ym + '.csv', 'text/csv;charset=utf-8');
}
function baixarArquivo(conteudo, nome, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo })), a = document.createElement('a');
    a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Utilitários de arquivo / compartilhamento ----------
function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function compartilharOuBaixar(blob, nome, titulo) { // no celular abre o compartilhar (WhatsApp etc.); senão baixa
    try {
        const f = new File([blob], nome, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: titulo }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    baixarBlob(blob, nome);
}
const _enc = n => encodeURIComponent(n).replace(/'/g, '%27');
function linkWhats(tel, msg) {
    let d = soDigitos(tel || ''); if (d && d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(msg);
}

// ---------- Cartão emprestado: resumo por pessoa, WhatsApp e imagem ----------
function _dadosPessoa(cardId, nome) {
    const card = dados.cartoes.find(c => c.id === cardId); if (!card) return null;
    const ymF = ymFat(card, mesAtual);
    const itens = itensFatura(card, ymF).filter(i => i.c.emprestado && (((i.c.pessoa || '').trim()) || 'Sem nome') === nome);
    const linhas = itens.map(i => { const tot = parcelasCompra(card, i.c).length; return { desc: i.c.desc, parc: tot > 1 ? _numParcela(card, i.c, ymF, false) + '/' + tot : '', valor: i.valor, pago: itemPago(card, i, ymF, false) }; });
    const total = linhas.reduce((a, l) => a + l.valor, 0), pendente = linhas.filter(l => !l.pago).reduce((a, l) => a + l.valor, 0);
    const venc = mesPagamento(card, ymF) + '-' + String(card.vence || 1).padStart(2, '0');
    return { card, nome, linhas, total, pendente, venc, mes: MESES_C[parseInt(ymF.slice(5)) - 1] + '/' + ymF.slice(0, 4) };
}
function _btnsEmp(cardId, nome) {
    const n = _enc(nome);
    return '<span class="emp-acoes"><button type="button" class="emp-btn wa" title="Cobrar no WhatsApp" onclick="cobrarPessoaWA(' + cardId + ',\'' + n + '\')"><i class="fab fa-whatsapp"></i></button><button type="button" class="emp-btn" title="Gerar imagem do débito" onclick="gerarImagemPessoa(' + cardId + ',\'' + n + '\')"><i class="fas fa-image"></i></button></span>';
}
function cobrarPessoaWA(cardId, nomeEnc) {
    const nome = decodeURIComponent(nomeEnc), p = _dadosPessoa(cardId, nome); if (!p) return;
    if (p.pendente <= 0) return avisar('Nada pendente para ' + nome + ' nesta fatura.');
    const pend = p.linhas.filter(l => !l.pago);
    const msg = 'Olá, ' + nome.split(' ')[0] + '! Tudo bem? 😊\nSegue o resumo do cartão ' + p.card.nome + ' (fatura de ' + p.mes + '):\n\n'
        + pend.map(l => '• ' + l.desc + (l.parc ? ' (' + l.parc + ')' : '') + ' — ' + brl(l.valor)).join('\n')
        + '\n\n*Total: ' + brl(p.pendente) + '*\nVencimento: ' + dataBR(p.venc) + '\n\nQualquer dúvida é só me chamar. Obrigado(a)!';
    const cli = clientes().find(c => _norm(c.nome) === _norm(nome));
    window.open(linkWhats(cli && cli.tel, msg), '_blank');
}
function _ajustaTexto(ctx, t, larg) { if (ctx.measureText(t).width <= larg) return t; while (t.length > 1 && ctx.measureText(t + '…').width > larg) t = t.slice(0, -1); return t + '…'; }
function _rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
async function gerarImagemPessoa(cardId, nomeEnc) {
    const nome = decodeURIComponent(nomeEnc), p = _dadosPessoa(cardId, nome); if (!p) return;
    if (!p.linhas.length) return avisar('Sem compras desta pessoa nesta fatura.');
    const W = 1080, pad = 60, linhaH = 92, topH = 330, rodH = 250, H = topH + p.linhas.length * linhaH + rodH;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), F = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
    const cor = /^#[0-9a-f]{6}$/i.test(p.card.cor || '') ? p.card.cor : '#57005F';
    x.fillStyle = '#f5f6fb'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, topH); g.addColorStop(0, cor); g.addColorStop(1, shade(cor, .45)); x.fillStyle = g; x.fillRect(0, 0, W, topH);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    x.font = '600 32px ' + F; x.globalAlpha = .85; x.fillText('RESUMO DO CARTÃO', pad, 90); x.globalAlpha = 1;
    x.font = '800 68px ' + F; x.fillText(_ajustaTexto(x, nome, W - pad * 2), pad, 175);
    x.font = '500 34px ' + F; x.globalAlpha = .9;
    x.fillText(_ajustaTexto(x, p.card.nome + (p.card.final ? ' •••• ' + p.card.final : '') + '  |  Fatura de ' + p.mes, W - pad * 2), pad, 235);
    x.fillText('Vencimento: ' + dataBR(p.venc), pad, 285); x.globalAlpha = 1;
    let y = topH + 30;
    p.linhas.forEach(l => {
        x.fillStyle = '#fff'; _rrect(x, pad / 2, y, W - pad, linhaH - 12, 20); x.fill();
        x.fillStyle = l.pago ? '#10b981' : '#D62839'; x.beginPath(); x.arc(pad + 12, y + (linhaH - 12) / 2, 9, 0, 7); x.fill();
        x.fillStyle = '#1f2433'; x.font = '600 34px ' + F; x.textAlign = 'left';
        x.fillText(_ajustaTexto(x, l.desc + (l.parc ? '  (' + l.parc + ')' : ''), 600), pad + 38, y + 56);
        x.textAlign = 'right'; x.font = '700 34px ' + F; x.fillStyle = l.pago ? '#10b981' : '#1f2433'; x.fillText(brl(l.valor), W - pad - 10, y + 56); x.textAlign = 'left';
        y += linhaH;
    });
    y += 20; x.fillStyle = '#1f2433'; _rrect(x, pad / 2, y, W - pad, 170, 28); x.fill();
    x.fillStyle = '#fff'; x.font = '500 32px ' + F; x.globalAlpha = .8; x.fillText(p.pendente > 0 ? 'TOTAL A PAGAR' : 'TUDO PAGO', pad + 10, y + 62); x.globalAlpha = 1;
    x.font = '800 74px ' + F; x.fillStyle = p.pendente > 0 ? '#fff' : '#34d399'; x.fillText(brl(p.pendente > 0 ? p.pendente : p.total), pad + 10, y + 138);
    x.textAlign = 'center'; x.fillStyle = '#8b90a0'; x.font = '500 26px ' + F; x.fillText('Gerado em ' + dataBR(hojeISO()) + ' • Finanças Pro', W / 2, H - 28);
    cv.toBlob(b => compartilharOuBaixar(b, 'debito_' + _norm(nome).replace(/\W+/g, '_') + '_' + hojeISO() + '.png', 'Débito - ' + nome), 'image/png');
}

// ---------- Dívidas: cobrança por WhatsApp em um toque ----------
function cobrarDividaWA(id) {
    const d = dados.dividas.find(x => x.id === Number(id)); if (!d) return;
    const pz = prazoEfetivo(d), parc = d.parcelas > 1 && !d.rec;
    const valor = parc ? (d.valorParcela || d.valor) : d.valor;
    const msg = 'Olá, ' + (d.nome || '').trim().split(' ')[0] + '! Tudo bem? 😊\nPassando para lembrar do valor de *' + brl(valor) + '*'
        + (parc ? ' (parcela ' + ((d.pagas || 0) + 1) + '/' + d.parcelas + ')' : '') + (d.desc ? ' referente a ' + d.desc : '')
        + (pz ? ', com vencimento em *' + dataBR(pz) + '*' : '') + '.\nQualquer dúvida é só me chamar. Obrigado(a)!';
    window.open(linkWhats(d.whats, msg), '_blank');
}

// ---------- Gastos por forma de pagamento ----------
const FORMAS_IC = { 'Pix': 'fa-bolt', 'Dinheiro': 'fa-money-bill-wave', 'Débito': 'fa-credit-card', 'Crédito': 'fa-credit-card', 'Boleto': 'fa-barcode', 'Transferência': 'fa-right-left', 'Outro': 'fa-ellipsis', 'Não informado': 'fa-circle-question' };
const FORMAS_COR = { 'Pix': '#10b981', 'Dinheiro': '#84cc16', 'Débito': '#3b82f6', 'Crédito': '#7a1a85', 'Boleto': '#f59e0b', 'Transferência': '#14b8a6', 'Outro': '#94a3b8', 'Não informado': '#cbd5e1' };
function gastosPorForma(ym, dia) {
    const g = {}; let t = 0;
    efetivosDe(ym).filter(m => m.tipo === 'saida' && m.data && (dia ? m.data === dia : m.data.startsWith(ym))).forEach(m => {
        const f = m.forma || ((m.cartaoId || m.idRelacionado || m.virtual || m.cat === 'Cartão') ? 'Crédito' : 'Não informado');
        g[f] = (g[f] || 0) + m.valor; t += m.valor;
    });
    return { g, t };
}
function renderFormasPagamento() {
    const el = document.getElementById('gastos-forma'); if (!el) return;
    const { g, t } = gastosPorForma(_mesSel(), diaAtual), ks = Object.keys(g).sort((a, b) => g[b] - g[a]);
    el.innerHTML = !ks.length ? '<p class="text-center text-muted small py-3 mb-0">Sem gastos neste mês.</p>' : ks.map(k => {
        const p = t ? g[k] / t * 100 : 0, c = FORMAS_COR[k] || '#94a3b8';
        return '<div class="fg-linha"><div class="d-flex justify-content-between align-items-center"><span class="fw-semibold"><i class="fas ' + (FORMAS_IC[k] || 'fa-ellipsis') + ' me-2" style="color:' + c + '"></i>' + escaparHTML(k) + '</span><span><b class="money-value">' + brl(g[k]) + '</b> <small class="text-muted">' + p.toFixed(0) + '%</small></span></div><div class="fg-bar"><div style="width:' + p + '%;background:' + c + '"></div></div></div>';
    }).join('');
}

// ---------- Exportar o mês: planilha (.xlsx) e PDF ----------
function _crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (c ^ 0xFFFFFFFF) >>> 0; }
function _zip(files) { // zip sem compressão (suficiente para .xlsx)
    const enc = new TextEncoder(), u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    const parts = [], cen = []; let off = 0;
    files.forEach(f => {
        const nm = enc.encode(f.name), d = enc.encode(f.data), crc = _crc32(d);
        const lh = Uint8Array.from([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0]);
        parts.push(lh, nm, d);
        cen.push(Uint8Array.from([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), nm);
        off += lh.length + nm.length + d.length;
    });
    const csz = cen.reduce((a, c) => a + c.length, 0);
    parts.push(...cen, Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(csz), ...u32(off), 0, 0]));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function _xlsx(abas) { // abas: [{nome, linhas:[[valor|{v,b}...]]}]  números viram células numéricas
    const X = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), col = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
    const sheets = abas.map(a => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="8" width="22" customWidth="1"/></cols><sheetData>'
        + a.linhas.map((l, r) => '<row r="' + (r + 1) + '">' + l.map((c, i) => {
            const bold = c && typeof c === 'object' ? c.b : false, v = c && typeof c === 'object' ? c.v : c, ref = col(i) + (r + 1);
            if (typeof v === 'number') return '<c r="' + ref + '" s="' + (bold ? 3 : 2) + '"><v>' + v + '</v></c>';
            return '<c r="' + ref + '" t="inlineStr"' + (bold ? ' s="1"' : '') + '><is><t>' + X(v == null ? '' : v) + '</t></is></c>';
        }).join('') + '</row>').join('') + '</sheetData></worksheet>');
    const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
        { name: '[Content_Types].xml', data: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + abas.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
        { name: '_rels/.rels', data: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: 'xl/workbook.xml', data: H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + abas.map((a, i) => '<sheet name="' + X(a.nome) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>' },
        { name: 'xl/_rels/workbook.xml.rels', data: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + abas.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (abas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
        { name: 'xl/styles.xml', data: H + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
        ...sheets.map((d, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: d }))
    ];
    return _zip(files);
}
function _dadosMes(ym) {
    const linhas = efetivosDe(ym).filter(m => m.data && m.data.startsWith(ym)).sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '').localeCompare(b.hora || ''));
    const rec = linhas.filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0), desp = linhas.filter(m => m.tipo !== 'entrada').reduce((a, m) => a + m.valor, 0);
    return { linhas, rec, desp, saldo: rec - desp, cat: gastoPorCategoria(ym), forma: gastosPorForma(ym).g };
}
function exportarPlanilhaMes() {
    const ym = _mesSel(), d = _dadosMes(ym); if (!d.linhas.length) return erro('Nenhum lançamento neste mês.');
    const B = v => ({ v, b: true }), ord = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
    const abas = [
        { nome: 'Resumo', linhas: [[B('Relatório financeiro'), _lbl(ym)], [], [B('Receitas'), d.rec], [B('Despesas'), d.desp], [B('Saldo'), { v: d.saldo, b: true }]] },
        { nome: 'Extrato', linhas: [[B('Data'), B('Descrição'), B('Categoria'), B('Tipo'), B('Forma'), B('Valor'), B('Fixo')]].concat(d.linhas.map(m => [dataBR(m.data), m.desc || '', m.cat || '', m.tipo === 'entrada' ? 'Receita' : 'Despesa', m.forma || '', m.tipo === 'entrada' ? m.valor : -m.valor, m.fixo ? 'Sim' : 'Não'])) },
        { nome: 'Por categoria', linhas: [[B('Categoria'), B('Total gasto')]].concat(ord(d.cat).map(([k, v]) => [k, v])) },
        { nome: 'Por forma de pagamento', linhas: [[B('Forma'), B('Total gasto')]].concat(ord(d.forma).map(([k, v]) => [k, v])) }
    ];
    baixarBlob(_xlsx(abas), 'financas_' + ym + '.xlsx'); avisar('Planilha gerada');
}
function imprimirHTML(html) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    const doc = f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 400);
}
function exportarPDFMes() {
    const ym = _mesSel(), d = _dadosMes(ym); if (!d.linhas.length) return erro('Nenhum lançamento neste mês.');
    const E = escaparHTML, ord = o => Object.entries(o).sort((a, b) => b[1] - a[1]), tab = (cab, l) => '<table><thead><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + l.map(r => '<tr>' + r.map((c, i) => '<td' + (i === r.length - 1 && /^R\$|^-R\$/.test(c) ? ' class="r"' : '') + '>' + E(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    const html = '<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8"><title>Relatório ' + _lbl(ym) + '</title><style>body{font-family:Arial,sans-serif;color:#1f2433;padding:24px;font-size:12px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;color:#3d0044}.sub{color:#777;margin-bottom:14px}.res{display:flex;gap:10px}.res div{flex:1;border:1px solid #ddd;border-radius:8px;padding:10px}.res b{display:block;font-size:16px;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f3f4f6}.r{text-align:right;white-space:nowrap}.g{color:#059669}.p{color:#dc2626}@media print{@page{margin:12mm}}</style></head><body>'
        + '<h1>Relatório financeiro — ' + _lbl(ym) + '</h1><div class="sub">Gerado em ' + dataBR(hojeISO()) + ' • Finanças Pro</div>'
        + '<div class="res"><div>Receitas<b class="g">' + brl(d.rec) + '</b></div><div>Despesas<b class="p">' + brl(d.desp) + '</b></div><div>Saldo<b>' + brl(d.saldo) + '</b></div></div>'
        + '<h2>Gastos por categoria</h2>' + tab(['Categoria', 'Total'], ord(d.cat).map(([k, v]) => [k, brl(v)]))
        + '<h2>Gastos por forma de pagamento</h2>' + tab(['Forma', 'Total'], ord(d.forma).map(([k, v]) => [k, brl(v)]))
        + '<h2>Extrato do mês</h2>' + tab(['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'], d.linhas.map(m => [dataBR(m.data), m.desc || '', m.cat || '', m.tipo === 'entrada' ? 'Receita' : 'Despesa', (m.tipo === 'entrada' ? '' : '-') + brl(m.valor)])) + '</body></html>';
    imprimirHTML(html); avisar('Na janela que abrir, escolha "Salvar como PDF"');
}

// ---------- Backup semanal ----------
const DIAS_BACKUP = 7;
function backupAtrasado() { const ub = dados.config.ultimoBackup; return dados.movs.length > 5 && (!ub || Date.now() - ub > DIAS_BACKUP * 864e5); }
function lembrarBackupSemanal() {
    if (ehVisitante() || !backupAtrasado() || document.getElementById('tela-pin') || (document.getElementById('tela-login') || {}).style && document.getElementById('tela-login').style.display !== 'none') return;
    const hoje = hojeISO(); if (dados.config.backupLembradoEm === hoje) return;
    dados.config.backupLembradoEm = hoje; persistir();
    const ub = dados.config.ultimoBackup, dias = ub ? Math.floor((Date.now() - ub) / 864e5) : null;
    modalDin('modalBackupSemanal', '<div class="modal-body p-4 text-center"><i class="fas fa-floppy-disk fs-1 mb-2" style="color:var(--purple)"></i><h5 class="fw-bold">Hora do backup semanal</h5><p class="text-muted small">' + (dias === null ? 'Você ainda não exportou nenhum backup.' : 'Seu último backup foi há ' + dias + ' dias.') + ' Guarde o arquivo no Drive, iCloud ou WhatsApp para não perder seus dados.</p><button class="btn btn-purple w-100 py-2 text-white fw-bold rounded-4 mb-2" style="background:var(--purple)" onclick="exportarBackup();bootstrap.Modal.getInstance(document.getElementById(\'modalBackupSemanal\')).hide()">Exportar agora</button><button class="btn btn-link text-muted" data-bs-dismiss="modal">Lembrar depois</button></div>').show();
}

// ---------- Instalar no celular ----------
function abrirInstalarApp() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    modalDin('modalInstalar', '<div class="modal-body p-4"><h5 class="fw-bold mb-3"><i class="fas fa-mobile-screen me-2"></i>Instalar no celular</h5>'
        + '<div class="mb-3' + (ios ? ' fw-semibold' : '') + '"><b><i class="fab fa-apple me-1"></i> iPhone / iPad</b><ol class="small mb-0 ps-3"><li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> <i class="fas fa-arrow-up-from-bracket"></i>.</li><li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li></ol></div>'
        + '<div><b><i class="fab fa-android me-1"></i> Android</b><ol class="small mb-0 ps-3"><li>Abra no <b>Chrome</b>.</li><li>Toque em <b>⋮</b> e depois em <b>Instalar app</b> (ou Adicionar à tela inicial).</li></ol></div>'
        + '<p class="small text-muted mt-3 mb-0">Depois de instalado, abre em tela cheia, como um app, e funciona sem internet.</p></div>').show();
}

// ---------- Avisos / notificações ----------
const AV_IC = { erro: 'fa-circle-exclamation text-danger', aviso: 'fa-triangle-exclamation text-warning', cartao: 'fa-credit-card', grafico: 'fa-chart-pie', backup: 'fa-floppy-disk' };
function _quando(p, hoje) { const d = Math.round((p - hoje) / 864e5); return d === 0 ? 'HOJE' : d === 1 ? 'AMANHÃ' : ''; }
function coletarAvisos() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const av = [];
    const lim = d => new Date(hoje.getTime() + (parseInt(d.lembrete) || 3) * 864e5);
    const venceTxt = (d, p, dt) => { const q = _quando(p, hoje); return '[aviso] ' + (d.tipo === 'eu-devo' ? 'A PAGAR' : 'A RECEBER') + (q ? ' ' + q : '') + ': ' + d.nome + (q === 'HOJE' ? ' vence hoje (' + dt + ')' : q === 'AMANHÃ' ? ' vence amanhã (' + dt + ')' : ' vence ' + dt); };
    dados.dividas.filter(d => d.rec).forEach(d => ocorrenciasRec(d, hojeISO().substring(0, 7)).filter(o => !o.pago).forEach(o => {
        const p = new Date(o.data + 'T00:00:00'), dt = o.data.split('-').reverse().join('/');
        if (p < hoje) av.push('[erro] ' + (d.tipo === 'eu-devo' ? 'VENCIDA' : 'ATRASADO') + ': ' + d.nome + ' (' + dt + ')');
        else if (p <= lim(d)) av.push(venceTxt(d, p, dt));
    }));
    dados.dividas.filter(d => !d.rec).forEach(d => {
        if (!d.prazo) return;
        const p = new Date(d.prazo + 'T00:00:00'), dt = d.prazo.split('-').reverse().join('/');
        if (p < hoje) av.push('[erro] VENCIDA: ' + d.nome + ' (' + dt + ')');
        else if (p <= lim(d)) av.push(venceTxt(d, p, dt));
    });
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence); if (!v || c.tipo === 'Débito') return;
        for (let i = 0; i <= 3; i++) { const x = new Date(hoje); x.setDate(x.getDate() + i); if (x.getDate() === v) { av.push('[cartao] Fatura do ' + c.nome + (i === 0 ? ' vence HOJE (dia ' + v + ')' : i === 1 ? ' vence AMANHÃ (dia ' + v + ')' : ' vence dia ' + v)); break; } }
    });
    const ym = _mesSel(), r = saldoMesDe(ym);
    if (r.e > 0 && r.s > r.e * 0.8) av.push('[grafico] Você já gastou ' + Math.round(r.s / r.e * 100) + '% das receitas de ' + _lbl(ym) + '.');
    const gasto = gastoPorCategoria(ym);
    Object.entries(dados.orcamentos || {}).forEach(([c, l]) => { const p = (gasto[c] || 0) / l * 100; if (p >= 100) av.push('[erro] Orçamento estourado em ' + c + ' (' + Math.round(p) + '%)'); else if (p >= 80) av.push('[aviso] ' + c + ': ' + Math.round(p) + '% do orçamento'); });
    if (backupAtrasado()) av.push('[backup] Faça seu backup semanal: Menu → Exportar Dados.');
    return av;
}
function _hashAv(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'a' + h.toString(36); }
function avisosLista() { // avisos atuais, sem os excluídos, com a marca de lida
    const cfg = dados.config; cfg.avisosLidos = cfg.avisosLidos || {}; cfg.avisosExcluidos = cfg.avisosExcluidos || {};
    const todos = coletarAvisos().map(s => ({ id: _hashAv(s), tipo: (s.match(/^\[(\w+)\]/) || [])[1] || 'aviso', texto: s.replace(/^\[\w+\]\s*/, '') }));
    const ids = new Set(todos.map(x => x.id));
    [cfg.avisosLidos, cfg.avisosExcluidos].forEach(o => Object.keys(o).forEach(k => { if (!ids.has(k)) delete o[k]; }));
    return todos.filter(x => !cfg.avisosExcluidos[x.id]).map(x => ({ ...x, lida: !!cfg.avisosLidos[x.id] }));
}
function atualizarBadges() {
    const n = avisosLista().filter(x => !x.lida).length;
    ['hero-badge', 'fp-badge'].forEach(id => { const b = document.getElementById(id); if (b) { b.innerText = n; b.classList.toggle('d-none', n === 0); } });
}
function _avMudou() { persistir(); atualizarBadges(); abrirNotificacoes(); }
function avisoAlternarLida(id) { const o = dados.config.avisosLidos; if (o[id]) delete o[id]; else o[id] = 1; _avMudou(); }
function avisoExcluir(id) { dados.config.avisosExcluidos[id] = 1; _avMudou(); }
function avisosLerTodos() { avisosLista().forEach(x => { dados.config.avisosLidos[x.id] = 1; }); _avMudou(); }
function avisosLimparTodos() { if (!confirm('Excluir todas as notificações?')) return; avisosLista().forEach(x => { dados.config.avisosExcluidos[x.id] = 1; }); _avMudou(); }
function abrirNotificacoes() {
    const a = avisosLista(), nao = a.filter(x => !x.lida).length;
    const corpo = a.length ? a.map(x => '<div class="aviso-item' + (x.lida ? ' lida' : '') + '"><i class="fas ' + (AV_IC[x.tipo] || AV_IC.aviso) + '"></i><span class="av-txt">' + (x.lida ? '' : '<i class="av-dot"></i>') + escaparHTML(x.texto) + '</span>'
        + '<button type="button" class="av-btn" title="' + (x.lida ? 'Marcar como não lida' : 'Marcar como lida') + '" onclick="avisoAlternarLida(\'' + x.id + '\')"><i class="fas ' + (x.lida ? 'fa-envelope' : 'fa-envelope-open') + '"></i></button>'
        + '<button type="button" class="av-btn del" title="Excluir" onclick="avisoExcluir(\'' + x.id + '\')"><i class="fas fa-trash"></i></button></div>').join('')
        : '<div class="text-center text-muted py-3"><i class="fas fa-circle-check text-success fs-3 d-block mb-2"></i>Tudo sob controle. Nenhuma notificação.</div>';
    const acoes = a.length ? '<div class="d-flex gap-2 mb-3"><button class="btn btn-sm btn-outline-secondary flex-fill" onclick="avisosLerTodos()"' + (nao ? '' : ' disabled') + '><i class="fas fa-check-double me-1"></i>Marcar todas como lidas</button><button class="btn btn-sm btn-outline-danger flex-fill" onclick="avisosLimparTodos()"><i class="fas fa-broom me-1"></i>Limpar todas</button></div>' : '';
    modalDin('modalAvisos', '<div class="modal-body p-4"><h5 class="fw-bold mb-3"><i class="fas fa-bell me-2"></i>Notificações' + (nao ? ' <span class="badge bg-danger rounded-pill fs-6">' + nao + '</span>' : '') + '</h5>' + acoes + corpo + '</div>').show();
}

/* ===================================================================
   14. CALCULADORA
   Ícone no topo → painel flutuante → bolha. Arrastar até o X guarda no topo.
   =================================================================== */
let calcExpressao = '', _calcEst = 'docked';
function calcAdd(v) {
    const d = document.getElementById('calc-display');
    if (d.value === '0' && v !== '.') calcExpressao = '';
    calcExpressao += v; d.value = calcExpressao;
}
function calcLimpar() { calcExpressao = ''; document.getElementById('calc-display').value = '0'; }
function calcApagar() { calcExpressao = calcExpressao.slice(0, -1); document.getElementById('calc-display').value = calcExpressao || '0'; }
function calcResultado() {
    if (!calcExpressao) return;
    const d = document.getElementById('calc-display');
    try {
        if (/[^0-9+\-*/.()]/.test(calcExpressao)) throw new Error('inválido');
        let r = Function('"use strict"; return (' + calcExpressao + ')')();
        if (typeof r !== 'number' || !isFinite(r)) throw new Error('erro');
        if (!Number.isInteger(r)) r = parseFloat(r.toFixed(2));
        d.value = r; calcExpressao = String(r);
    } catch (e) { d.value = 'Erro'; calcExpressao = ''; }
}
function _calcEls() { return { c: document.getElementById('calc-container'), b: document.getElementById('calc-bolha'), x: document.getElementById('calc-alvo') }; }
function setCalc(est) {
    _calcEst = est; const { c, b } = _calcEls();
    c.style.display = est === 'aberta' ? 'flex' : 'none'; b.style.display = est === 'bolha' ? 'flex' : 'none';
    document.querySelectorAll('.calc-dock-btn').forEach(e => e.classList.toggle('d-none', est !== 'docked'));
}
const _cl = (v, mx) => Math.max(4, Math.min(v, mx));
function abrirCalcFlutuante() {
    const { c } = _calcEls(); c.style.display = 'flex';
    if (!c.dataset.posicionada) { c.style.left = _cl(innerWidth - c.offsetWidth - 16, innerWidth - c.offsetWidth - 4) + 'px'; c.style.top = '84px'; c.style.right = 'auto'; c.dataset.posicionada = 1; }
    setCalc('aberta');
}
function minimizarCalc() { const { c, b } = _calcEls(), r = c.getBoundingClientRect(); b.style.left = _cl(r.right - 52, innerWidth - 56) + 'px'; b.style.top = _cl(r.top, innerHeight - 56) + 'px'; setCalc('bolha'); }
function restaurarCalc() { const { c, b } = _calcEls(), r = b.getBoundingClientRect(); c.style.left = _cl(r.right - c.offsetWidth, innerWidth - c.offsetWidth - 4) + 'px'; c.style.top = _cl(r.top, innerHeight - c.offsetHeight - 4) + 'px'; setCalc('aberta'); }
function acoplarCalc() { setCalc('docked'); }
function toggleCalculadora() { if (_calcEst === 'aberta') minimizarCalc(); else abrirCalcFlutuante(); }
function arrastavel(el, handle, aoClicar) { // funciona com mouse e toque
    let ativo = false, mov = false, sx, sy, ox, oy; const alvo = () => document.getElementById('calc-alvo');
    const noX = (px, py) => { const r = alvo().getBoundingClientRect(); return px >= r.left - 20 && px <= r.right + 20 && py >= r.top - 20 && py <= r.bottom + 20; };
    handle.addEventListener('pointerdown', e => { if (handle !== el && e.target.closest('button')) return; ativo = true; mov = false; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', e => {
        if (!ativo) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (!mov && Math.hypot(dx, dy) < 6) return;
        if (!mov) { mov = true; alvo().style.display = 'flex'; }
        el.style.left = _cl(ox + dx, innerWidth - el.offsetWidth - 4) + 'px'; el.style.top = _cl(oy + dy, innerHeight - 60) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
        alvo().classList.toggle('ativo', noX(e.clientX, e.clientY));
    });
    const fim = e => { if (!ativo) return; ativo = false; const sobre = mov && noX(e.clientX, e.clientY); alvo().style.display = 'none'; alvo().classList.remove('ativo'); if (sobre) acoplarCalc(); else if (!mov && aoClicar) aoClicar(); };
    handle.addEventListener('pointerup', fim); handle.addEventListener('pointercancel', fim);
}
function iniciarCalculadora() {
    const { c } = _calcEls(); if (!c) return;
    if (!document.getElementById('calc-bolha')) { const b = document.createElement('button'); b.id = 'calc-bolha'; b.setAttribute('aria-label', 'Calculadora'); b.innerHTML = '<i class="fas fa-calculator"></i>'; document.body.appendChild(b); }
    if (!document.getElementById('calc-alvo')) { const x = document.createElement('div'); x.id = 'calc-alvo'; x.innerHTML = '<i class="fas fa-xmark"></i><small>Guardar no topo</small>'; document.body.appendChild(x); }
    const b = document.getElementById('calc-bolha'), hd = document.getElementById('calc-header'), ctl = hd.querySelector('.calc-controls');
    if (ctl && !ctl.querySelector('[data-guardar]')) { const k = document.createElement('button'); k.type = 'button'; k.dataset.guardar = 1; k.title = 'Guardar no topo'; k.innerHTML = '<i class="fas fa-xmark"></i>'; k.onclick = acoplarCalc; ctl.appendChild(k); }
    hd.style.touchAction = 'none'; b.style.touchAction = 'none';
    arrastavel(c, hd); arrastavel(b, b, restaurarCalc);
    setCalc('docked');
}

/* ===================================================================
   15. TEMA, PIN, BACKUP E CALENDÁRIO
   =================================================================== */
function aplicarTema() {
    const dark = !!dados.config.dark;
    document.body.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.tema-ic').forEach(i => { i.classList.toggle('fa-moon', !dark); i.classList.toggle('fa-sun', dark); });
}
function toggleTema() { dados.config.dark = !dados.config.dark; aplicarTema(); persistir(); }
function aplicarVisibilidade() {
    const o = !!dados.config.oculto;
    document.body.classList.toggle('values-hidden', o);
    document.querySelectorAll('.olho-ic').forEach(i => { i.classList.toggle('fa-eye', !o); i.classList.toggle('fa-eye-slash', o); });
}
function toggleVisibilidade() { dados.config.oculto = !dados.config.oculto; aplicarVisibilidade(); persistir(); }
function aplicarCorApp() {
    const v = localStorage.getItem('fp_cor') || ''; document.documentElement.dataset.cor = v;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = v === 'verde' ? '#16a34a' : '#57005F'; }); // barra do sistema acompanha o tema
    atualizarTopo();
}
// abrir o menu (⋮) não pode mexer na rolagem da tela
let _yDrop = null;
document.addEventListener('pointerdown', e => { if (e.target.closest('[data-bs-toggle="dropdown"]')) _yDrop = window.scrollY; }, true);
document.addEventListener('shown.bs.dropdown', () => {
    const y = _yDrop; if (y === null) return;
    const volta = () => { if (Math.abs(window.scrollY - y) > 4) window.scrollTo(0, y); };
    volta(); requestAnimationFrame(volta); setTimeout(volta, 80); setTimeout(volta, 250);
});
document.addEventListener('hidden.bs.dropdown', () => { _yDrop = null; });
function alternarCorApp() {
    const v = document.documentElement.dataset.cor === 'verde' ? '' : 'verde';
    try { localStorage.setItem('fp_cor', v); } catch (e) { }
    aplicarCorApp(); avisar(v ? 'Tema verde ativado.' : 'Tema roxo (padrão) ativado.');
}

// ---------- PIN de bloqueio ----------
const _pinH = p => hashSenha(p, 'pin-fp');
function bloquearApp() {
    if (!dados.config || !dados.config.pin || ehVisitante() || document.getElementById('tela-pin')) return;
    const d = document.createElement('div'); d.id = 'tela-pin';
    d.style.cssText = 'position:fixed;inset:0;z-index:30000;background:linear-gradient(135deg,#3d0044,#57005F);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;padding:24px';
    d.innerHTML = '<i class="fas fa-lock fa-2x"></i><h5 class="fw-bold">Finanças Pro bloqueado</h5><input id="pin-in" type="password" inputmode="numeric" maxlength="8" class="form-control text-center fs-4" style="max-width:220px;letter-spacing:.4em" placeholder="PIN"><button class="btn btn-light fw-bold px-5" id="pin-ok">Desbloquear</button>';
    document.body.appendChild(d);
    const inp = document.getElementById('pin-in');
    const tentar = async () => { if (await _pinH(inp.value) === dados.config.pin) d.remove(); else { erro('PIN incorreto!'); inp.value = ''; } };
    document.getElementById('pin-ok').onclick = tentar; inp.addEventListener('keydown', e => { if (e.key === 'Enter') tentar(); }); inp.focus();
}
async function configurarPin() {
    if (!verificarAcesso()) return;
    if (dados.config.pin && await _pinH(prompt('Digite o PIN atual:') || '') !== dados.config.pin) return erro('PIN incorreto!');
    const n = (prompt('Novo PIN (4 a 8 números). Deixe vazio para remover o bloqueio:') || '').trim();
    if (!n) { delete dados.config.pin; salvarERender(); return avisar('Bloqueio por PIN removido.'); }
    if (!/^\d{4,8}$/.test(n)) return erro('Informe de 4 a 8 números.');
    dados.config.pin = await _pinH(n); salvarERender(); avisar('PIN definido! O app bloqueia ao abrir e após 30 s em segundo plano.');
}
let _ocultoEm = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) _ocultoEm = Date.now(); else if (_ocultoEm && Date.now() - _ocultoEm > 30000) bloquearApp(); });

// ---------- Backup e importação ----------
function exportarBackup() {
    dados.config.ultimoBackup = Date.now(); persistir();
    baixarArquivo(JSON.stringify({ ...dados, notas, _exportadoEm: new Date().toISOString() }), 'backup_financas_' + hojeISO() + '.json', 'application/json');
    atualizarBadges();
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
                const nn = Array.isArray(n.notas) ? n.notas : null; delete n.notas; delete n._exportadoEm;
                const ok = normalizarDados(n);
                if (!confirm('Importar ' + ok.movs.length + ' lançamentos? Isso SUBSTITUI todos os dados atuais deste aparelho.')) return;
                localStorage.setItem(CHAVE_DADOS, JSON.stringify(ok));
                if (nn) localStorage.setItem(CHAVE_NOTAS, JSON.stringify(nn));
                location.reload();
            } catch (err) { erro('Arquivo inválido! Use um backup exportado pelo próprio app.'); }
        };
        rd.readAsText(f);
    };
    inp.click();
}

// ---------- Calendário (.ics: importa no Google/Apple/Outlook; UIDs fixos evitam duplicar ao reimportar) ----------
function _icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n'); }
function _icsDia(s, n) { const [a, m, d] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().substring(0, 10).replace(/-/g, ''); }
function baixarCalendario(somenteId) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z', L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Financas Pro//PT', 'CALSCALE:GREGORIAN'];
    const ev = (uid, data, titulo, desc, rr) => L.push('BEGIN:VEVENT', 'UID:' + uid + '@financaspro', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + _icsDia(data, 0), 'DTEND;VALUE=DATE:' + _icsDia(data, 1), 'SUMMARY:' + _icsEsc(titulo), 'DESCRIPTION:' + _icsEsc(desc), ...(rr ? ['RRULE:' + rr] : []), 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + _icsEsc(titulo), 'END:VALARM', 'END:VEVENT');
    let n = 0;
    dados.dividas.filter(d => d.rec && (!somenteId || d.id === somenteId)).forEach(d => diasRec(d).forEach(dia => {
        const h = hojeISO(), ym = h.substring(0, 7), ult = new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate(), dt = ym + '-' + String(Math.min(dia, ult)).padStart(2, '0');
        ev('divida-rec-' + d.id + '-' + dia, dt, (d.tipo === 'eu-devo' ? 'Pagar: ' : 'Receber: ') + d.nome + ' — ' + brl(d.valor), d.desc || '', 'FREQ=MONTHLY;BYMONTHDAY=' + dia); n++;
    }));
    dados.dividas.filter(d => !d.rec && d.prazo && (!somenteId || d.id === somenteId)).forEach(d => {
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
    if (!n) return erro('Nenhuma dívida com prazo para sincronizar.');
    L.push('END:VCALENDAR');
    baixarArquivo(L.join('\r\n'), 'financas_calendario.ics', 'text/calendar');
}
function eventoCalendarioDivida(id) { baixarCalendario(Number(id)); }

/* ===================================================================
   16. INICIALIZAÇÃO
   =================================================================== */
function iniciarApp() {
    // migração: remove do extrato os lançamentos antigos gerados por metas (continuam no histórico da meta)
    if (!dados.migr2 && !ehVisitante()) {
        dados.movs = dados.movs.filter(m => !dados.metas.some(x => m.desc === 'Poupança: ' + x.nome || m.desc === 'Resgate: ' + x.nome));
        dados.migr2 = true; persistir();
    }
    // máscaras de moeda
    ['mov-valor', 'card-limite', 'card-anuidade', 'compra-valor', 'div-valor', 'pag-valor', 'meta-objetivo', 'revenda-vlr-compra', 'revenda-vlr-venda'].forEach(id => {
        const el = document.getElementById(id); if (el) el.addEventListener('input', mascaraMoeda);
    });
    // categorias do lançamento
    const t = document.getElementById('mov-tipo'), c = document.getElementById('mov-cat');
    t.addEventListener('change', () => { popularCategorias(t.value, null); toggleCartaoMov(); }); // entrada não usa cartão
    c.addEventListener('change', () => {
        if (c.value !== '__nova__') return;
        const n = (prompt('Nome da nova categoria:') || '').trim().slice(0, 30), l = cats()[t.value === 'entrada' ? 'entrada' : 'saida'];
        if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); salvarERender(); }
        popularCategorias(t.value, n || null);
    });
    popularCategorias(t.value, null);
    const forma = document.getElementById('mov-forma'); if (forma) forma.addEventListener('change', toggleCartaoMov);
    const nomeCard = document.getElementById('card-nome'); if (nomeCard) nomeCard.addEventListener('input', detectarBanco);
    const emp = document.getElementById('compra-emprestado'); if (emp) emp.addEventListener('change', togglePessoa);
    ['compra-valor', 'compra-parcelas', 'compra-data', 'compra-fixa'].forEach(i => { const e = document.getElementById(i); if (e) { e.addEventListener('input', previewCompra); e.addEventListener('change', previewCompra); } });
    const mm = document.getElementById('modalMeta');
    if (mm) mm.addEventListener('show.bs.modal', () => { const i = document.getElementById('meta-data-inicio'); if (i && !i.value) i.value = hojeISO(); });
    // dívidas: busca e filtro
    const bd = document.getElementById('busca-divida'); if (bd) bd.addEventListener('input', e => { buscaDividaAtual = e.target.value.toLowerCase(); renderDividas(); });
    const fo = document.getElementById('filtro-ordenar-divida'); if (fo) fo.addEventListener('change', e => tratarFiltroEOrdenacao(e.target.value));
    // login: Enter envia
    ['user-login', 'pass-login'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); }); });
    // botão X em todas as janelas
    document.querySelectorAll('.modal-content').forEach(m => {
        if (m.classList.contains('frm') || m.querySelector('.btn-close')) return; // formulários já têm o próprio X
        const x = document.createElement('button'); x.type = 'button'; x.className = 'btn-close fp-x'; x.setAttribute('data-bs-dismiss', 'modal'); x.setAttribute('aria-label', 'Fechar'); m.prepend(x);
    });
    document.addEventListener('hidden.bs.modal', () => setTimeout(limparFundosPresos, 80));
    document.addEventListener('click', e => { if (navigator.vibrate && e.target.closest('.nav-btn,.acao-rapida,.btn-add-main,.btn')) navigator.vibrate(8); });
    document.getElementById('fab-add').onclick = () => { const f = FAB_ACOES[_secAtual]; if (f) f(); };

    // sessão, tema e preferências
    if (!usuarioAtivo && localStorage.getItem('user_lembrado')) { usuarioAtivo = localStorage.getItem('user_lembrado'); sessionStorage.setItem('user_ativo', usuarioAtivo); }
    if (usuarioAtivo === 'visitante') { dados = novoDados(); notas = []; }
    if (usuarioAtivo) { document.getElementById('tela-login').style.display = 'none'; atualizarNomeUsuarioTela(usuarioAtivo); }
    else atualizarNomeUsuarioTela('Visitante');
    aplicarTema(); aplicarVisibilidade(); aplicarCorApp();
    mesAtual = hojeISO().substring(0, 7);
    if (usuarioAtivo) { limparHistoricoAntigo(); processarLancamentosFixos(); }

    iniciarCalculadora(); iniciarFormularios();
    document.body.classList.add('na-home');
    showSection('inicio');
    renderTudo();
    bloquearApp();
    setTimeout(lembrarBackupSemanal, 2500);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.addEventListener('DOMContentLoaded', iniciarApp);
