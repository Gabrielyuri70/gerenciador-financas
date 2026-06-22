// Dados e Inicialização com Proteção contra erros
let dados;
try {
    const salvos = localStorage.getItem('financas_pro_max');
    dados = (salvos && salvos !== "undefined") ? JSON.parse(salvos) : null;
    
    // Força uma estrutura limpa se o objeto recuperado for inválido ou nulo
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        dados = { movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], historicoQuitados: [], config: { dark: false, oculto: false } };
    }
    
    // Garante retrocompatibilidade em todas as chaves obrigatórias de arrays
    const chavesPadrao = ['movs', 'cartoes', 'dividas', 'metas', 'lixeira', 'historicoQuitados'];
    chavesPadrao.forEach(chave => {
        if (!dados[chave] || !Array.isArray(dados[chave])) {
            dados[chave] = [];
        }
    });
    
    if (!dados.config || typeof dados.config !== 'object') {
        dados.config = { dark: false, oculto: false };
    }
} catch (err) {
    console.error("Falha ao ler localStorage, resetando dados:", err);
    dados = { movs: [], cartoes: [], dividas: [], metas: [], lixeira: [], historicoQuitados: [], config: { dark: false, oculto: false } };
}

let usuarioAtivo = sessionStorage.getItem('user_ativo') || localStorage.getItem('user_lembrado') || null;
let filtroAtual = 'todos';
let buscaAtual = ''; // Nova variável para busca
let cartaoContexto = null;

// Novas variáveis para o sistema de filtros das dívidas
let buscaDividaAtual = '';
let ordemDividaAtual = 'data-recente';
let statusDividaAtual = 'todas'; // Controla se mostra todas, pendentes ou vencidas
let meuGrafico = null; // Nova variável para o gráfico
let isDragging = false; // <-- ADICIONADO PARA EVITAR REF-ERROR NA CALCULADORA
let offset = { x: 0, y: 0 }; // Remove as declarações soltas de baixo

// CORREÇÃO: Declaração das variáveis em escopo global para evitar travamentos
if (typeof calcContainer === 'undefined') {
    var calcContainer = null;
}
if (typeof calcHeader === 'undefined') {
    var calcHeader = null;
}

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
        
        // ADICIONADO: Atualiza os textos com o nome do usuário logado
        atualizarNomeUsuarioTela(u);
        
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
    
    // CORREÇÃO: Em vez de limpar o objeto 'dados' global (que apaga o do usuário real),
    // nós instanciamos uma estrutura limpa isolada para a sessão do visitante.
    dados = { 
        movs: [], 
        cartoes: [], 
        dividas: [], 
        metas: [], 
        lixeira: [], 
        historicoQuitados: [], 
        config: { dark: false, oculto: false } 
    };

    // Limpa também as notas locais apenas em memória para o visitante
    if (typeof notas !== 'undefined') {
        notas = [];
    }

    // ADICIONADO: Força o nome a virar Visitante na tela
    atualizarNomeUsuarioTela('Visitante');

    document.getElementById('tela-login').style.display = 'none';
    renderTudo();
}

function carregarDadosPerfil() {
    if (sessionStorage.getItem('user_ativo') === 'visitante') return;
    
    const authRaw = localStorage.getItem('financas_auth');
    if (authRaw) {
        const auth = JSON.parse(authRaw);
        const inputUser = document.getElementById('novo-user-perfil');
        if (inputUser) inputUser.value = auth.user;
    }
}

function atualizarPerfilUsuario() {
    if(!verificarAcesso()) return;

    const novoUser = document.getElementById('novo-user-perfil').value.trim();
    const novaPass = document.getElementById('nova-pass-perfil').value.trim();
    const authRaw = localStorage.getItem('financas_auth');

    if (!authRaw) return alert("Erro: Conta de usuário não encontrada!");
    if (!novoUser) return alert("O campo de usuário não pode ficar vazio!");

    let auth = JSON.parse(authRaw);
    auth.user = novoUser;

    if (novaPass) {
        auth.pass = novaPass; // <-- Agora a variável interna realmente recebe a nova senha
        alert("Usuário e Senha atualizados com sucesso!"); // Correção de português/ortografia aplicada aqui
        document.getElementById('nova-pass-perfil').value = ""; 
    } else {
        alert("Nome de usuário atualizado com sucesso!");
    }

    localStorage.setItem('financas_auth', JSON.stringify(auth));

    if(localStorage.getItem('user_lembrado')) {
        localStorage.setItem('user_lembrado', novoUser);
    }
    sessionStorage.setItem('user_ativo', novoUser);
    usuarioAtivo = novoUser;
    
    // ADICIONADO: Atualiza os elementos na tela com o novo nome
    atualizarNomeUsuarioTela(novoUser);
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
    // Se abrir a aba de dívidas, força a atualização do histórico
    if(id === 'aba-dividas' || id === 'dividas') { // <-- ADICIONE ESTE BLOCO
        renderizarHistoricoDividas();
    }
    // Se abrir as configurações ou perfil, preenche os campos com os dados atuais salvos
    if(id === 'aba-perfil' || id === 'aba-configuracoes') {
        carregarDadosPerfil();
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
        const idNumerico = Number(id); // Garante que a busca use o tipo correto
        const idx = dados.movs.findIndex(m => m.id === idNumerico);
        const item = dados.movs.splice(idx, 1)[0];
        item.origem = 'movs';
        item.deletadoEm = new Date().toLocaleDateString('pt-BR'); // <-- Guarda a data exata da exclusão
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
                <small class="text-muted">Deletado em: ${m.deletadoEm || new Date().toLocaleDateString('pt-BR')}</small>
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
        // Limpa propriedades injetadas temporariamente para exibição na lixeira
        if (destino === 'cartoes' || destino === 'historicoQuitados') delete item.desc; 

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
        document.getElementById('card-cor-fonte').value = c.corFonte || "#ffffff"; // <-- ADICIONADO: Resgata a cor da fonte (padrão branca se não existir)
        document.getElementById('card-tipo').value = c.tipo;
        document.getElementById('card-fecha').value = c.fecha;
        document.getElementById('card-vence').value = c.vence;
        document.getElementById('btn-excluir-cartao').classList.remove('d-none');
        document.getElementById('modalCartaoTitulo').innerText = "Editar Cartão";
    } else {
        document.getElementById('card-id-edit').value = "";
        document.getElementById('card-nome').value = "";
        document.getElementById('card-limite').value = "";
        document.getElementById('card-bandeira').value = "Visa"; // Valor padrão inicial
        document.getElementById('card-cor-custom').value = "#6f42c1"; 
        document.getElementById('card-cor-fonte').value = "#ffffff"; // <-- ADICIONADO: Define branca por padrão para novos cartões
        document.getElementById('card-tipo').value = "Crédito";
        document.getElementById('card-fecha').value = "10";
        document.getElementById('card-vence').value = "15";
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
        corFonte: document.getElementById('card-cor-fonte').value, // <-- ADICIONADO: Captura o valor selecionado do formulário (preta ou branca)
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
        const idNumerico = Number(id); // Normaliza para Number antes da busca
        const idx = dados.cartoes.findIndex(c => c.id === idNumerico);
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
        document.getElementById('compra-emprestado').checked = c.emprestado || false; // <-- AGREGADO
        document.getElementById('btn-excluir-compra').classList.remove('d-none');
        document.getElementById('modalCompraTitulo').innerText = "Editar Compra";
    } else {
        document.getElementById('compra-id-edit').value = "";
        document.getElementById('compra-desc').value = "";
        document.getElementById('compra-valor').value = "";
        document.getElementById('compra-parcelas').value = 1;
        document.getElementById('compra-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('compra-emprestado').checked = false; // <-- AGREGADO
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
        pagamentos: compraAntiga ? (compraAntiga.pagamentos || []) : [],
        emprestado: document.getElementById('compra-emprestado').checked // <-- AGREGADO
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

    // Se for cartão emprestado, remove do extrato se já existia, e não insere um novo
    if (compra.emprestado) {
        if (movIdx > -1) {
            dados.movs.splice(movIdx, 1);
        }
    } else {
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
    }
    salvarERender();
    renderComprasCartao();
    bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
}
function excluirCompraNoModal() {
    const id = document.getElementById('compra-id-edit').value;
    if(!id) return;
    const idNumerico = Number(id); 
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    if(confirm("Excluir esta compra?")) {
        // CORREÇÃO: Usa comparação flexível ou normalização de tipo para evitar ignorar a remoção
        card.compras = card.compras.filter(c => Number(c.id) !== idNumerico); 
        dados.movs = dados.movs.filter(m => Number(m.idRelacionado) !== idNumerico); 
        salvarERender();
        renderComprasCartao();
        bootstrap.Modal.getInstance(document.getElementById('modalCompraCartao')).hide();
    }
}
function renderComprasCartao() {
    const card = dados.cartoes.find(x => x.id == cartaoContexto);
    const lista = document.getElementById('lista-compras-cartao');
    const info = document.getElementById('info-cartao-detalhe');
    const mesInput = document.getElementById('mes-atual') ? document.getElementById('mes-atual').value : new Date().toISOString().substring(0, 7);
    
    let gastoMes = 0;
    let comprasFiltradas = [];

        card.compras.forEach(c => {
        const dataCompra = new Date(c.data + 'T00:00:00');
        let pertenceAoMes = false;
        let parcelaAtualTexto = "";

        let parcelasAntecipadasQtd = c.pagamentos ? c.pagamentos.filter(p => p.antecipada).length : 0;
        let parcelasRestantes = c.parcelas - parcelasAntecipadasQtd;

        for (let i = 0; i < parcelasRestantes; i++) {
            let dataParcela = new Date(dataCompra.getFullYear(), dataCompra.getMonth() + i, 1);
            let anoP = dataParcela.getFullYear();
            let mesP = String(dataParcela.getMonth() + 1).padStart(2, '0');

            if (`${anoP}-${mesP}` === mesInput) {
                pertenceAoMes = true;
                parcelaAtualTexto = `(${i + 1}/${parcelasRestantes})`;
                gastoMes += (c.valorTotal / c.parcelas);
            }
        }
        if (pertenceAoMes) {
            comprasFiltradas.push({ ...c, infoParcela: parcelaAtualTexto });
        }
    });

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

                                lista.innerHTML = comprasFiltradas.map(c => {
        // Calcula o saldo devedor real da compra abatendo os pagamentos realizados
        const valorRestante = c.valorTotal - (c.pagamentos ? c.pagamentos.reduce((a, b) => a + b.valor, 0) : 0);
        const statusClass = valorRestante <= 0 ? 'text-success' : 'text-danger';
        const valorDaParcelaCorrente = c.valorTotal / c.parcelas;
        
        return `
        <div class="card-mov align-items-start py-3 mb-2 shadow-sm bg-white rounded-3">
            <div class="flex-grow-1 ms-2">
                <div class="fw-bold">${c.desc} <span class="badge bg-purple" style="font-size:0.65rem">${c.infoParcela}</span> ${c.emprestado ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem">EMPRESTADO</span>' : ''} ${valorRestante <= 0 ? '<span class="badge bg-success ms-1" style="font-size:0.6rem">PAGO</span>' : ''}</div>
                <small class="text-muted d-block">Total restante: R$ ${valorRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small>
                
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
                    R$ ${valorDaParcelaCorrente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
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
                    <li><button class="dropdown-item py-2" onclick="anteciparParcelaModal(${c.id})">
                        <i class="fas fa-forward text-info me-2"></i> Antecipar Próxima Parcela
                    </button></li>
                </ul>
            </div>
        </div>`;
    }).join('') || '<p class="text-center text-muted">Sem compras neste cartão.</p>';
}

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
        id: idEdit ? Number(idEdit) : Date.now(), // <-- CORREÇÃO: Mantém o padrão Number do resto do app
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
    // SE FOR VISITANTE: Impede a gravação física no localStorage para não apagar os dados de contas reais
    if (sessionStorage.getItem('user_ativo') === 'visitante' || usuarioAtivo === 'visitante') {
        renderTudo();
        return;
    }

    const stringDados = JSON.stringify(dados);
    // Calcula o tamanho em megabytes (1 caractere padrão UTF-16 ocupa aprox. 2 bytes em strings)
    const tamanhoMB = (stringDados.length * 2) / (1024 * 1024);
    
    // Se ultrapassar 4.5MB (próximo ao teto de 5MB), exibe um aviso crítico
    if (tamanhoMB > 4.5) {
        alert("⚠️ ATENÇÃO: Seu armazenamento local está quase cheio (" + tamanhoMB.toFixed(2) + "MB usados). Exportar um backup imediatamente é altamente recomendado para evitar perda de dados!");
    }

    localStorage.setItem('financas_pro_max', stringDados);
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
    renderizarHistoricoDividas(); // <-- ADICIONE ESTA LINHA AQUI
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
                <div class="fw-bold">${escaparHTML(m.desc)}</div> <small class="text-muted">${escaparHTML(m.cat)} • ${m.hora || '--:--'}</small>
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
    const mesInput = document.getElementById('mes-atual') ? document.getElementById('mes-atual').value : new Date().toISOString().substring(0, 7);

    const html = dados.cartoes.filter(c => c && typeof c.limite !== 'undefined').map(c => {
        let gastoTotalCartao = 0;
        if (c.compras && Array.isArray(c.compras)) {
            c.compras.forEach(compraItem => {
                // Lógica de parcelamento fixo nos meses subsequentes
                const dataCompra = new Date(compraItem.data + 'T00:00:00');
                const [anoAlvo, mesAlvo] = mesInput.split('-').map(Number);
                
                                let parcelasAntecipadasQtd = compraItem.pagamentos ? compraItem.pagamentos.filter(p => p.antecipada).length : 0;
                // O novo limite de parcelas ativas a serem exibidas consecutivamente na linha do tempo
                let parcelasRestantes = compraItem.parcelas - parcelasAntecipadasQtd;
                
                for (let i = 0; i < parcelasRestantes; i++) {
                    let dataParcela = new Date(dataCompra.getFullYear(), dataCompra.getMonth() + i, 1);
                    let anoP = dataParcela.getFullYear();
                    let mesP = String(dataParcela.getMonth() + 1).padStart(2, '0');
                    
                    if (`${anoP}-${mesP}` === mesInput) {
                        // Deduz os pagamentos já realizados para não cobrar limite de parcelas já pagas
                        const totalPagoJa = compraItem.pagamentos ? compraItem.pagamentos.reduce((a, b) => a + b.valor, 0) : 0;
                        if (totalPagoJa < compraItem.valorTotal) {
                            gastoTotalCartao += (compraItem.valorTotal / compraItem.parcelas);
                        }
                    }
                }
            });
        }
        
        return `
        <div class="col-6 mb-3">
            <div class="credit-card-container card-compact" style="background:${c.cor}; color:${c.corFonte || '#ffffff'};" onclick="verCompras(${c.id})">
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
// Altera o status selecionado e atualiza a interface dos botões
function setStatusDivida(status, botao) {
    statusDividaAtual = status;
    
    // Remove a classe ativa (btn-purple) de todos os botões do grupo e reseta para btn-light
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
        if (btn) {
            btn.classList.remove('btn-purple', 'text-white');
            btn.classList.add('btn-light');
        }
    });
    
    // Ativa o botão clicado apenas se o elemento for fornecido validamente
    if (botao && botao.classList) {
        botao.classList.remove('btn-light');
        botao.classList.add('btn-purple', 'text-white');
    }
    
    renderDividas();
}
// Reseta todos os filtros para o padrão original
function limparFiltrosDivida() {
    buscaDividaAtual = '';
    ordemDividaAtual = 'data-recente';
    statusDividaAtual = 'todas';
    
    // Reseta os elementos do HTML
    const inputBusca = document.getElementById('busca-divida');
    const selectOrdem = document.getElementById('ordenar-divida');
    if (inputBusca) inputBusca.value = '';
    if (selectOrdem) selectOrdem.value = 'data-recente';
    // Reseta visualmente os botões de status, ativando o "Todas"
    const botoes = document.querySelectorAll('.filter-status-btn');
    if (botoes.length > 0) {
        botoes.forEach(btn => {
            btn.classList.remove('btn-purple', 'text-white');
            btn.classList.add('btn-light');
        });
        botoes[0].classList.remove('btn-light');
        botoes[0].classList.add('btn-purple', 'text-white');
    }
    
    renderDividas();
}
function renderDividas() {
    // Pegamos a data atual formatada em string (ano-mes-dia) para comparar corretamente sem problemas de fuso horário
    const hojeStr = new Date().toISOString().split('T')[0];

    // 1. Filtra inicialmente por tipo de dívida
    let euDevo = dados.dividas.filter(d => d.tipo === 'eu-devo');
    let meDevem = dados.dividas.filter(d => d.tipo === 'me-devem');

    // 2. Aplica o filtro de busca por texto (Nome ou Descrição) se houver algo digitado
    if (buscaDividaAtual) {
        euDevo = euDevo.filter(d => 
            (d.nome && d.nome.toLowerCase().includes(buscaDividaAtual)) || 
            (d.desc && d.desc.toLowerCase().includes(buscaDividaAtual))
        );
        meDevem = meDevem.filter(d => 
            (d.nome && d.nome.toLowerCase().includes(buscaDividaAtual)) || 
            (d.desc && d.desc.toLowerCase().includes(buscaDividaAtual))
        );
    }

    // 2.5 Aplica o filtro por Status (Pendentes ou Vencidas)
    if (statusDividaAtual === 'pendentes') {
        // Pendente: Não passou do prazo ou não tem prazo definido
        euDevo = euDevo.filter(d => !d.prazo || d.prazo >= hojeStr);
        meDevem = meDevem.filter(d => !d.prazo || d.prazo >= hojeStr);
    } else if (statusDividaAtual === 'vencidas') {
        // Vencida: Tem prazo definido e esse prazo é menor que hoje
        euDevo = euDevo.filter(d => d.prazo && d.prazo < hojeStr);
        meDevem = meDevem.filter(d => d.prazo && d.prazo < hojeStr);
    }

    // Função auxiliar para aplicar a ordenação selecionada
    const aplicarOrdenacao = (lista) => {
        return lista.sort((a, b) => {
            if (ordemDividaAtual === 'data-recente') {
                return new Date(b.prazo || b.inicio) - new Date(a.prazo || a.inicio);
            }
            if (ordemDividaAtual === 'data-antiga') {
                return new Date(a.prazo || a.inicio) - new Date(b.prazo || b.inicio);
            }
            if (ordemDividaAtual === 'alfa-crescente') {
                return (a.nome || '').localeCompare(b.nome || '');
            }
            if (ordemDividaAtual === 'alfa-decrescente') {
                return (b.nome || '').localeCompare(a.nome || '');
            }
            return 0;
        });
    };

    // 3. Aplica a ordenação nas listas filtradas
    euDevo = aplicarOrdenacao(euDevo);
    meDevem = aplicarOrdenacao(meDevem);

    // O cálculo dos totais reflete o que está filtrado na tela
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
                <div class="text-dark" style="white-space: pre-line;">${escaparHTML(d.obs)}</div>
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
    
    // Adicione a chamada para renderizar o histórico também
    renderizarHistoricoDividas();
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
        
        // Adiciona a propriedade com a data atual em milissegundos para o controle de 30 dias
        item.dataQuitacaoMs = Date.now(); 
        
        // Salva no novo histórico de quitados em vez da lixeira
        dados.historicoQuitados.push(item);
        alert("Dívida quitada com sucesso e adicionada ao histórico!");
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
    
    // 2. Busca o ícone pelo ID (Garante compatibilidade caso o ID esteja no botão ou diretamente no <i>)
    let btnOlho = document.getElementById('btn-olho');
    if (btnOlho) {
        // Se o elemento com ID for o botão/div container, busca o <i> dentro dele
        if (btnOlho.tagName !== 'I') {
            btnOlho = btnOlho.querySelector('i');
        }
        
        if (btnOlho) {
            if (isOculto) {
                btnOlho.classList.remove("fa-eye");
                btnOlho.classList.add("fa-eye-slash");
            } else {
                btnOlho.classList.remove("fa-eye-slash");
                btnOlho.classList.add("fa-eye");
            }
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
    if (inputMes) {
        if (!inputMes.value) {
            inputMes.value = new Date().toISOString().substring(0, 7);
        }
        // Ouvinte adicionado para disparar o recarregamento ao trocar o mês de consulta do cabeçalho
        inputMes.addEventListener('change', () => {
            renderTudo();
            if(cartaoContexto) {
                renderComprasCartao();
            }
        });
    }
    if (!usuarioAtivo && localStorage.getItem('user_lembrado')) {
        usuarioAtivo = localStorage.getItem('user_lembrado');
        sessionStorage.setItem('user_ativo', usuarioAtivo);
    }

    // CORREÇÃO: Se for visitante ao dar F5, isola uma estrutura limpa em memória sem afetar chaves globais
    if (usuarioAtivo === 'visitante') {
        dados = { 
            movs: [], 
            cartoes: [], 
            dividas: [], 
            metas: [], 
            lixeira: [], 
            historicoQuitados: [], 
            config: { dark: false, oculto: false } 
        };
        if (typeof notas !== 'undefined') notas = [];
    }

    if(usuarioAtivo) {
        const telaLogin = document.getElementById('tela-login');
        if(telaLogin) telaLogin.style.display = 'none';
        
        // ADICIONADO: Garante que o nome permaneça renderizado após o refresh (F5)
        atualizarNomeUsuarioTela(usuarioAtivo);
    } else {
        // Se não tiver usuário ativo, garante que exiba Visitante por padrão no fundo
        atualizarNomeUsuarioTela('Visitante');
    }
    if(dados.config.dark) {
        document.body.setAttribute('data-bs-theme', 'dark');
        const btnTema = document.getElementById('btn-tema');
        if(btnTema) btnTema.classList.replace("fa-moon", "fa-sun");
    }

    if(dados.config.oculto) {
        document.body.classList.add('values-hidden');
        let btnOlho = document.getElementById('btn-olho');
        if(btnOlho) {
            if (btnOlho.tagName !== 'I') {
                btnOlho = btnOlho.querySelector('i');
            }
            if (btnOlho) {
                btnOlho.classList.remove("fa-eye");
                btnOlho.classList.add("fa-eye-slash");
            }
        }
    }
    // Escutadores para os filtros da tela de Dívidas (se os elementos existirem na tela)
    const inputBuscaDiv = document.getElementById('busca-divida');
    const selectOrdemDiv = document.getElementById('ordenar-divida');
    if (inputBuscaDiv) {
        inputBuscaDiv.addEventListener('input', (e) => {
            buscaDividaAtual = e.target.value.toLowerCase();
            renderDividas();
        });
    }
    if (selectOrdemDiv) {
        selectOrdemDiv.addEventListener('change', (e) => {
            ordemDividaAtual = e.target.value;
            renderDividas();
        });
    }
    
    // Novo escutador para o select unificado de filtro e ordenação juntas
    const selectUnificadoDiv = document.getElementById('filtro-ordenar-divida'); // <-- ADICIONE ESTE BLOCO
    if (selectUnificadoDiv) {
        selectUnificadoDiv.addEventListener('change', (e) => {
            tratarFiltroEOrdenacao(e.target.value);
        });
    }
    // Só processa dados se houver um usuário logado
    if (usuarioAtivo) {
        limparHistoricoAntigo();
        processarLancamentosFixos();
    }
    
    // Configuração segura da calculadora arrastável movida para o final do ciclo de boot
    calcContainer = document.getElementById('calc-container');
    calcHeader = document.getElementById('calc-header');
    
    if (calcHeader && calcContainer) {
        calcHeader.addEventListener('mousedown', startDrag);
        calcHeader.addEventListener('touchstart', startDrag, { passive: true });
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', () => isDragging = false);
        document.addEventListener('touchend', () => isDragging = false);
    }

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
    
    // Zera as horas de hoje e de três dias para uma comparação justa de datas inteiras
    const hojeZerado = new Date();
    hojeZerado.setHours(0,0,0,0);
    tresDias.setHours(23,59,59,999);

                const divAlert = dados.dividas.filter(d => {
        if (!d.prazo || d.pago) return false; // <-- CORREÇÃO: Ignora as que já estão marcadas como pagas
        const prazo = new Date(d.prazo + 'T00:00:00');
        return prazo >= hojeZerado && prazo <= tresDias;
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

    // Verifica se os dados locais já guardam um volume relevante de informações sem backup recente
    const tamanhoDadosBytes = JSON.stringify(dados).length * 2;
    const dadosRelevantesSemBackup = tamanhoDadosBytes > (1.5 * 1024 * 1024); // Mais de 1.5MB acumulados
    const backupAlert = dadosRelevantesSemBackup ? 1 : 0;

    totalAlertas = divAlert + cardAlert + orcamentoAlert + backupAlert;
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
        if (!d.prazo) return;
        const prazo = new Date(d.prazo + 'T00:00:00');
        const hojeLimpo = new Date(hoje);
        hojeLimpo.setHours(0,0,0,0);
        if (!d.pago && prazo >= hojeLimpo && prazo <= tresDias) {
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

    // Alerta preventivo na Central de Lembretes baseado no tamanho do armazenamento
    const tamanhoDadosMB = (JSON.stringify(dados).length * 2) / (1024 * 1024);
    if (tamanhoDadosMB > 1.5) {
        listaAvisos.push(`💾 SEGURANÇA: Seu volume de dados local está crescendo (${tamanhoDadosMB.toFixed(2)}MB). Use o botão "Exportar Backup" nas configurações para baixar sua cópia de segurança.`);
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

    // Destrói gráfico anterior de forma limpa antes de processar dados
    if (meuGrafico && typeof meuGrafico.destroy === 'function') { 
        meuGrafico.destroy(); 
        meuGrafico = null;
    }

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
    const backgroundColors = catsSorted.map(cat => coresMap[cat.trim()] || coresMap['Outros']); // <-- Correção e proteção contra espaços

    // Se não houver dados, impede a renderização de um gráfico vazio que quebraria o Chart.js
    if(labels.length === 0) {
        if (meuGrafico && typeof meuGrafico.destroy === 'function') { 
            meuGrafico.destroy(); 
        } 
        meuGrafico = null; // Garante a remoção da referência em cache global
        
        // CORREÇÃO: Limpa classes residuais de cores anteriores para o estado neutro
        balancoTxt.classList.remove('text-success', 'text-danger');
        balancoTxt.classList.add('text-dark');
        balancoTxt.innerText = "R$ 0,00";
        
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
        
        // CORREÇÃO: Garante cálculo seguro contra divisão por zero se o volume total do mês for 0
        const volumeTotalMes = totalEntradas + totalSaidas;
        const perc = volumeTotalMes > 0 ? ((totalCat / volumeTotalMes) * 100).toFixed(0) + '%' : '0%';
        
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
        // Verifica se já existe qualquer movimentação gerada para este mês com a mesma descrição original
        const jaExiste = dados.movs.some(m => m.desc.includes(f.desc) && m.data.startsWith(mesAtual));
        
        if (!jaExiste) {
            const diaOriginal = f.data.split('-')[2] ? f.data.split('-')[2].substring(0, 2) : "01";
            const novoLancamento = { 
                ...f, 
                id: Date.now() + Math.floor(Math.random() * 10000), 
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
        fim: fim,
        historico: [] // <-- Adicionado para guardar as movimentações da meta
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
                            <h6 class="fw-bold text-dark mb-0">${escaparHTML(m.nome)}</h6> <small class="text-muted" style="font-size: 0.75rem;">
                                ${dataIn} até ${dataAlvo}
                            </small>
                        </div>
                        <span class="badge bg-purple text-white">${progressoPerc}%</span>
                    </div>

                    <div class="d-flex justify-content-between my-2" style="font-size: 0.85rem;">
                        <span class="text-muted">Acumulado: <b class="text-success">R$ ${m.guardado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                        <span class="text-muted">Alvo: <b>R$ ${m.objetivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b></span>
                    </div>

                    <div class="progress mb-2" style="height: 10px; border-radius: 10px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${progressoPerc}%; border-radius: 10px;"></div>
                    </div>

                    ${m.historico && m.historico.length > 0 ? `
                    <div class="mt-2 mb-3 p-2 bg-light rounded-3 border-start border-purple border-3 shadow-sm" style="font-size: 0.75rem; max-height: 100px; overflow-y: auto;">
                        <div class="text-uppercase fw-bold text-muted mb-1" style="font-size: 0.65rem;">Histórico da Meta:</div>
                        ${m.historico.map((h, index) => `
                            <div class="text-dark d-flex justify-content-between align-items-center py-1 border-bottom-dashed">
                                <span>${h.tipo === 'poupar' ? '📥 Guardou' : '📤 Retirou'}: R$ ${h.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="text-muted" style="font-size: 0.7rem;">${h.data} às ${h.hora}</span>
                                    <button class="btn btn-sm text-danger p-0 border-0" onclick="excluirHistoricoMeta(${m.id}, ${index})" style="font-size: 0.85rem; line-height: 1;">&times;</button>
                                </div>
                            </div>
                        `).reverse().join('')}
                    </div>` : '<div class="text-muted text-center my-2" style="font-size: 0.75rem;">Nenhum depósito realizado.</div>'}

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

    // Garante que o array de histórico exista mesmo em metas antigas
    if (!meta.historico) meta.historico = [];

    const dataFormatadaBR = dataAtual.split('-').reverse().join('/');

    // Cria o ID único antes para usar tanto no extrato quanto no histórico da meta
    const idMovimentoGerado = Date.now();

    if (acao === 'poupar') {
        meta.guardado += valor;
        
        // Registra no histórico interno da meta (com o ID do movimento vinculado)
        meta.historico.push({
            tipo: 'poupar',
            valor: valor,
            data: dataFormatadaBR,
            hora: horaAtual,
            idMovimento: idMovimentoGerado // <-- Adicionado
        });
        
        // Gera um débito automático no extrato (Dinheiro saiu do saldo e foi pro cofre)
        dados.movs.push({
            id: idMovimentoGerado, // <-- Atualizado
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

        // Registra no histórico interno da meta
        meta.historico.push({
            tipo: 'resgatar',
            valor: valor,
            data: dataFormatadaBR,
            hora: horaAtual
        });

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
function excluirHistoricoMeta(metaId, index) {
    if (!confirm("Tem certeza que deseja apagar este registro do histórico? O saldo da meta será corrigido automaticamente.")) return;

    // CORREÇÃO: Usa a variável global 'dados' que o seu app já inicializou no topo do arquivo
    let meta = dados.metas.find(m => m.id === metaId);

    if (!meta || !meta.historico || !meta.historico[index]) return;

    const itemModificado = meta.historico[index];

    // Faz o estorno reverso no saldo guardado da meta
    if (itemModificado.tipo === 'poupar') {
        meta.guardado -= itemModificado.valor;
    } else if (itemModificado.tipo === 'resgatar') {
        meta.guardado += itemModificado.valor;
    }

    // Remove o item específico do histórico usando o index
    meta.historico.splice(index, 1);

    // SINCRONIZAÇÃO COM O EXTRATO:
    // 1º Tenta remover pelo ID vinculado (para novos registros)
    if (itemModificado.idMovimento) {
        dados.movs = dados.movs.filter(m => m.id !== itemModificado.idMovimento);
    } else {
        // 2º Se for um registro antigo sem ID, busca por descrição aproximada, valor e tipo para não deixar órfão
        const textoBusca = itemModificado.tipo === 'poupar' ? `Poupança: ${meta.nome}` : `Resgate: ${meta.nome}`;
        const idxExtrato = dados.movs.findIndex(m => m.desc === textoBusca && m.valor === itemModificado.valor);
        if (idxExtrato > -1) {
            dados.movs.splice(idxExtrato, 1);
        }
    }

    // Salva tudo e atualiza as telas de forma síncrona
    salvarERender();
}
function excluirMeta(id) {
    if (confirm("Deseja realmente excluir esta meta? O valor guardado não será devolvido automaticamente ao saldo geral.")) {
        const idNumerico = Number(id); // <-- Normalização para garantir tipagem estrita
        dados.metas = dados.metas.filter(m => m.id !== idNumerico);
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
        if (/[^0-9\+\-\*\/\.\(\)]/.test(calcExpressao)) throw new Error("Invalido");
        
        // Alteração segura: Evita a criação dinâmica com template strings para prevenir injeção de código
        let res = Function('"use strict"; return (' + calcExpressao + ')')();
        
        if (res === undefined || isNaN(res) || !isFinite(res)) throw new Error("Erro");
        if (!Number.isInteger(res)) res = parseFloat(res.toFixed(2));
        document.getElementById('calc-display').value = res;
        calcExpressao = res.toString();
    } catch (e) {
        document.getElementById('calc-display').value = 'Erro';
        calcExpressao = '';
    }
}
// Tornar a Janela Arrastável - Atribuição limpa usando as globais já existentes
// (Removidas as constantes duplicadas que causavam o travamento)

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
    if(!verificarAcesso()) return;
    
    const modal = new bootstrap.Modal(document.getElementById('modalNota'));
    const nota = id ? notas.find(n => n.id === id) : null;

    // Resetar campos
        document.getElementById('nota-id-edit').value = id || '';
    document.getElementById('nota-titulo').value = nota ? nota.titulo : '';
    document.getElementById('nota-texto').value = nota ? nota.texto : '';
    
    const elFixado = document.getElementById('nota-fixada');
    if (elFixado) elFixado.value = nota ? String(nota.fixada) : 'false';
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
    if(!verificarAcesso()) return;
    
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
    // O título de outras notas só aparece se existirem notas fixadas E também notas normais ao mesmo tempo
    tituloOutras.classList.toggle('d-none', fixadas.length === 0 || normais.length === 0);

        const criarCard = (nota) => `
        <div class="col-6 col-md-4 mb-3">
            <div class="nota-card shadow-sm position-relative text-start" style="background-color: ${nota.cor}; min-height: 120px; border-radius: 15px; overflow: hidden;">
                
                <div class="dropdown position-absolute top-0 end-0 m-2" style="z-index: 10;">
                    <button class="btn btn-link text-muted p-1 lh-1 border-0 shadow-none" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-ellipsis-v" style="font-size: 0.9rem;"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="font-size: 0.85rem;">
                        <li>
                            <button class="dropdown-item py-2" onclick="copiarNotaRapida(${nota.id})">
                                <i class="fas fa-copy text-secondary me-2"></i> Copiar Texto
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item py-2 text-danger" onclick="event.stopPropagation(); excluirNotaDireta(${nota.id})">
                                <i class="fas fa-trash-alt me-2"></i> Excluir Nota
                            </button>
                        </li>
                    </ul>
                </div>

                <div onclick="abrirModalNota(${nota.id})" class="w-100 p-3 pt-4" style="cursor: pointer; min-height: 120px;">
                    ${nota.fixada ? '<i class="fas fa-thumbtack pin-icon mb-1 d-block text-muted" style="font-size: 0.8rem;"></i>' : ''}
                    <div class="nota-titulo-card fw-bold text-dark text-truncate pe-3" style="font-size: 0.95rem; line-height: 1.2;">${escaparHTML(nota.titulo || 'Sem título')}</div>
                    <div class="nota-resumo-card text-muted mt-1 small text-wrap text-break pe-2" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escaparHTML(nota.texto || '')}</div>
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
// Remove automaticamente os itens do histórico quitado que passaram de 30 dias
function limparHistoricoAntigo() {
    if (!dados.historicoQuitados) return;
    
    const trintaDiasEmMs = 30 * 24 * 60 * 60 * 1000;
    const agora = Date.now();
    
    // Filtra mantendo apenas o que tem menos de 30 dias de quitado
    const totalAntes = dados.historicoQuitados.length;
    dados.historicoQuitados = dados.historicoQuitados.filter(item => {
        if (!item.dataQuitacaoMs) return true; // Se não tiver a marca de tempo, mantém por segurança
        return (agora - item.dataQuitacaoMs) < trintaDiasEmMs;
    });
    
    if (dados.historicoQuitados.length !== totalAntes) {
        salvarERender(); // Garante que a remoção automática seja salva usando sua função nativa correta
    }
}
// Renderiza a lista de histórico de dívidas quitadas na interface
function renderizarHistoricoDividas() {
    const lista = document.getElementById('lista-historico-dividas');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    if (!dados.historicoQuitados || dados.historicoQuitados.length === 0) {
        lista.innerHTML = `<div class="text-center text-muted py-3">Nenhuma dívida quitada neste mês.</div>`;
        return;
    }
    
    // Renderiza do mais recente para o mais antigo
    [...dados.historicoQuitados].reverse().forEach((item) => {
        const tipoBadge = item.tipo === 'eu-devo' ? 'bg-danger' : 'bg-success';
        const tipoTexto = item.tipo === 'eu-devo' ? 'Eu devia' : 'Me deviam';
        const dataVisual = item.dataQuitacaoMs ? new Date(item.dataQuitacaoMs).toLocaleDateString('pt-BR') : '---';
        
        const card = document.createElement('div');
        card.className = 'card-mov p-3 mb-2';
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center w-100">
                <div>
                    <span class="badge ${tipoBadge} mb-1">${tipoTexto}</span>
                    <h6 class="mb-0 fw-bold text-main">${item.nome || item.desc || 'Sem nome'}</h6>
                    <small class="text-muted d-block" style="font-size: 0.75rem;">Quitado em: ${dataVisual}</small>
                </div>
                <div class="text-end d-flex align-items-center gap-3">
                    <span class="fw-bold money-value text-muted">R$ ${parseFloat(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="excluirItemHistoricoManual(${item.id})" title="Mover para a lixeira">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        lista.appendChild(card);
    });
}

// Modificado para enviar para a lixeira em vez de deletar direto
function excluirItemHistoricoManual(id) {
    if (confirm("Deseja mover este registro do histórico para a lixeira?")) {
        const idNumerico = Number(id);
        const idx = dados.historicoQuitados.findIndex(item => item.id === idNumerico);
        if (idx === -1) return;
        const item = dados.historicoQuitados.splice(idx, 1)[0];
        item.origem = 'historicoQuitados'; // Identificador para restauração
        item.desc = `Histórico Hist.: ${item.nome || 'Dívida Quitada'}`; // Nome visível na lixeira
        dados.lixeira.push(item);
        
        salvarERender();
        renderizarHistoricoDividas();
    }
}
// Adicionar esta função isolada no escopo global do script:
function escaparHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function excluirNotaDireta(id) {
    if (confirm('Deseja excluir esta nota permanentemente?')) {
        notas = notas.filter(n => n.id != id);
        localStorage.setItem('financas_notas', JSON.stringify(notas));
        renderizarNotas();
    }
}

function copiarNotaRapida(id) {
    const nota = notas.find(n => n.id == id);
    if (!nota || !nota.texto) return alert('Esta nota não possui texto para copiar.');
    
    navigator.clipboard.writeText(nota.texto).then(() => {
        alert('Texto copiado para a área de transferência!');
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
    });
}
// Função auxiliar para capturar a mudança do select unificado
function tratarFiltroEOrdenacao(valor) {
    if (valor.startsWith('status-')) {
        // Extrai o status (todas, pendentes ou vencidas)
        const status = valor.replace('status-', '');
        statusDividaAtual = status; // <-- Define a variável global do filtro de status diretamente
        renderDividas(); // <-- Renderiza a tela aplicando o filtro imediatamente
    } else {
        // CORREÇÃO: Aplica a nova ordenação na variável global usada por renderDividas()
        ordemDividaAtual = valor;
        if (typeof renderDividas === 'function') {
            renderDividas(); 
        }
    }
}

function anteciparParcelaModal(idCompra) {
    const card = dados.cartoes.find(x => x.id == Number(cartaoContexto));
    const compra = card.compras.find(c => c.id == idCompra);
    const valorParcela = compra.valorTotal / compra.parcelas;
    
    if(!compra.pagamentos) compra.pagamentos = [];
    
    // Identifica quantas parcelas já foram amortizadas no total (seja por pagamento regular ou antecipação)
    let qtdJaPaga = compra.pagamentos.length;
    
    // Filtra dinamicamente os índices restantes baseando-se no saldo de parcelas abertas
    let parcelasDisponiveis = [];
    for(let i = qtdJaPaga; i < compra.parcelas; i++) {
        parcelasDisponiveis.push(i);
    }
    
    if(parcelasDisponiveis.length === 0) {
        return alert("Todas as parcelas desta compra já foram quitadas!");
    }
    
    // Pergunta ao usuário quantas ele deseja antecipar
    const qtdPrompt = prompt(`Esta compra possui ${parcelasDisponiveis.length} parcela(s) em aberto.\nQuantas parcelas você deseja antecipar?`);
    if (!qtdPrompt) return;
    
    const qtdAntecipar = parseInt(qtdPrompt);
    if (isNaN(qtdAntecipar) || qtdAntecipar <= 0 || qtdAntecipar > parcelasDisponiveis.length) {
        return alert("Quantidade inválida ou maior do que as parcelas restantes!");
    }
    
        const valorTotalAntecipacao = valorParcela * qtdAntecipar;
    // Inverte ou pega as últimas parcelas do final do contrato (de trás para frente)
    const parcelasSelecionadas = parcelasDisponiveis.slice(-qtdAntecipar);

    // Texto descritivo para o aviso (ex: "parcelas 2, 3 e 4")
    const numParcelasTexto = parcelasSelecionadas.map(n => n + 1).join(', ');
    
    if(confirm(`Confirmar a antecipação de ${qtdAntecipar} parcela(s) (Nº: ${numParcelasTexto}) no valor total de R$ ${valorTotalAntecipacao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}?`)) {
        const agora = new Date();
        const dataFormatada = agora.toLocaleDateString('pt-BR');
        const horaPagto = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
        
        // Registra cada uma das parcelas individualmente no histórico da compra
        parcelasSelecionadas.forEach(indexParcela => {
            compra.pagamentos.push({
                valor: valorParcela,
                data: dataFormatada,
                hora: horaPagto,
                numParcela: Number(indexParcela), // Garante tipo estrito
                antecipada: true
            });
        });
        
        // Cria um único débito no extrato com o valor somado das antecipações
        dados.movs.push({
            id: Date.now(),
            desc: `Antecipou ${qtdAntecipar}x: ${compra.desc} (Parc. ${numParcelasTexto})`,
            valor: valorTotalAntecipacao,
            tipo: 'saida',
            cat: 'Cartão',
            data: agora.toISOString().split('T')[0],
            hora: horaPagto
        });
        
        alert(`${qtdAntecipar} parcela(s) antecipada(s) com sucesso!`);
        salvarERender();
        renderComprasCartao();
    }
}
// Função para navegar entre os meses pelas setas do cabeçalho
function alterarMesNav(direcao) {
    const inputMes = document.getElementById('mes-atual');
    if (!inputMes || !inputMes.value) return;

    // Separa o ano e o mês atual do input em números
    let [ano, mes] = inputMes.value.split('-').map(Number);
    
    // Altera o mês (direcao pode ser 1 para avançar ou -1 para voltar)
    mes += direcao;

    // Ajusta a virada do ano
    if (mes < 1) {
        mes = 12;
        ano -= 1;
    } else if (mes > 12) {
        mes = 1;
        ano += 1;
    }

    // Atualiza o valor do campo de texto com o novo mês formatado
    inputMes.value = `${ano}-${String(mes).padStart(2, '0')}`;
    
    // Dispara o evento 'change' manualmente para atualizar os gráficos, extratos e cartões
    inputMes.dispatchEvent(new Event('change'));
}
// Função responsável por injetar o nome do usuário nos elementos do HTML de forma segura
function atualizarNomeUsuarioTela(nome) {
    if (!nome) nome = "Visitante";
    
    // Altere os IDs abaixo caso os seus no HTML tenham nomes diferentes
    const elSidebar = document.getElementById("txt-nome-usuario-sidebar");
    if (elSidebar) {
        elSidebar.innerText = nome;
    }

    const elPerfil = document.getElementById("txt-perfil-nome-exibicao");
    if (elPerfil) {
        elPerfil.innerText = nome;
    }
}
