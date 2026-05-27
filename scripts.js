// Dados e Inicialização com Proteção contra erros
let dados;
try {
    const salvos = localStorage.getItem('financas_pro_max');
    dados = (salvos && salvos !== "undefined") ? JSON.parse(salvos) : {
        movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], config: { dark: false, oculto: false }
    };
} catch (err) {
    console.error("Falha ao ler localStorage, resetando dados:", err);
    dados = { movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], config: { dark: false, oculto: false } };
}
let usuarioAtivo = sessionStorage.getItem('user_ativo') || localStorage.getItem('user_lembrado') || null;
let filtroAtual = 'todos';
let buscaAtual = ''; // Nova variável para busca
let cartaoContexto = null;
let meuGrafico = null; // Nova variável para o gráfico
// --- FUNÇÕES DE LOGIN E AUTENTICAÇÃO ---

function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function toggleAuth(mode) {
    document.getElementById('login-form').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('recovery-form').style.display = mode === 'recovery' ? 'block' : 'none';
    
    if(mode === 'recovery') {
        document.getElementById('step-1-recovery').style.display = 'block';
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'none';
    }
}

function cadastrarUsuario() {
    const u = document.getElementById('user-reg').value.trim();
    const p = document.getElementById('pass-reg').value.trim();
    const q = document.getElementById('pergunta-reg').value;
    const r = document.getElementById('resposta-reg').value.trim().toLowerCase();

    if(!u || !p || !r) return alert("Preencha todos os campos!");

    localStorage.setItem('financas_auth', JSON.stringify({ user: u, pass: p, pergunta: q, resposta: r }));
    alert("Conta criada com sucesso!");
    toggleAuth('login');
}

function fazerLogin() {
    const u = document.getElementById('user-login').value.trim();
    const p = document.getElementById('pass-login').value.trim();
    const lembrar = document.getElementById('lembrar-login').checked;
    const authRaw = localStorage.getItem('financas_auth');

    if (!authRaw) {
        alert("Nenhuma conta encontrada! Por favor, cadastre-se.");
        return;
    }

    const auth = JSON.parse(authRaw);

    if(u === auth.user && p === auth.pass) {
        if(lembrar) localStorage.setItem('user_lembrado', u);
        sessionStorage.setItem('user_ativo', u);
        document.getElementById('tela-login').style.display = 'none';
        renderTudo();
    } else {
        alert("Usuário ou senha incorretos!");
    }
}
function verificarUsuarioRecuperacao() {
    const u = document.getElementById('user-rec').value.trim();
    const auth = JSON.parse(localStorage.getItem('financas_auth'));

    if(auth && u === auth.user) {
        document.getElementById('txt-pergunta-exibida').innerText = auth.pergunta;
        document.getElementById('step-1-recovery').style.display = 'none';
        document.getElementById('step-2-recovery').style.display = 'block';
    } else {
        alert("Usuário não encontrado!");
    }
}

function validarRespostaSeguranca() {
    const r = document.getElementById('resposta-rec').value.trim().toLowerCase();
    const auth = JSON.parse(localStorage.getItem('financas_auth'));

    if(auth && r === auth.resposta) {
        document.getElementById('step-2-recovery').style.display = 'none';
        document.getElementById('step-3-recovery').style.display = 'block';
    } else {
        alert("Resposta incorreta!");
    }
}

function redefinirSenha() {
    const novaP = document.getElementById('nova-pass-rec').value.trim();
    if(!novaP) return alert("Digite a nova senha!");

    let auth = JSON.parse(localStorage.getItem('financas_auth'));
    auth.pass = novaP;
    localStorage.setItem('financas_auth', JSON.stringify(auth));

    alert("Senha alterada! Faça login novamente.");
    toggleAuth('login');
}

function entrarVisitante() {
    sessionStorage.setItem('user_ativo', 'visitante');
    document.getElementById('tela-login').style.display = 'none';
    renderTudo();
}

function verificarAcesso() {
    if(sessionStorage.getItem('user_ativo') === 'visitante') {
        alert("Crie uma conta para salvar seus dados!");
        return false;
    }
    return true;
}

// --- NAVEGAÇÃO ---

function showSection(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    window.scrollTo(0,0);

    // Se abrir a aba de gráficos, força a renderização dele
    if(id === 'aba-graficos') {
        renderGraficoRank();
    }
    // Se abrir a lixeira, renderiza os itens deletados
    if(id === 'lixeira') {
        renderLixeira();
    }
}

// --- MOVIMENTAÇÕES ---

function abrirModalMov(id = null) {
    if(id) {
        const m = dados.movs.find(x => x.id == id);
        document.getElementById('mov-id-edit').value = m.id;
        document.getElementById('mov-desc').value = m.desc;
        // Garante que o valor venha formatado exatamente como a máscara espera
document.getElementById('mov-valor').value = m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('mov-tipo').value = m.tipo;
        document.getElementById('mov-cat').value = m.cat;
        document.getElementById('mov-data').value = m.data;
document.getElementById('mov-fixo').checked = m.fixo || false; // <-- Adicione esta linha
document.getElementById('modalMovTitulo').innerText = "Editar Lançamento";
        document.getElementById('btn-excluir-mov').classList.remove('d-none');
    } else {
        // CORREÇÃO: Limpando todos os campos para não herdar dados do gasto anterior
        document.getElementById('mov-id-edit').value = "";
        document.getElementById('mov-desc').value = "";
        document.getElementById('mov-valor').value = "";
        document.getElementById('mov-tipo').value = "saida";
        document.getElementById('mov-cat').value = "Outros";
        document.getElementById('mov-data').value = new Date().toISOString().split('T')[0];
document.getElementById('mov-fixo').checked = false; // <-- Adicione esta linha para começar desmarcado
document.getElementById('modalMovTitulo').innerText = "Novo Lançamento";
        document.getElementById('btn-excluir-mov').classList.add('d-none');
    }
}
function abrirAjusteSaldo(tipo) {
    if(!verificarAcesso()) return;
    abrirModalMov();
    document.getElementById('mov-tipo').value = tipo;
    document.getElementById('mov-desc').value = "Ajuste de Saldo";
    document.getElementById('modalMovTitulo').innerText = tipo === 'entrada' ? "Nova Entrada" : "Nova Saída";
    
    // Forma correta de abrir sem duplicar instâncias
    const modalElement = document.getElementById('modalMov');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.show();
}


function salvarMov() {
    if(!verificarAcesso()) return;
    
    const idEdit = document.getElementById('mov-id-edit').value;
    const valorRaw = document.getElementById('mov-valor').value;
    
    // Converte o valor da máscara (ex: 1.500,50) para número real (1500.50)
    const valorLimpo = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

            const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    const mov = {
    id: idEdit ? Number(idEdit) : Date.now(), // Garante que o ID salvo seja sempre um Number
    desc: document.getElementById('mov-desc').value,
    valor: valorLimpo,
    tipo: document.getElementById('mov-tipo').value,
    cat: document.getElementById('mov-cat').value,
    data: document.getElementById('mov-data').value || agora.toISOString().split('T')[0],
    hora: idEdit ? dados.movs.find(m => m.id == idEdit).hora : horaAtual,
    fixo: document.getElementById('mov-fixo').checked // <-- Nova linha
};

    if(!mov.desc || isNaN(mov.valor)) return alert("Preencha os campos corretamente!");
    
    const idx = dados.movs.findIndex(m => m.id == mov.id);
    if(idx > -1) dados.movs[idx] = mov; else dados.movs.push(mov);
    
    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalMov')).hide();
}
function moverMovParaLixeira() {
    const id = document.getElementById('mov-id-edit').value;
    if(!id) return;
    if(confirm("Deseja enviar para a lixeira?")) {
        const idx = dados.movs.findIndex(m => m.id == id);
        const item = dados.movs.splice(idx, 1)[0];
        item.origem = 'movs';
        dados.lixeira.push(item);
        salvarERender();
        bootstrap.Modal.getInstance(document.getElementById('modalMov')).hide();
    }
}
function renderLixeira() {
    const lista = document.getElementById('lista-lixeira');
    if (!lista) return;

    lista.innerHTML = dados.lixeira.length ? dados.lixeira.map(m => `
        <div class="card-mov opacity-75">
            <div class="icon-box bg-secondary text-white">
                <i class="fas fa-trash-restore"></i>
            </div>
            <div class="flex-grow-1">
                <div class="fw-bold text-decoration-line-through">${m.desc}</div>
                <small class="text-muted">Deletado em: ${new Date().toLocaleDateString()}</small>
            </div>
            <div class="text-end">
                <button class="btn btn-sm btn-outline-success border-0" onclick="restaurarDaLixeira(${m.id})">
                    <i class="fas fa-undo"></i>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-center text-muted py-4">A lixeira está vazia.</p>';
}

function restaurarDaLixeira(id) {
    const idNumerico = Number(id);
    const idx = dados.lixeira.findIndex(m => m.id === idNumerico);
    if (idx > -1) {
        const item = dados.lixeira.splice(idx, 1)[0];
        const destino = item.origem || 'movs'; 
        
        delete item.origem;
        if (destino === 'cartoes') delete item.desc; 

        if (dados[destino]) {
            dados[destino].push(item);
        }
        
        salvarERender(); 
        renderLixeira();
    }
}
function esvaziarLixeira() {
    if (confirm("Tem certeza que deseja apagar permanentemente todos os itens da lixeira?")) {
        dados.lixeira = [];
        salvarERender();
        renderLixeira();
    }
}

function setFiltro(f) {
    filtroAtual = f;
    renderExtrato();
}

// Função para atualizar a variável de busca e renderizar a lista
function filtrarBusca(valor) {
    buscaAtual = valor.toLowerCase();
    renderExtrato();
}

// --- CARTÕES ---

function abrirModalCartao(id = null) {
    if(!verificarAcesso()) return;
    if(id) {
        const c = dados.cartoes.find(x => x.id == id);
        document.getElementById('card-id-edit').value = c.id;
        document.getElementById('card-nome').value = c.nome;
        document.getElementById('card-limite').value = c.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('card-bandeira').value = c.bandeira;
        document.getElementById('card-cor-custom').value = c.cor;
        document.getElementById('card-tipo').value = c.tipo;
        document.getElementById('card-fecha').value = c.fecha;
        document.getElementById('card-vence').value = c.vence;
        document.getElementById('btn-excluir-cartao').classList.remove('d-none');
        document.getElementById('modalCartaoTitulo').innerText = "Editar Cartão";
    } else {
        document.getElementById('card-id-edit').value = "";
        document.getElementById('card-nome').value = "";
        document.getElementById('card-limite').value = "";
        document.getElementById('btn-excluir-cartao').classList.add('d-none');
        document.getElementById('modalCartaoTitulo').innerText = "Novo Cartão";
    }
    new bootstrap.Modal(document.getElementById('modalCartao')).show();
}

function addCartao() {
    const idEdit = document.getElementById('card-id-edit').value;
    const card = {
        id: idEdit ? Number(idEdit) : Date.now(), // Normaliza para Number
        nome: document.getElementById('card-nome').value,
        limite: parseFloat(document.getElementById('card-limite').value.replace(/\./g, '').replace(',', '.')) || 0,
        bandeira: document.getElementById('card-bandeira').value,
        cor: document.getElementById('card-cor-custom').value,
        tipo: document.getElementById('card-tipo').value,
        fecha: document.getElementById('card-fecha').value,
        vence: document.getElementById('card-vence').value,
        compras: idEdit ? dados.cartoes.find(x => x.id == idEdit).compras : []
    };
    if(!card.nome || isNaN(card.limite)) return alert("Preencha o nome e limite!");
    
    if(idEdit) {
        const idx = dados.cartoes.findIndex(c => c.id == idEdit);
        dados.cartoes[idx] = card;
    } else {
        dados.cartoes.push(card);
    }
    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalCartao')).hide();
}

function excluirCartaoNoModal() {
    const id = document.getElementById('card-id-edit').value;
    if(confirm("Deseja mover este cartão para a lixeira?")) {
        const idx = dados.cartoes.findIndex(c => c.id == id);
        const item = dados.cartoes.splice(idx, 1)[0];
        item.origem = 'cartoes'; // Identifica para restauração futura
        item.desc = `Cartão: ${item.nome}`; // Nome amigável para aparecer na lixeira
        dados.lixeira.push(item);
        salvarERender();
        bootstrap.Modal.getInstance(document.getElementById('modalCartao')).hide();
    }
}
// --- COMPRAS NO CARTÃO ---
function verCompras(id) {
    cartaoContexto = id;
    const c = dados.cartoes.find(x => x.id == id);
    document.getElementById('titulo-compras-cartao').innerText = `Compras: ${c.nome}`;
    renderComprasCartao();
    showSection('compras-cartao');
}

function abrirModalCompraCartao(id = null) {
    if(id) {
        const c = dados.cartoes.find(x => x.id == cartaoContexto).compras.find(co => co.id == id);
        document.getElementById('compra-id-edit').value = c.id;
        document.getElementById('compra-desc').value = c.desc;
        document.getElementById('compra-valor').value = c.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('compra-parcelas').value = c.parcelas;
        document.getElementById('compra-data').value = c.data;
        document.getElementById('btn-excluir-compra').classList.remove('d-none');
        document.getElementById('modalCompraTitulo').innerText = "Editar Compra";
    } else {
        document.getElementById('compra-id-edit').value = "";
        document.getElementById('compra-desc').value = "";
        document.getElementById('compra-valor').value = "";
        document.getElementById('compra-parcelas').value = 1;
        document.getElementById('compra-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('btn-excluir-compra').classList.add('d-none');
        document.getElementById('modalCompraTitulo').innerText = "Nova Compra";
    }
    new bootstrap.Modal(document.getElementById('modalCompraCartao')).show();
}
function salvarCompraCartao() {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    if (!card) return alert("Erro: Cartão não encontrado.");
    
    const idEditRaw = document.getElementById('compra-id-edit').value;
    const idCompraFinal = idEditRaw ? Number(idEditRaw) : Date.now();
    
    const valorRaw = document.getElementById('compra-valor').value;
    const valorTotal = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;
    const parcelas = parseInt(document.getElementById('compra-parcelas').value) || 1;
    
    const movIdx = dados.movs.findIndex(m => m.idRelacionado === idCompraFinal);
    let idParaMov = movIdx > -1 ? dados.movs[movIdx].id : Date.now() + 1;

    const agora = new Date();
    const horaCompra = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
    const compraAntiga = idEditRaw ? card.compras.find(c => c.id === idCompraFinal) : null;

    const compra = {
        id: idCompraFinal,
        desc: document.getElementById('compra-desc').value.trim(),
        valorTotal: valorTotal,
        parcelas: parcelas,
        data: document.getElementById('compra-data').value || agora.toISOString().split('T')[0],
        hora: compraAntiga ? (compraAntiga.hora || horaCompra) : horaCompra,
        pagamentos: compraAntiga ? (compraAntiga.pagamentos || []) : []
    };

    if (!compra.desc || isNaN(compra.valorTotal) || compra.valorTotal <= 0) {
        return alert("Preencha a descrição e o valor da compra corretamente!");
    }
    
    if(idEditRaw) {
        const idx = card.compras.findIndex(c => c.id === idCompraFinal);
        if(idx > -1) card.compras[idx] = compra;
    } else {
        card.compras.push(compra);
    }

    const valorParcela = parseFloat((valorTotal / parcelas).toFixed(2));
    const descFinal = parcelas > 1 ? `${compra.desc} (1/${parcelas})` : compra.desc;

    const movData = {
        id: idParaMov, 
        idRelacionado: compra.id, 
        desc: descFinal,
        valor: valorParcela,
        tipo: 'saida',
        cat: 'Cartão',
        data: compra.data,
        hora: compra.hora
    };

    if(movIdx > -1) {
        dados.movs[movIdx] = movData;
    } else {
        dados.movs.push(movData);
    }

    salvarERender();
    renderComprasCartao();
    bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
}
function excluirCompraNoModal() {
    const id = document.getElementById('compra-id-edit').value;
    if(!id) return;
    const idNumerico = Number(id); // Garante a tipagem correta antes de filtrar
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    if(confirm("Excluir esta compra?")) {
        card.compras = card.compras.filter(c => c.id !== idNumerico);
        dados.movs = dados.movs.filter(m => m.idRelacionado !== idNumerico);
        salvarERender();
        renderComprasCartao();
        bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
    }
}
function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    const lista = document.getElementById('lista-compras-cartao');
    const info = document.getElementById('info-cartao-detalhe');
    
    let gastoMes = 0;
    card.compras.forEach(c => gastoMes += (c.valorTotal / c.parcelas));
    const perc = (gastoMes / card.limite) * 100;

    info.innerHTML = `
        <div class="card p-3 mb-3 border-0 shadow-sm rounded-4" style="background:${card.cor}; color:white;">
            <div class="d-flex justify-content-between">
                <span>Limite: R$ ${card.limite.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
<span>Uso: R$ ${gastoMes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
            </div>
            <div class="card-limit-box"><div class="card-limit-progress" style="width:${perc}%"></div></div>
            <div class="card-info-row">
                <span>Fechamento: Dia ${card.fecha}</span>
                <span>Vencimento: Dia ${card.vence}</span>
            </div>
        </div>
    `;

        lista.innerHTML = card.compras.map(c => {
        const valorRestante = c.valorTotal - (c.pagamentos ? c.pagamentos.reduce((a, b) => a + b.valor, 0) : 0);
        const statusClass = valorRestante <= 0 ? 'text-success' : 'text-danger';
        
        return `
        <div class="card-mov align-items-start py-3 mb-2 shadow-sm bg-white rounded-3">
            <div class="flex-grow-1 ms-2">
                <div class="fw-bold">${c.desc} ${valorRestante <= 0 ? '<span class="badge bg-success ms-1" style="font-size:0.6rem">PAGO</span>' : ''}</div>
                <small class="text-muted d-block">${c.parcelas}x de R$ ${(c.valorTotal/c.parcelas).toLocaleString('pt-BR', {minimumFractionDigits:2})}</small>
                
                ${c.pagamentos && c.pagamentos.length > 0 ? `
                <div class="mt-2 p-2 bg-light rounded-3 border-start border-info border-3" style="font-size: 0.75rem;">
                    <div class="text-uppercase fw-bold text-muted mb-1" style="font-size: 0.65rem;">Histórico de Pagamentos:</div>
                    ${c.pagamentos.map(p => `<div class="text-dark">→ Pago: R$ ${p.valor.toLocaleString('pt-BR')} em ${p.data} às ${p.hora}</div>`).join('')}
                </div>` : ''}

                <small class="text-muted mt-1 d-block" style="font-size: 0.7rem;">
                    <i class="far fa-calendar-alt me-1"></i>${c.data.split('-').reverse().join('/')} 
                    <i class="far fa-clock ms-2 me-1"></i>${c.hora || '--:--'}
                </small>
            </div>
            <div class="text-end me-2">
                <div class="fw-bold ${statusClass}">
                    R$ ${valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
            </div>
            
            <div class="dropdown">
                <button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                    <li><button class="dropdown-item py-2" onclick="abrirModalCompraCartao(${c.id})">
                        <i class="fas fa-edit text-primary me-2"></i> Editar Compra
                    </button></li>
                    <li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(${c.id}, 'total')">
                        <i class="fas fa-check-circle text-success me-2"></i> Pagamento Total
                    </button></li>
                    <li><button class="dropdown-item py-2" onclick="prepararPagamentoCompra(${c.id}, 'parcial')">
                        <i class="fas fa-coins text-warning me-2"></i> Pagamento Parcial
                    </button></li>
                </ul>
            </div>
        </div>`;
    }).join('') || '<p class="text-center text-muted">Sem compras neste cartão.</p>';}
// --- DÍVIDAS ---

function abrirModalDivida(id = null) {
    if(!verificarAcesso()) return;
    
    if(id) {
        const d = dados.dividas.find(x => x.id == id);
        document.getElementById('div-id-edit').value = d.id;
        document.getElementById('div-tipo').value = d.tipo;
        document.getElementById('div-nome').value = d.nome;
        // Dentro do if(id) da função abrirModalDivida
document.getElementById('div-valor').value = d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('div-desc').value = d.desc;
        document.getElementById('div-whats').value = d.whats;
        document.getElementById('div-inicio').value = d.inicio;
        document.getElementById('div-prazo').value = d.prazo;
        document.getElementById('div-obs').value = d.obs;
        document.getElementById('modalDividaTitulo').innerText = "Editar Registro";
        document.getElementById('btn-excluir-divida').classList.remove('d-none');
    } else {
        document.getElementById('div-id-edit').value = "";
        document.getElementById('div-nome').value = "";
        document.getElementById('div-valor').value = "";
        document.getElementById('div-whats').value = "";
        document.getElementById('div-desc').value = "";
        document.getElementById('div-obs').value = "";
        document.getElementById('div-prazo').value = ""; // Garantindo limpeza
        document.getElementById('div-inicio').value = new Date().toISOString().split('T')[0];
        
        document.getElementById('modalDividaTitulo').innerText = "Novo Registro de Dívida";
        document.getElementById('btn-excluir-divida').classList.add('d-none');
    }
    const modalElement = document.getElementById('modalDivida');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.show();
}

function excluirDivida() {
    const id = document.getElementById('div-id-edit').value;
    if(!id) return;
    if(confirm("Deseja apagar esta dívida permanentemente?")) {
        const idNumerico = Number(id);
        dados.dividas = dados.dividas.filter(d => d.id !== idNumerico);
        salvarERender();
        document.getElementById('div-id-edit').value = "";
        document.getElementById('div-nome').value = "";
        document.getElementById('div-valor').value = "";
        bootstrap.Modal.getInstance(document.getElementById('modalDivida')).hide();
    }
}
// Local correto para modificar dentro da função addDivida
function addDivida() {
    if(!verificarAcesso()) return;
    
    const idEdit = document.getElementById('div-id-edit').value;
    const valorRaw = document.getElementById('div-valor').value; // Pegamos o valor bruto do campo
    
    // CORREÇÃO: Tratamento correto para valores com máscara (Ex: 1.500,00 -> 1500.00)
    const valorLimpo = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

    const div = {
        id: idEdit ? parseInt(idEdit) : Date.now(),
        tipo: document.getElementById('div-tipo').value,
        nome: document.getElementById('div-nome').value,
        valor: valorLimpo,
        desc: document.getElementById('div-desc').value,
        whats: document.getElementById('div-whats').value,
        inicio: document.getElementById('div-inicio').value,
        prazo: document.getElementById('div-prazo').value,
        obs: document.getElementById('div-obs').value,
        pago: false
    };

    if(!div.nome || isNaN(div.valor) || div.valor <= 0) {
        alert("Por favor, preencha o nome e um valor válido para a dívida.");
        return;
    }
    
    const idx = dados.dividas.findIndex(d => d.id == div.id);
    if(idx > -1) {
        dados.dividas[idx] = div;
    } else {
        dados.dividas.push(div);
    }
    
    salvarERender();
    
    // Limpeza completa dos campos para evitar lixo no próximo registro
    document.getElementById('div-nome').value = "";
    document.getElementById('div-valor').value = "";
    document.getElementById('div-whats').value = "";
    document.getElementById('div-desc').value = "";
    document.getElementById('div-obs').value = "";
    document.getElementById('div-prazo').value = "";
    
    const modalElement = document.getElementById('modalDivida');
    const modalInst = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInst.hide();
}
// --- RENDERIZAÇÃO ---

function salvarERender() {
    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
    renderTudo();
}
function renderTudo() {
    renderResumo();
    renderExtrato();
    renderCartoes();
    renderDividas();
    renderMetas(); 
    renderizarNotas(); // Adicionado aqui para centralizar o ciclo de renderização
    verificarNotificacoes();
    renderGraficoRank(); 
}
function renderResumo() {
    const inputMes = document.getElementById('mes-atual');
    const elSaldo = document.getElementById('txt-saldo-geral');
    
    // Se o input de mês ou o saldo não existirem na tela atual, sai da função
    if (!inputMes || !elSaldo) return;

    const mesInput = inputMes.value;
    const movsMes = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));
    
    let ent = 0, sai = 0;
    movsMes.forEach(m => { if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor; });
    
    // Adicionando a classe money-value para o efeito de borrão funcionar
    const saldo = ent - sai;
    elSaldo.innerText = `R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // Lógica para Saldo Geral (Vermelho apenas se for negativo)
    elSaldo.classList.remove('text-success', 'text-danger'); // Reseta
    if (saldo < 0) {
        elSaldo.classList.add('text-danger');
    }
    elSaldo.classList.add('money-value');

    // Receitas (Entradas) - Branco padrão no card, mas adaptável ao container
    const elEntradas = document.getElementById('txt-entradas');
    elEntradas.innerText = `R$ ${ent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    elEntradas.classList.remove('text-success'); // Garante que não fique verde
    elEntradas.classList.add('money-value');

    // Despesas (Saídas) - Mantém vermelho nativo nas saídas do extrato
    const elSaidas = document.getElementById('txt-saidas');
    elSaidas.innerText = `- R$ ${sai.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    elSaidas.classList.remove('text-warning'); // Remove tons amarelados que conflitam fora do card principal
    elSaidas.classList.add('text-danger', 'money-value');

    const lista = document.getElementById('lista-recente');
    lista.innerHTML = movsMes.slice(-5).reverse().map(m => `
        <div class="card-mov">
            <div class="icon-box ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'} text-white">
                <i class="fas ${m.tipo === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
                        <div class="flex-grow-1">
                <div class="fw-bold">${m.desc}</div>
                <small class="text-muted">${m.cat} • ${m.hora || '--:--'}</small>
            </div>
            <div class="fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'} money-value">
                ${m.tipo === 'entrada' ? '+' : '-'} R$ ${m.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>
        </div>
    `).join('');
}
function renderExtrato() {
    const lista = document.getElementById('lista-extrato');
    const inputMes = document.getElementById('mes-atual');
    
    // Proteção: se a lista ou o input não existirem, não faz nada
    if (!lista || !inputMes) return;

    const mesInput = inputMes.value;

    
    // 1. Filtra por Mês
    let filtrados = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));
    
    // 2. Filtra por Tipo (entrada/saída)
    if(filtroAtual !== 'todos') {
        filtrados = filtrados.filter(m => m.tipo === filtroAtual);
    }

    // 3. Filtra por Texto (Busca em tempo real)
    if(buscaAtual) {
        filtrados = filtrados.filter(m => 
            m.desc.toLowerCase().includes(buscaAtual) || 
            m.cat.toLowerCase().includes(buscaAtual)
        );
    }
    // Usando [...filtrados] para criar uma cópia e não mexer na ordem original dos dados
    lista.innerHTML = filtrados.length ? [...filtrados].reverse().map(m => `
        <div class="card-mov" onclick="abrirModalMov(${m.id})" data-bs-toggle="modal" data-bs-target="#modalMov">
            <div class="icon-box ${m.tipo === 'entrada' ? 'bg-success' : 'bg-danger'} text-white">
                <i class="fas ${m.tipo === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
                        <div class="flex-grow-1">
                <div class="fw-bold">${m.desc}</div>
                <small class="text-muted">
                    <i class="far fa-calendar-alt me-1"></i>${m.data.split('-').reverse().join('/')} 
                    <i class="far fa-clock ms-2 me-1"></i>${m.hora || '--:--'}
                </small>
            </div>
            <div class="text-end">
                <div class="fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'} money-value">
                    R$ ${m.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
                <i class="fas fa-edit text-muted small"></i>
            </div>
        </div>
    `).join('') : '<p class="text-center text-muted">Nenhum lançamento este mês.</p>';
}
function renderCartoes() {
    const listaHome = document.getElementById('home-lista-cartoes');
    const listaSessao = document.getElementById('lista-cartoes');
    
    if (!listaHome || !listaSessao) return;

    // Filtra apenas por cartões válidos que possuem a propriedade limite antes de mapear
    const html = dados.cartoes.filter(c => c && typeof c.limite !== 'undefined').map(c => {
        let gastoTotalCartao = 0;
        // Verifica se existem compras antes de iterar para não dar erro de undefined
        if (c.compras && Array.isArray(c.compras)) {
            c.compras.forEach(compraItem => {
                gastoTotalCartao += (compraItem.valorTotal / (compraItem.parcelas || 1));
            });
        }
        
        return `
        <div class="col-6 mb-3">
            <div class="credit-card-container card-compact" style="background:${c.cor}" onclick="verCompras(${c.id})">
                <div class="card-header-ui">
                    <div>
                        <h6 class="mb-0">${c.nome}</h6>
                        <small>${c.bandeira}</small>
                    </div>
                    <div class="dropdown" onclick="event.stopPropagation()">
                        <i class="fas fa-ellipsis-v p-1" data-bs-toggle="dropdown" aria-expanded="false"></i>
                        <ul class="dropdown-menu">
                            <li><button class="dropdown-item" onclick="abrirModalCartao(${c.id})">Editar Cartão</button></li>
                        </ul>
                    </div>
                </div>
                <div class="mt-3">
                    <small class="d-block opacity-75">Limite disponível</small>
                    <span class="fw-bold">R$ ${(c.limite - gastoTotalCartao).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    listaHome.innerHTML = html || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
    listaSessao.innerHTML = html || '<p class="text-center w-100 text-muted">Nenhum cartão cadastrado.</p>';
}
function renderDividas() {
    const euDevo = dados.dividas.filter(d => d.tipo === 'eu-devo');
    const meDevem = dados.dividas.filter(d => d.tipo === 'me-devem');

    const totalPagar = euDevo.reduce((a, b) => a + b.valor, 0);
    const totalReceber = meDevem.reduce((a, b) => a + b.valor, 0);

    document.getElementById('total-eu-devo').innerText = `R$ ${totalPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('total-me-devem').innerText = `R$ ${totalReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const template = (d) => `
    <div class="card-mov align-items-start py-3">
        <div class="icon-box bg-light border mt-1">
            <i class="fas fa-user text-muted"></i>
        </div>
        <div class="flex-grow-1 ms-2">
            <div class="fw-bold">${d.nome}</div>
            <small class="text-muted d-block">${d.desc}</small>
            
            ${d.obs ? `<div class="mt-2 p-2 bg-light rounded-3 border-start border-warning border-3 shadow-sm" style="font-size: 0.75rem;">
                <div class="text-uppercase fw-bold text-muted mb-1" style="font-size: 0.65rem;">Histórico de Pagamentos:</div>
                <div class="text-dark" style="white-space: pre-line;">${d.obs}</div>
            </div>` : ''}

            <small class="badge bg-light text-dark border mt-2">Prazo: ${d.prazo.split('-').reverse().join('/')}</small>
        </div>
        <div class="text-end me-2 mt-1">
            <div class="fw-bold ${d.tipo === 'eu-devo' ? 'text-danger' : 'text-success'}">
                R$ ${d.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>
        </div>
        
        <div class="dropdown mt-1">
            <button class="btn btn-link text-muted p-2" data-bs-toggle="dropdown">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                <li><a class="dropdown-item py-2" href="https://wa.me/55${d.whats.replace(/\D/g,'')}" target="_blank">
                    <i class="fab fa-whatsapp text-success me-2"></i> WhatsApp
                </a></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item py-2" onclick="abrirModalDivida(${d.id})">
                    <i class="fas fa-edit text-primary me-2"></i> Editar Dados
                </button></li>
                <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'total')">
                    <i class="fas fa-check-circle text-success me-2"></i> Pagamento Total
                </button></li>
                <li><button class="dropdown-item py-2" onclick="prepararPagamento(${d.id}, 'parcial')">
                    <i class="fas fa-coins text-warning me-2"></i> Pagamento Parcial
                </button></li>
            </ul>
        </div>
    </div>
`;
    document.getElementById('lista-eu-devo').innerHTML = euDevo.map(template).join('') || '<p class="text-center small py-3">Sem dívidas registradas.</p>';
    document.getElementById('lista-me-devem').innerHTML = meDevem.map(template).join('') || '<p class="text-center small py-3">Sem valores a receber.</p>';
}

function prepararPagamento(id, modo) {
    const div = dados.dividas.find(d => d.id == id);
    document.getElementById('pag-id').value = id;
    document.getElementById('pag-modo').value = modo;
    document.getElementById('pag-data').value = new Date().toISOString().split('T')[0];
    
    const campoValor = document.getElementById('pag-valor');
    const areaValor = document.getElementById('area-valor-pag');

    if (modo === 'total') {
        document.getElementById('tituloPagamento').innerText = "Pagamento Total";
        campoValor.value = div.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        areaValor.classList.add('d-none'); // Esconde o campo pois o valor é fixo
    } else {
        document.getElementById('tituloPagamento').innerText = "Pagamento Parcial";
        campoValor.value = "";
        areaValor.classList.remove('d-none'); // Mostra para digitar quanto quer pagar
    }

    new bootstrap.Modal(document.getElementById('modalPagamento')).show();
}

function confirmarPagamento() {
    const id = document.getElementById('pag-id').value;
    const modoRaw = document.getElementById('pag-modo').value;
    const dataRaw = document.getElementById('pag-data').value;
    const valorDigitado = document.getElementById('pag-valor').value;
    
    if(!dataRaw) return alert("Selecione a data!");

    const valorPagamento = parseFloat(valorDigitado.replace(/\./g, '').replace(',', '.')) || 0;
    const dataFormatada = dataRaw.split('-').reverse().join('/');
    const agora = new Date();
    const horaPagto = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    // LÓGICA PARA COMPRAS DE CARTÃO
    if (modoRaw.includes("-cartao")) {
        const card = dados.cartoes.find(x => x.id == cartaoContexto);
        const compra = card.compras.find(c => c.id == id);
        
        if (!compra.pagamentos) compra.pagamentos = [];
        
        compra.pagamentos.push({
            valor: valorPagamento,
            data: dataFormatada,
            hora: horaPagto
        });

        alert("Pagamento da compra registrado!");
        salvarERender();
        renderComprasCartao();
        bootstrap.Modal.getInstance(document.getElementById('modalPagamento')).hide();
        return;
    }

    // LÓGICA PARA DÍVIDAS
    const idx = dados.dividas.findIndex(d => d.id == id);
    if (idx === -1) return;
    const div = dados.dividas[idx];

    if (modoRaw === 'total') {
        const item = dados.dividas.splice(idx, 1)[0];
        item.origem = 'dividas';
        item.obs = (item.obs || "") + `\n- QUITADO TOTAL (R$ ${item.valor.toLocaleString('pt-BR')}) em ${dataFormatada} às ${horaPagto}`;
        dados.lixeira.push(item);
        alert("Dívida quitada e movida para a lixeira!");
    } else {
        if (valorPagamento <= 0 || valorPagamento > div.valor) return alert("Valor inválido!");
        div.valor = Math.round((div.valor - valorPagamento) * 100) / 100;
        div.obs = (div.obs || "") + `\n→ Pago: R$ ${valorPagamento.toLocaleString('pt-BR')} (${dataFormatada} às ${horaPagto})`;
        alert("Pagamento parcial registrado!");
    }

    salvarERender();
    bootstrap.Modal.getInstance(document.getElementById('modalPagamento')).hide();
}

// --- UTILITÁRIOS ---

function toggleTema() {
    dados.config.dark = !dados.config.dark;
    const isDark = dados.config.dark;
    
    // Aplica o tema no body
    document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    
    const btnTema = document.getElementById('btn-tema');
    if (btnTema) {
        // Adiciona a classe de animação do CSS
        btnTema.classList.add('rotate-icon');
        
        // Troca o ícone no meio da animação
        setTimeout(() => {
            if (isDark) {
                btnTema.classList.replace("fa-moon", "fa-sun");
            } else {
                btnTema.classList.replace("fa-sun", "fa-moon");
            }
        }, 250);

        // Remove a classe para poder girar de novo no próximo clique
        setTimeout(() => btnTema.classList.remove('rotate-icon'), 500);
    }
    
    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
}
function toggleVisibilidade() {
    dados.config.oculto = !dados.config.oculto;
    const isOculto = dados.config.oculto;

    // 1. Liga/Desliga o borrão nos valores (CSS)
    document.body.classList.toggle('values-hidden', isOculto);
    
    // 2. Busca o ícone pelo ID e faz a troca das classes
    const btnOlho = document.getElementById('btn-olho');
    if (btnOlho) {
        if (isOculto) {
            // Se ficou oculto, mostra o olho cortado
            btnOlho.classList.replace("fa-eye", "fa-eye-slash");
        } else {
            // Se ficou visível, mostra o olho aberto
            btnOlho.classList.replace("fa-eye-slash", "fa-eye");
        }
    }

    localStorage.setItem('financas_pro_max', JSON.stringify(dados));
}
window.onload = () => {
    const camposValor = ['mov-valor', 'card-limite', 'compra-valor', 'div-valor', 'pag-valor', 'meta-objetivo'];
    camposValor.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', mascaraMoeda);
            if(el.value) { el.dispatchEvent(new Event('input')); }
        }
    });

    const inputMes = document.getElementById('mes-atual');
    if (inputMes && !inputMes.value) {
        inputMes.value = new Date().toISOString().substring(0, 7);
    }

    if (!usuarioAtivo && localStorage.getItem('user_lembrado')) {
        usuarioAtivo = localStorage.getItem('user_lembrado');
        sessionStorage.setItem('user_ativo', usuarioAtivo);
    }

    if(usuarioAtivo) {
        const telaLogin = document.getElementById('tela-login');
        if(telaLogin) telaLogin.style.display = 'none';
    }
    
    if(dados.config.dark) {
        document.body.setAttribute('data-bs-theme', 'dark');
        const btnTema = document.getElementById('btn-tema');
        if(btnTema) btnTema.classList.replace("fa-moon", "fa-sun");
    }

    if(dados.config.oculto) {
        document.body.classList.add('values-hidden');
        const btnOlho = document.getElementById('btn-olho');
        if(btnOlho) btnOlho.classList.replace("fa-eye", "fa-eye-slash");
    }
    
    // Configuração segura da calculadora arrastável
    const headerCalc = document.getElementById('calc-header');
    if (headerCalc) {
        headerCalc.addEventListener('mousedown', startDrag);
        headerCalc.addEventListener('touchstart', startDrag, { passive: true });
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('touchend', () => isDragging = false);
    }

    processarLancamentosFixos();
    renderTudo();
};
function resetarApp() {
    if(confirm("Deseja apagar todos os dados?")) {
        localStorage.clear();
        location.reload();
    }
}

function sairApp() {
    sessionStorage.clear();
    localStorage.removeItem('user_lembrado');
    location.reload();
}

function exportarBackup() {
    const blob = new Blob([JSON.stringify(dados)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_financas.json';
    a.click();
}

function abrirImportar() {
    if(!verificarAcesso()) return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                dados = JSON.parse(ev.target.result);
                localStorage.setItem('financas_pro_max', JSON.stringify(dados));
                location.reload();
            } catch(err) { alert("Arquivo inválido!"); }
        };
        reader.readAsText(e.target.files[0]);
    };
    inp.click();
}
// --- SISTEMA DE NOTIFICAÇÕES INTELIGENTE ---

function verificarNotificacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    
    const inputMes = document.getElementById('mes-atual');
    if (!inputMes) return; // Cancela se o elemento não estiver na tela
    
    const mesAtual = inputMes.value;
    
    let totalAlertas = 0;

    // 1. Dívidas próximas (3 dias)
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);
    const divAlert = dados.dividas.filter(d => {
        const prazo = new Date(d.prazo + 'T00:00:00');
        return !d.pago && prazo >= hoje.setHours(0,0,0,0) && prazo <= tresDias;
    }).length;

    // 2. Cartões vencendo em breve (3 dias)
    const cardAlert = dados.cartoes.filter(c => {
        const v = parseInt(c.vence);
        return v >= diaAtual && v <= (diaAtual + 3);
    }).length;

    // 3. Alerta de Orçamento (Gastos > 80% da Receita)
    let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mesAtual)).forEach(m => {
        if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor;
    });

        // Define a lógica do alerta de orçamento antes de somar no total
    const orcamentoAlert = (ent > 0 && sai > (ent * 0.8)) ? 1 : 0;

    totalAlertas = divAlert + cardAlert + orcamentoAlert;
    const badge = document.getElementById('badge-notificacao');
    
    if (badge) {
        if (totalAlertas > 0) {
            badge.innerText = totalAlertas;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }
}
function abrirNotificacoes() {
    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = document.getElementById('mes-atual').value;
    let listaAvisos = [];

    // Lógica 1: Dívidas
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);
    dados.dividas.forEach(d => {
        const prazo = new Date(d.prazo + 'T00:00:00');
        if (!d.pago && prazo >= hoje.setHours(0,0,0,0) && prazo <= tresDias) {
            listaAvisos.push(`⚠️ DÍVIDA: ${d.nome} vence dia ${d.prazo.split('-').reverse().join('/')}`);
        }
    });

    // Lógica 2: Cartões
    dados.cartoes.forEach(c => {
        const v = parseInt(c.vence);
        if (v >= diaAtual && v <= (diaAtual + 3)) {
            listaAvisos.push(`💳 CARTÃO: Fatura do ${c.nome} vence dia ${v}`);
        }
    });

        // Lógica 3: Orçamento
    let ent = 0, sai = 0;
    dados.movs.filter(m => m.data && m.data.startsWith(mesAtual)).forEach(m => {
        if(m.tipo === 'entrada') ent += m.valor; else sai += m.valor;
    });
    if (ent > 0 && sai > (ent * 0.8)) {
        listaAvisos.push(`📊 ORÇAMENTO: Você já usou ${((sai/ent)*100).toFixed(0)}% das suas receitas! Atenção aos gastos.`);
    }

    if (listaAvisos.length === 0) {
        alert("✅ Tudo sob controle! Nenhuma pendência urgente para os próximos dias.");
    } else {
        alert("🔔 CENTRAL DE LEMBRETES:\n\n" + listaAvisos.join('\n\n'));
    }
}
// --- SISTEMA DE RANKING (GRÁFICO) ---

function renderGraficoRank() {
    const ctx = document.getElementById('chartGastos');
    const balancoTxt = document.getElementById('txt-balanco-grafico');
    const legendaHtml = document.getElementById('legenda-grafico-html');
    
    if (!ctx || !balancoTxt || !legendaHtml) return;

    // Destrói gráfico anterior para evitar erros de renderização
    if (meuGrafico) { meuGrafico.destroy(); }

    const mesInput = document.getElementById('mes-atual').value;
    const movsMes = dados.movs.filter(m => m.data && m.data.startsWith(mesInput));

    // 1. Processamento de Dados (Entradas vs Saídas por Categoria)
    const categorias = {};
    let totalEntradas = 0;
    let totalSaidas = 0;

    movsMes.forEach(m => {
        const cat = m.cat || "Outros"; 
        if (!categorias[cat]) {
            categorias[cat] = { entrada: 0, saida: 0, total_movs: 0 };
        }
        
        if (m.tipo === 'entrada') {
            categorias[cat].entrada += m.valor;
            totalEntradas += m.valor;
        } else if (m.tipo === 'saida') {
            categorias[cat].saida += m.valor;
            totalSaidas += m.valor;
        }
        categorias[cat].total_movs += 1;
    });

    // Calcula o Balanço Total para o centro do gráfico
    const balancoTotal = totalEntradas - totalSaidas;
    balancoTxt.innerText = balancoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Ajusta a cor do texto do balanço central
    balancoTxt.classList.remove('text-success', 'text-danger', 'text-dark');
    if(balancoTotal < 0) balancoTxt.classList.add('text-danger');
    else if(balancoTotal > 0) balancoTxt.classList.add('text-success');
    else balancoTxt.classList.add('text-dark');

    // Mapeamento de cores fixas para as categorias (Adicionado suporte a variações comuns)
    const coresMap = {
        'Mercado': '#4ecca3', 'Transporte': '#6f42c1', 'Saúde': '#dc3545', 'Saude': '#dc3545',
        'Lazer': '#ffc107', 'Salário': '#0dcaf0', 'Salario': '#0dcaf0', 'Aluguel': '#ff8c00', 'Outros': '#adb5bd'
    };
    // Ordena as categorias por volume financeiro total
    const catsSorted = Object.keys(categorias).sort((a, b) => 
        (categorias[b].entrada + categorias[b].saida) - (categorias[a].entrada + categorias[a].saida)
    );

        const labels = catsSorted;
    const entradasData = catsSorted.map(cat => categorias[cat].entrada);
    const saidasData = catsSorted.map(cat => categorias[cat].saida);
        const backgroundColors = catsSorted.map(cat => coresMap[cat] || coresMap['Outros']);

    // Se não houver dados, impede a renderização de um gráfico vazio que quebraria o Chart.js
    if(labels.length === 0) {
        if (meuGrafico) { meuGrafico.destroy(); meuGrafico = null; } // Limpa o gráfico antigo do canvas
        balancoTxt.innerText = "R$ 0,00";
        balancoTxt.className = "fw-bold text-dark fs-5 money-value";
        legendaHtml.innerHTML = '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>';
        return;
    }

    // 2. Renderiza o Gráfico com dois anéis (Entradas por fora, Saídas por dentro)
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Entradas',
                    data: entradasData,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 10,
                    cutout: '70%'
                },
                {
                    label: 'Saídas',
                    data: saidasData,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 10,
                    cutout: '65%'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            layout: { padding: 20 }
        }
    });
    // 3. Gera a Legenda Detalhada em HTML (estilo a imagem que você enviou)
    const templateLegenda = (cat, d) => {
        const balancoCat = d.entrada - d.saida;
        const totalCat = d.entrada + d.saida;
        const perc = totalCat > 0 && (totalEntradas + totalSaidas) > 0 
            ? ((totalCat / (totalEntradas + totalSaidas)) * 100).toFixed(0) + '%' : '0%';
        const cor = coresMap[cat] || coresMap['Outros'];

        return `
            <div class="list-group-item d-flex justify-content-between align-items-start border-0 rounded-3 p-3 mb-2 shadow-sm">
                <div class="icon-box bg-light border" style="color:${cor}; min-width: 45px;">
                    <i class="fas fa-tags"></i>
                </div>
                <div class="flex-grow-1 ms-3">
                    <div class="fw-bold text-dark d-flex justify-content-between">
                        ${cat}
                        <span class="${balancoCat >= 0 ? 'text-success' : 'text-danger'}" style="font-size: 0.8rem;">
                            ${balancoCat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                    <div class="d-flex justify-content-between mt-1" style="font-size: 0.7rem;">
                        <span class="text-success">↑ ${d.entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span class="text-danger">↓ ${d.saida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
                <div class="ms-2 fw-bold small text-muted">${perc}</div>
            </div>
        `;
    };

    legendaHtml.innerHTML = catsSorted.length ? catsSorted.map(cat => templateLegenda(cat, categorias[cat])).join('') 
        : '<p class="text-center text-muted py-4 small">Sem movimentações este mês.</p>';
}
// --- UTILITÁRIO DE MÁSCARA BRASILEIRA ---
function mascaraMoeda(event) {
    let value = event.target.value.replace(/\D/g, "");
    
    // Se não houver números, limpa o campo e sai da função
    if (!value) {
        event.target.value = "";
        return;
    }

    // Formata o valor em tempo real
    const options = { minimumFractionDigits: 2 };
    const result = new Intl.NumberFormat('pt-BR', options).format(
        parseFloat(value) / 100
    );

    event.target.value = result;
}
function prepararPagamentoCompra(id, modo) {
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    const compra = card.compras.find(c => c.id == id);
    
    const valorPagoJa = compra.pagamentos ? compra.pagamentos.reduce((a, b) => a + b.valor, 0) : 0;
    const saldoDevedor = compra.valorTotal - valorPagoJa;

    document.getElementById('pag-id').value = id;
    document.getElementById('pag-modo').value = modo + "-cartao"; // Diferenciador
    document.getElementById('pag-data').value = new Date().toISOString().split('T')[0];
    
    const campoValor = document.getElementById('pag-valor');
    const areaValor = document.getElementById('area-valor-pag');

    if (modo === 'total') {
        document.getElementById('tituloPagamento').innerText = "Quitar Compra";
        campoValor.value = saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        areaValor.classList.add('d-none');
    } else {
        document.getElementById('tituloPagamento').innerText = "Pagamento Parcial (Cartão)";
        campoValor.value = "";
        areaValor.classList.remove('d-none');
    }

    new bootstrap.Modal(document.getElementById('modalPagamento')).show();
}
function processarLancamentosFixos() {
    const hoje = new Date();
    const mesAtual = hoje.toISOString().substring(0, 7); // Ex: "2026-05"
    
    // Filtra todos os lançamentos marcados como fixos de meses anteriores
    const fixos = dados.movs.filter(m => m.fixo && m.data.substring(0, 7) < mesAtual);
    
    fixos.forEach(f => {
        // Verifica se já existe uma cópia desse fixo no mês atual (pela descrição e valor)
        const jaExiste = dados.movs.some(m => m.desc === f.desc && m.data.startsWith(mesAtual));
        
                if (!jaExiste) {
            const diaOriginal = f.data.split('-')[2] ? f.data.split('-')[2].substring(0, 2) : "01";
            const novoLancamento = { 
                ...f, 
                id: Date.now() + Math.floor(Math.random() * 10000), // Mantém ID como Number Inteiro
                data: `${mesAtual}-${diaOriginal.padStart(2, '0')}`
            };
            dados.movs.push(novoLancamento);
        }

    });
    
    if (fixos.length > 0) salvarERender();
}
// --- SISTEMA DE METAS DE POUPANÇA ---

function salvarMeta() {
    if(!verificarAcesso()) return;

    const nome = document.getElementById('meta-nome').value.trim();
    const objRaw = document.getElementById('meta-objetivo').value;
    const inicio = document.getElementById('meta-data-inicio').value;
    const fim = document.getElementById('meta-data-fim').value;

    const objetivo = parseFloat(objRaw.replace(/\./g, '').replace(',', '.')) || 0;

    if (!nome || objetivo <= 0 || !inicio || !fim) {
        return alert("Preencha todos os campos da meta corretamente!");
    }

    const novaMeta = {
        id: Date.now(),
        nome: nome,
        objetivo: objetivo,
        guardado: 0,
        inicio: inicio,
        fim: fim
    };

    dados.metas.push(novaMeta);
    salvarERender();

    // Limpa os campos do modal
    document.getElementById('meta-nome').value = '';
    document.getElementById('meta-objetivo').value = '';
    document.getElementById('meta-data-inicio').value = '';
    document.getElementById('meta-data-fim').value = '';
}

function renderMetas() {
    const lista = document.getElementById('lista-metas');
    if (!lista) return;

    lista.innerHTML = dados.metas.length ? dados.metas.map(m => {
        const progressoPerc = Math.min((m.guardado / m.objetivo) * 100, 100).toFixed(0);
        
        // Formata datas para exibição BR
        const dataIn = m.inicio.split('-').reverse().join('/');
        const dataAlvo = m.fim.split('-').reverse().join('/');

        return `
            <div class="col-12 col-md-6 mb-3">
                <div class="card p-3 border-0 shadow-sm rounded-4 bg-white">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-0">${m.nome}</h6>
                            <small class="text-muted" style="font-size: 0.75rem;">
                                ${dataIn} até ${dataAlvo}
                            </small>
                        </div>
                        <span class="badge bg-purple text-white">${progressoPerc}%</span>
                    </div>

                    <div class="d-flex justify-content-between my-2" style="font-size: 0.85rem;">
                        <span class="text-muted">Acumulado: <b class="text-success">R$ ${m.guardado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        <span class="text-muted">Alvo: <b>R$ ${m.objetivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                    </div>

                    <div class="progress mb-3" style="height: 10px; border-radius: 10px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${progressoPerc}%; border-radius: 10px;"></div>
                    </div>

                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-success flex-grow-1" onclick="movimentarMeta(${m.id}, 'poupar')">
                            <i class="fas fa-piggy-bank me-1"></i> Poupar
                        </button>
                        <button class="btn btn-sm btn-outline-warning flex-grow-1" onclick="movimentarMeta(${m.id}, 'resgatar')">
                            <i class="fas fa-hand-holding-usd me-1"></i> Resgatar
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirMeta(${m.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('') : '<p class="text-center text-muted py-4 w-100">Nenhuma meta cadastrada ainda.</p>';
}

function movimentarMeta(id, acao) {
    if(!verificarAcesso()) return;

    const meta = dados.metas.find(m => m.id == id);
    if (!meta) return;

    const msg = acao === 'poupar' ? 'Quanto deseja guardar para esta meta?' : 'Quanto deseja resgatar desta meta?';
    const valorPrompt = prompt(msg);
    if (!valorPrompt) return;

    // Tratamento básico para converter input do usuário em float
    const valor = parseFloat(valorPrompt.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return alert("Valor inválido!");

    const agora = new Date();
    const dataAtual = agora.toISOString().split('T')[0];
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

    if (acao === 'poupar') {
        meta.guardado += valor;
        
        // Gera um débito automático no extrato (Dinheiro saiu do saldo e foi pro cofre)
        dados.movs.push({
            id: Date.now(),
            desc: `Poupança: ${meta.nome}`,
            valor: valor,
            tipo: 'saida',
            cat: 'Outros',
            data: dataAtual,
            hora: horaAtual,
            fixo: false
        });
        alert(`R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} guardados com sucesso!`);
    } else {
        if (valor > meta.guardado) return alert("Saldo insuficiente na meta para resgate!");
        meta.guardado -= valor;

        // Gera um crédito automático no extrato (Dinheiro voltou para o saldo geral)
        dados.movs.push({
            id: Date.now(),
            desc: `Resgate: ${meta.nome}`,
            valor: valor,
            tipo: 'entrada',
            cat: 'Outros',
            data: dataAtual,
            hora: horaAtual,
            fixo: false
        });
        alert(`R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} resgatados para o seu saldo!`);
    }

    salvarERender();
}

function excluirMeta(id) {
    if (confirm("Deseja realmente excluir esta meta? O valor guardado não será devolvido automaticamente ao saldo geral.")) {
        dados.metas = dados.metas.filter(m => m.id != id);
        salvarERender();
    }
}
// Logica da Calculadora
let calcExpressao = '';

function toggleCalculadora() {
    const calc = document.getElementById('calc-container');
    calc.style.display = calc.style.display === 'none' ? 'flex' : 'none';
}

function calcAdd(valor) {
    const display = document.getElementById('calc-display');
    if (display.value === '0' && valor !== '.') calcExpressao = '';
    calcExpressao += valor;
    display.value = calcExpressao;
}

function calcLimpar() {
    calcExpressao = '';
    document.getElementById('calc-display').value = '0';
}

function calcApagar() {
    calcExpressao = calcExpressao.slice(0, -1);
    document.getElementById('calc-display').value = calcExpressao || '0';
}

function calcResultado() {
    if (!calcExpressao) return;
    try {
        // Sanitização básica antes da execução dinâmica segura
        if (/[^0-9\+\-\*\/\.\(\)]/.test(calcExpressao)) throw new Error("Invalido");
        let res = new Function(`return ${calcExpressao}`)();

        if (res === undefined || isNaN(res) || !isFinite(res)) throw new Error("Erro");
        if (!Number.isInteger(res)) res = parseFloat(res.toFixed(2));
        
        document.getElementById('calc-display').value = res;
        calcExpressao = res.toString();
    } catch (e) {
        document.getElementById('calc-display').value = 'Erro';
        calcExpressao = '';
    }
}

// Tornar a Janela Arrastável
const calcContainer = document.getElementById('calc-container');
const calcHeader = document.getElementById('calc-header');
let isDragging = false, offset = { x: 0, y: 0 };

const startDrag = (e) => {
    isDragging = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    offset.x = clientX - calcContainer.offsetLeft;
    offset.y = clientY - calcContainer.offsetTop;
};

const onDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Evita seleção de textos indesejada enquanto arrasta
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    calcContainer.style.left = (clientX - offset.x) + 'px';
    calcContainer.style.top = (clientY - offset.y) + 'px';
    calcContainer.style.right = 'auto';
};
// --- LÓGICA DO BLOCO DE NOTAS ---
let notas = JSON.parse(localStorage.getItem('financas_notas')) || [];

function abrirModalNota(id = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalNota'));
    const nota = id ? notas.find(n => n.id === id) : null;

    // Resetar campos
    document.getElementById('nota-id-edit').value = id || '';
    document.getElementById('nota-titulo').value = nota ? nota.titulo : '';
    document.getElementById('nota-texto').value = nota ? nota.texto : '';
    document.getElementById('nota-fixada').value = nota ? nota.fixada : 'false';
    
    // Configurar cor
    const corPadrao = nota ? nota.cor : '#ffffff';
    selecionarCorNota(corPadrao);

    // Configurar ícone de fixar
    const btnFixar = document.getElementById('btn-fixar-nota');
    if (nota && nota.fixada) {
        btnFixar.classList.add('active');
    } else {
        btnFixar.classList.remove('active');
    }

    // Mostrar/Esconder botões de ação
    document.getElementById('modalNotaTitulo').innerText = id ? 'Editar Nota' : 'Nova Nota';
    document.getElementById('btn-excluir-nota').classList.toggle('d-none', !id);
    document.getElementById('btn-copiar-nota').classList.toggle('d-none', !id);

    modal.show();
}

function selecionarCorNota(cor) {
    document.getElementById('nota-cor-fundo').value = cor;
    document.getElementById('cor-fundo-modal-nota').style.backgroundColor = cor;
}

function toggleFixarNota() {
    const inputFixar = document.getElementById('nota-fixada');
    const btnFixar = document.getElementById('btn-fixar-nota');
    const estaFixada = inputFixar.value === 'true';

    inputFixar.value = estaFixada ? 'false' : 'true';
    btnFixar.classList.toggle('active');
}

function salvarNota() {
    const id = document.getElementById('nota-id-edit').value;
    const titulo = document.getElementById('nota-titulo').value.trim();
    const texto = document.getElementById('nota-texto').value.trim();
    const cor = document.getElementById('nota-cor-fundo').value;
    const fixada = document.getElementById('nota-fixada').value === 'true';

    if (!titulo && !texto) return; // Não salva nota vazia

    if (id) {
        // Editar
        const index = notas.findIndex(n => n.id == id);
        notas[index] = { ...notas[index], titulo, texto, cor, fixada };
    } else {
        // Nova nota
        const novaNota = {
            id: Date.now(),
            titulo,
            texto,
            cor,
            fixada,
            data: new Date().toISOString()
        };
        notas.push(novaNota);
    }

            localStorage.setItem('financas_notas', JSON.stringify(notas));
    bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
    renderizarNotas();
}

function renderizarNotas() {
    const listaGeral = document.getElementById('lista-notas');
    const listaFixadas = document.getElementById('lista-notas-fixadas');
    const containerFixadas = document.getElementById('container-notas-fixadas');
    const tituloOutras = document.getElementById('titulo-outras-notas');
    const vazio = document.getElementById('notas-vazio');

    // Se os elementos não existirem na tela atual, interrompe a função pacificamente
    if (!listaGeral || !listaFixadas || !vazio || !containerFixadas) return;

    listaGeral.innerHTML = '';
    listaFixadas.innerHTML = '';

    if (notas.length === 0) {
        vazio.classList.remove('d-none');
        containerFixadas.classList.add('d-none');
        return;
    }
    vazio.classList.add('d-none');

    // Separar fixadas de normais
    const fixadas = notas.filter(n => n.fixada);
    const normais = notas.filter(n => !n.fixada);

    containerFixadas.classList.toggle('d-none', fixadas.length === 0);
    tituloOutras.classList.toggle('d-none', fixadas.length === 0);

        // Função auxiliar simples para sanitizar strings contra XSS
    const escaparHTML = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    const criarCard = (nota) => `
        <div class="col-6 col-md-4">
            <div class="nota-card shadow-sm" style="background-color: ${nota.cor}" onclick="abrirModalNota(${nota.id})">
                ${nota.fixada ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                <div>
                    <div class="nota-titulo-card">${escaparHTML(nota.titulo || 'Sem título')}</div>
                    <div class="nota-resumo-card">${escaparHTML(nota.texto || '')}</div>
                </div>
            </div>
        </div>
    `;
    fixadas.forEach(n => listaFixadas.innerHTML += criarCard(n));
    normais.forEach(n => listaGeral.innerHTML += criarCard(n));
}

function excluirNota() {
    const id = document.getElementById('nota-id-edit').value;
    if (confirm('Deseja excluir esta nota permanentemente?')) {
        notas = notas.filter(n => n.id != id);
        localStorage.setItem('financas_notas', JSON.stringify(notas));
        bootstrap.Modal.getInstance(document.getElementById('modalNota')).hide();
        renderizarNotas();
    }
}

function copiarNota() {
    const texto = document.getElementById('nota-texto').value;
    navigator.clipboard.writeText(texto).then(() => {
        alert('Texto copiado para a área de transferência!');
    });
}


