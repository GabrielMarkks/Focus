import {
    Model
} from './model.js';
import {
    View
} from './view.js';
import {
    AI_Manager
} from './ai.js';

export const Controller = {
    pendingId: null,
    pendingTask: null,
    inboxProcessId: null,
    timerWorker: null,

    async init() {
        const sessao = await Model.verificarSessao();
        if (sessao) {
            this.iniciarAppLogado();
        } else {
            View.toLogin();
        }
        this.setupListeners();
    },

    async iniciarAppLogado() {
        View.toggleLoading(true, "A sincronizar com a nuvem... ☁️");
        const perfilCompleto = await Model.carregar();
        View.toggleLoading(false);

        if (perfilCompleto) {
            this.refreshDash();
            this._agendarNotificacoes(); // iniciar após dados carregados
            setTimeout(() => {
                const hoje = new Date().toLocaleDateString();
                if (!Model.usuario.config) Model.usuario.config = {};
                const ultimo = Model.usuario.config.ultimoMorning;
                if (ultimo !== hoje) {
                    this.abrirMorningSetup();
                } else {
                    this.verificarZumbis();
                }
            }, 1000);
        } else {
            Object.values(View.els).forEach(e => e && e.classList.add('d-none'));
            View.atualizarOnboarding(1);
        }
    },

    async cadastrar() {
        const email = document.getElementById('input-login-email').value.trim();
        const senha = document.getElementById('input-login-senha').value.trim();
        if (!email || !senha) return View.notify("Preencha email e senha", "error");

        View.toggleLoading(true, "Criando conta...");
        try {
            await Model.cadastrar(email, senha);
            View.notify("Conta criada com sucesso! 🚀", "success");
            this.iniciarAppLogado();
        } catch (error) {
            View.notify("Erro: " + error.message, "error");
        } finally {
            View.toggleLoading(false);
        }
    },

    async entrar() {
        const email = document.getElementById('input-login-email').value.trim();
        const senha = document.getElementById('input-login-senha').value.trim();
        if (!email || !senha) return View.notify("Preencha email e senha", "error");

        View.toggleLoading(true, "Entrando...");
        try {
            await Model.entrar(email, senha);
            View.notify("Bem-vindo de volta! ⚡", "success");
            this.iniciarAppLogado();
        } catch (error) {
            View.notify("Erro: " + error.message, "error");
        } finally {
            View.toggleLoading(false);
        }
    },

    abrirMorningSetup() {
        const nomeEl = document.getElementById('morning-name');
        if (nomeEl) nomeEl.innerText = Model.usuario.nome || "Campeão";
        View.toggleModal('modalMorning', 'show');
        setTimeout(() => {
            const input = document.getElementById('input-morning-focus');
            if (input) input.focus();
        }, 500);
    },

    finalizarMorning() {
        const foco = document.getElementById('input-morning-focus').value.trim();
        if (foco) {
            Model.addTarefa(foco, false, true, 'crescimento');
            View.notify("Foco definido! Vamos pra cima! 🚀", "success");
        }
        this.salvarMorningFeito();
    },

    pularMorning() {
        View.notify("Ok, direto para a ação.", "primary");
        this.salvarMorningFeito();
    },

    salvarMorningFeito() {
        Model.usuario.config.ultimoMorning = new Date().toLocaleDateString();
        Model.salvar();
        this.refreshDash();
        View.toggleModal('modalMorning', 'hide');
        setTimeout(() => this.verificarZumbis(), 2000);
    },

    verificarZumbis() {
        const hoje = Date.now();
        const LIMITE_DIAS = 3;
        const msPorDia = 24 * 60 * 60 * 1000;

        const zumbis = Model.usuario.tarefas.filter(t => {
            if (t.feita || !t.criadaEm) return false;
            const idade = (hoje - t.criadaEm) / msPorDia;
            return idade >= LIMITE_DIAS;
        });

        if (zumbis.length > 0 && !document.getElementById('toast-zumbi')) {
            const html = `
                <div id="toast-zumbi" class="toast show align-items-center text-bg-dark border-0 shadow-lg" role="alert" style="position: fixed; bottom: 20px; right: 20px; z-index: 10000;">
                    <div class="d-flex">
                        <div class="toast-body">
                            🧟‍♂️ <b>Alerta:</b> ${zumbis.length} Tarefas Zumbis!
                            <div class="mt-2 pt-2 border-top border-secondary">
                                <button type="button" class="btn btn-sm btn-danger rounded-pill px-3" onclick="App.Controller.resolverZumbis()">Eliminar Zumbis</button>
                                <button type="button" class="btn btn-sm btn-link text-white text-decoration-none ms-2" onclick="document.getElementById('toast-zumbi').remove()">Ignorar</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        }
    },

    async resolverZumbis() {
        const toast = document.getElementById('toast-zumbi');
        if (toast) toast.remove();

        const hoje = Date.now();
        const msPorDia = 24 * 60 * 60 * 1000;
        const zumbis = Model.usuario.tarefas
            .filter(t => !t.feita && t.criadaEm && ((hoje - t.criadaEm) / msPorDia >= 3))
            .map(t => ({
                texto: t.texto,
                dias: Math.floor((hoje - t.criadaEm) / msPorDia)
            }));

        this.abrirChat();
        View.appendChatBubble("🚨 Detectei tarefas estagnadas. Analisando...", "ai");

        const provider = Model.usuario.config.provider;
        const apiKey = Model.usuario.config.apiKey;

        if (!apiKey) return View.appendChatBubble("Configure sua API Key para eu te ajudar a limpar isso.", "ai");

        try {
            const resposta = await AI_Manager.negociarZumbis(provider, apiKey, zumbis);
            this.processarComandosIA(resposta, View.appendChatBubble('...', 'ai'));
        } catch (e) {
            View.notify("Erro na IA Zumbi", "error");
        }
    },

    refreshDash() {
        View.toDash(Model.usuario, Model.obterFraseAleatoria());
        View.render(Model.usuario);
        const minHoje = Model.getMinHoje ? Model.getMinHoje() : 0;
        const nivel = Model.getNivel ? Model.getNivel() : {
            t: "Iniciante",
            i: "🌱"
        };
        View.updateStats(minHoje, nivel);
        View.atualizarLinkKey(Model.usuario.config.provider);
    },

    setupListeners() {
        document.getElementById('input-tarefa-texto').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.tentarAdicionarTarefa();
        });

        const habitoInput = document.getElementById('input-habito-nome');
        if (habitoInput) {
            habitoInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') this.salvarNovoHabito();
            });
        }

        document.getElementById('input-chat').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.enviarMensagemChat();
            }
        });

        document.addEventListener('keydown', e => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                const el = document.getElementById('input-tarefa-texto');
                if (el) el.focus();
            }
            if (e.key.toLowerCase() === 'c') {
                e.preventDefault();
                this.abrirBrainDump();
            }
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) bootstrap.Modal.getInstance(openModal).hide();
                const openCanvas = document.querySelector('.offcanvas.show');
                if (openCanvas) bootstrap.Offcanvas.getInstance(openCanvas).hide();
            }
        });

        if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();

        // Load notification config when settings modal opens
        const modalConfigEl = document.getElementById('modalConfig');
        if (modalConfigEl) {
            modalConfigEl.addEventListener('show.bs.modal', () => {
                this._carregarConfigsNotif();
                View.applyTheme(Model.usuario.config.tema);
            });
        }

    },

    proximoPasso(n) {
        if (n === 2) {
            const nome = document.getElementById('input-name').value.trim();
            if (!nome) return View.notify("Diga seu nome!", "primary");
            Model.atualizarUsuario('nome', nome);
        }
        if (n === 3) {
            const prop = document.getElementById('input-proposito').value.trim();
            if (!prop) return View.notify("Defina um objetivo!", "primary");
            Model.atualizarUsuario('proposito', prop);
        }
        View.atualizarOnboarding(n);
    },

    voltarPasso(n) {
        View.atualizarOnboarding(n);
    },

    finalizarOnboarding() {
        const papeis = document.getElementById('input-papeis').value.split(',');
        Model.atualizarUsuario('papeis', papeis);
        // Marcar onboarding como concluído para nunca mais aparecer
        Model.usuario.config.onboardingConcluido = true;
        Model.salvar();
        if (Model.usuario.proposito) Model.addTarefa(Model.usuario.proposito, true, true, 'crescimento');
        this.refreshDash();
        View.notify(`Bem-vindo, ${Model.usuario.nome}! 🚀`);
    },

    tentarAdicionarTarefa() {
        const txt = document.getElementById('input-tarefa-texto').value.trim();
        if (!txt) return View.notify("Escreva algo!", "error");

        const imp = document.getElementById('check-importante').checked;
        const urg = document.getElementById('check-urgente').checked;
        const tipo = document.querySelector('input[name="tipoTarefa"]:checked').value;

        const growthCount = (Model.usuario.tarefas || []).filter(t => t.tipo === 'crescimento').length;
        if (tipo === 'crescimento' && growthCount >= 3) {
            this.pendingTask = {
                txt,
                imp,
                urg,
                tipo
            };
            document.getElementById('gatekeeper-proposito').innerText = `"${Model.usuario.proposito}"`;
            document.getElementById('gatekeeper-tarefa').innerText = `"${txt}"`;
            View.toggleModal('modalGatekeeper', 'show');
            return;
        }

        this.executarAdicao(txt, imp, urg, tipo);
    },

    rebaixarParaManutenção() {
        this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'manutencao');
        View.toggleModal('modalGatekeeper', 'hide');
    },

    forcarAdicao() {
        this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'crescimento');
        View.toggleModal('modalGatekeeper', 'hide');
    },

    executarAdicao(t, i, u, type, inbox = false) {
        Model.addTarefa(t, i, u, type, inbox);
        View.render(Model.usuario);
        const input = document.getElementById('input-tarefa-texto');
        if (input) input.value = '';
    },

    delTask(id) {
        if (confirm("Excluir?")) {
            Model.delTarefa(id);
            this.refreshDash();
        }
    },

    definirMetaSemanal() {
        View.renderModalMetaSemanal();
        View.toggleModal('modalMeta', 'show');
    },

    salvarTextoMetaSemanal() {
        const val = document.getElementById('input-meta-semanal-titulo').value.trim();
        Model.atualizarTextoMetaSemanal(val);
        this.refreshDash();
        View.notify("Título atualizado!");
    },

    addSubTarefaSemanal() {
        const input = document.getElementById('input-sub-semanal');
        const valor = input.value.trim();
        if (valor) {
            Model.addSubTarefaSemanal(valor);
            input.value = '';
            View.renderModalMetaSemanal();
            this.refreshDash();
        }
    },

    toggleSubTarefaSemanal(id) {
        Model.toggleSubTarefaSemanal(id);
        View.renderModalMetaSemanal();
        this.refreshDash();
    },

    delSubTarefaSemanal(id) {
        Model.delSubTarefaSemanal(id);
        View.renderModalMetaSemanal();
        this.refreshDash();
    },

    abrirVisaoMacro() {
        View.renderTrimestral(Model.usuario.metasTrimestrais || []);
        View.toggleModal('modalMacro', 'show');
        setTimeout(() => {
            const input = document.getElementById('input-meta-macro');
            if (input) input.focus();
        }, 500);
    },

    adicionarMetaMacro() {
        const input = document.getElementById('input-meta-macro');
        const valor = input.value.trim();
        if (valor) {
            Model.addMetaTrimestral(valor);
            input.value = '';
            View.renderTrimestral(Model.usuario.metasTrimestrais);
            View.notify("Meta de longo prazo definida! 🔭");
        }
    },

    toggleMetaMacro(id) {
        Model.toggleMetaTrimestral(id);
        View.renderTrimestral(Model.usuario.metasTrimestrais);
    },

    delMetaMacro(id) {
        if (confirm("Desistir dessa meta?")) {
            Model.delMetaTrimestral(id);
            View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    adicionarSubTarefa(metaId) {
        const input = document.getElementById(`input-sub-${metaId}`);
        const valor = input.value.trim();
        if (valor) {
            Model.addSubTarefaMeta(metaId, valor);
            View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    toggleSubTarefa(metaId, subId) {
        Model.toggleSubTarefaMeta(metaId, subId);
        View.renderTrimestral(Model.usuario.metasTrimestrais);
    },

    delSubTarefa(metaId, subId) {
        if (confirm("Remover este passo?")) {
            Model.delSubTarefaMeta(metaId, subId);
            View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    async autoQuebrarMeta(metaId) {
        const meta = Model.usuario.metasTrimestrais.find(m => m.id == metaId);
        if (!meta) return;

        const provider = Model.usuario.config.provider;
        const apiKey = Model.usuario.config.apiKey;

        if (!apiKey) {
            View.notify("Configure sua API Key para usar a mágica! ✨", "error");
            return;
        }

        const btn = document.getElementById(`btn-magic-${metaId}`);
        const iconOriginal = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        btn.disabled = true;

        try {
            const passos = await AI_Manager.gerarSubtarefas(provider, apiKey, meta.texto);
            if (Array.isArray(passos)) {
                passos.forEach(passo => {
                    Model.addSubTarefaMeta(metaId, passo);
                });
                View.renderTrimestral(Model.usuario.metasTrimestrais);
                View.notify("Plano tático gerado! 🚀", "success");
            }
        } catch (e) {
            console.error(e);
            View.notify("Não consegui criar o plano. Verifique sua API Key.", "error");
            btn.innerHTML = iconOriginal;
            btn.disabled = false;
        }
    },

    abrirBrainDump() {
        View.toggleModal('modalBrainDump', 'show');
        setTimeout(() => document.getElementById('input-brain-dump').focus(), 500);
    },

    adicionarBrainDump() {
        const t = document.getElementById('input-brain-dump').value.trim();
        if (t) {
            this.executarAdicao(t, false, false, 'manutencao', true);
            document.getElementById('input-brain-dump').value = '';
            View.toggleModal('modalBrainDump', 'hide');
            View.notify("Capturado!");
        }
    },

    iniciarProcessamentoInbox(id) {
        const t = Model.obterTarefa(id);
        if (!t) return;
        this.inboxProcessId = id;
        document.getElementById('inbox-task-text').innerText = t.texto;
        View.toggleModal('modalProcessarInbox', 'show');
    },

    confirmarProcessamento(i, u) {
        const tipo = document.querySelector('input[name="procTipo"]:checked').value;
        Model.moverInboxParaMatriz(this.inboxProcessId, i, u, tipo);
        this.refreshDash();
        View.toggleModal('modalProcessarInbox', 'hide');
        View.notify("Organizado!", "success");
    },

    async organizarComIA() {
        const provider = Model.usuario.config.provider || 'gemini';
        const apiKey = Model.usuario.config.apiKey;
        if (!apiKey) {
            View.toggleModal('modalConfig', 'show');
            return View.notify("Configure sua API Key!", "error");
        }

        const inboxTasks = Model.usuario.tarefas.filter(t => t.isInbox);
        if (inboxTasks.length === 0) return View.notify("Inbox vazia.", "primary");

        View.toggleLoading(true, `Organizando ${inboxTasks.length} tarefas...`);

        try {
            const classified = await AI_Manager.classificar(provider, apiKey, inboxTasks);
            let mudou = 0;
            classified.forEach(c => {
                const original = Model.usuario.tarefas.find(t => String(t.id) === String(c.id));
                if (original) {
                    original.importante = c.importante;
                    original.urgente = c.urgente;
                    original.tipo = c.tipo;
                    original.isInbox = false;
                    mudou++;
                }
            });
            Model.salvar();
            this.refreshDash();
            View.notify(`${mudou} tarefas organizadas com sucesso!`, "success");
        } catch (e) {
            console.error(e);
            let msg = "Erro na IA. Tente novamente.";
            if (e.message.includes("401") || e.message.includes("API Key")) msg = "Chave de API inválida. Verifique nos Ajustes.";
            if (e.message.includes("429") || e.message.includes("Quota")) msg = "Limite da API excedido (Quota).";
            View.notify(msg, "error");
            if (msg.includes("Chave")) new bootstrap.Modal(document.getElementById('modalConfig')).show();
        } finally {
            View.toggleLoading(false);
        }
    },

    abrirModalHabito() {
        document.getElementById('input-habito-nome').value = '';
        [1, 2, 3, 4, 5].forEach(d => document.getElementById(`dia-${d}`).checked = true);
        document.getElementById('dia-0').checked = false;
        document.getElementById('dia-6').checked = false;
        View.toggleModal('modalHabito', 'show');
        setTimeout(() => document.getElementById('input-habito-nome').focus(), 500);
    },

    salvarNovoHabito() {
        const nome = document.getElementById('input-habito-nome').value.trim();
        if (!nome) return View.notify("Dê um nome ao hábito!", "error");

        const diasSelecionados = [];
        for (let i = 0; i <= 6; i++) {
            if (document.getElementById(`dia-${i}`).checked) diasSelecionados.push(i);
        }

        if (diasSelecionados.length === 0) return View.notify("Selecione pelo menos um dia.", "warning");

        Model.addHabito(nome, diasSelecionados);
        View.render(Model.usuario);
        View.toggleModal('modalHabito', 'hide');
        View.notify("Hábito criado! Vamos manter a chama acesa 🔥", "success");
    },

    toggleHabit(id) {
        Model.toggleHabito(id);
        View.renderHabits(Model.usuario);
        const habito = Model.usuario.habitos.find(h => h.id === id);
        if (habito && habito.concluidoHoje) {
            View.playReward();
        }
    },

    delHabit(id) {
        if (confirm("Remover?")) {
            Model.delHabito(id);
            View.renderHabits(Model.usuario);
        }
    },

    startFocus(id) {
        this.pendingId = id;
        View.toggleModal('modalEnergia', 'show');
    },

    confirmarFoco(e) {
        View.toggleModal('modalEnergia', 'hide');
        const t = Model.obterTarefa(this.pendingId);
        if (!t) return;

        const min = e === 'alta' ? 50 : (e === 'baixa' ? 15 : 25);
        Model.timer.tarefaAtualId = this.pendingId;
        Model.timer.tempoPadrao = min * 60;
        Model.timer.tempoRestante = min * 60;
        Model.timer.ativo = true;

        View.toFocus(t.texto, min);

        if (!this.timerWorker) {
            this.timerWorker = new Worker('./js/timerWorker.js');
            this.timerWorker.onmessage = (msg) => {
                if (msg.data.status === 'tick') {
                    Model.timer.tempoRestante = msg.data.remaining;
                    View.updateTimer(msg.data.remaining, Model.timer.tempoPadrao);
                } else if (msg.data.status === 'done') {
                    this.finalizarTempoEsgotado();
                }
            };
        }

        this.timerWorker.postMessage({
            action: 'start',
            duration: Model.timer.tempoPadrao
        });
    },

    finalizarTempoEsgotado() {
        Model.timer.ativo = false;
        View.audio.play();
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Fim do Foco!", {
                body: "Bom trabalho. Hora de registrar."
            });
        }
        View.notify("Tempo esgotado!", "success");
        this.concluirFoco();
    },

    pausarFoco() {
        Model.timer.ativo = !Model.timer.ativo;
        const btn = document.getElementById('btn-pausa');

        if (!Model.timer.ativo) {
            View.stopSound();
            this.timerWorker.postMessage({
                action: 'pause'
            });
            if (btn) btn.innerText = 'Retomar';
        } else {
            this.timerWorker.postMessage({
                action: 'resume'
            });
            if (btn) btn.innerText = 'Pausar';
        }
    },

    concluirFoco() {
        if (this.timerWorker) this.timerWorker.postMessage({
            action: 'stop'
        });
        View.stopSound();
        Model.timer.ativo = false;

        document.getElementById('view-focus').classList.add('d-none');
        document.getElementById('nav-principal').classList.remove('d-none');
        document.getElementById('view-dashboard').classList.remove('d-none');

        View.toggleModal('modalConclusao', 'show');
    },

    confirmarConclusaoReal() {
        View.toggleModal('modalConclusao', 'hide');
        const tempoGasto = Model.timer.tempoPadrao - Model.timer.tempoRestante;
        const inv = Math.max(1, Math.ceil(tempoGasto / 60));
        Model.concluirTarefa(Model.timer.tarefaAtualId, inv);
        this.refreshDash();

        setTimeout(() => {
            View.playReward();
            View.notify(`VITÓRIA! +${inv} min de XP! 🚀`, "success");
        }, 500);
    },

    cancelarFoco() {
        if (this.timerWorker) this.timerWorker.postMessage({
            action: 'stop'
        });
        View.stopSound();
        Model.timer.ativo = false;
        View.toDash(Model.usuario, Model.obterFraseAleatoria());
    },

    abrirChat() {
        View.toggleModal('modalChat', 'show');
        if (Model.chatMemory && Model.chatMemory.history.length > 0) {
            View.restoreChatHistory(Model.chatMemory.history);
        }
        setTimeout(() => document.getElementById('input-chat').focus(), 500);
    },

    async enviarMensagemChat() {
        const input = document.getElementById('input-chat');
        const msg = input.value.trim();
        if (!msg) return;

        input.value = '';
        View.appendChatBubble(msg, 'user');
        Model.pushChatMessage('user', msg);

        const provider = Model.usuario.config.provider;
        const apiKey = Model.usuario.config.apiKey;
        if (!apiKey) return View.appendChatBubble("⚠️ Configure sua API Key nos ajustes.", 'ai');

        const loadingId = View.appendChatBubble('<div class="spinner-grow spinner-grow-sm" role="status"></div> Pensando...', 'ai');

        const context = {
            nome: Model.usuario.nome,
            proposito: Model.usuario.proposito,
            metaSemanal: Model.usuario.metaSemanal,
            metas: Model.usuario.metasTrimestrais,
            tarefas: Model.usuario.tarefas
        };

        try {
            const resposta = await AI_Manager.chat(provider, apiKey, msg, context, Model.chatMemory.history);
            this.processarComandosIA(resposta, loadingId);
        } catch (error) {
            const bubble = document.getElementById(loadingId);
            if (bubble) bubble.innerText = "Erro: " + error.message;
        }
    },

    processarComandosIA(resposta, bubbleId) {
        let textoFinal = resposta;
        let acaoExecutada = false;

        const addMatches = [...resposta.matchAll(/\[ADD: (.*?)\]/g)];
        if (addMatches.length > 0) {
            addMatches.forEach(match => {
                const tarefaTexto = match[1];
                Model.addTarefa(tarefaTexto, false, false, 'manutencao', true);
                textoFinal = textoFinal.replace(match[0], '');
            });
            View.render(Model.usuario);
            View.notify(`Adicionei ${addMatches.length} tarefas na Inbox!`, "success");
            acaoExecutada = true;
        }

        const goalMatch = resposta.match(/\[SET_GOAL: (.*?)\]/);
        if (goalMatch) {
            const novaMeta = goalMatch[1];
            Model.atualizarUsuario('metaSemanal', novaMeta);
            this.refreshDash();
            View.notify(`Meta definida: ${novaMeta}`, "success");
            textoFinal = textoFinal.replace(goalMatch[0], '');
            acaoExecutada = true;
        }

        const remMatch = resposta.match(/\[REMOVE: (.*?)\]/);
        if (remMatch) {
            const termo = remMatch[1].trim().toLowerCase();
            const task = Model.usuario.tarefas.find(t => t.texto.toLowerCase().includes(termo));
            if (task) {
                Model.delTarefa(task.id);
                this.refreshDash();
                View.notify(`🗑️ Tarefa "${task.texto}" apagada!`, "success");
            } else {
                View.notify(`Não encontrei a tarefa "${remMatch[1]}" para apagar.`, "warning");
            }
            textoFinal = textoFinal.replace(remMatch[0], '');
            acaoExecutada = true;
        }

        if (textoFinal.trim().length === 0 && acaoExecutada) {
            textoFinal = "✅ Feito! Atualizei seu painel.";
        }

        const bubble = document.getElementById(bubbleId);
        if (bubble) bubble.innerHTML = View.formatarTextoIA(textoFinal);
        Model.pushChatMessage('ai', textoFinal);
    },

    toggleVoice(inputId, btnId) {
        if (!('webkitSpeechRecognition' in window)) return View.notify("Use Chrome/Edge.", "error");
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.start();
        const btn = document.getElementById(btnId);
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner animate-spin text-danger"></i>';

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            const input = document.getElementById(inputId);
            input.value = input.value ? `${input.value} ${transcript}` : transcript;
        };
        recognition.onend = () => {
            btn.innerHTML = originalIcon || '<i class="ph ph-microphone"></i>';
            View.notify("Capturado!");
        };
        recognition.onerror = () => {
            btn.innerHTML = originalIcon;
            View.notify("Erro na voz.", "error");
        };
    },

    abrirRelatorio() {
        const xp = Model.getXP();
        const totalTarefas = (Model.usuario.historico || []).length;
        const streak = Math.max(...(Model.usuario.habitos || []).map(h => h.streak), 0);
        const dadosGrafico = Model.getDadosGraf();
        View.showReport(xp, totalTarefas, streak, dadosGrafico);
    },

    async gerarAnaliseIA() {
        const btn = document.getElementById('btn-analise-ia');
        const box = document.getElementById('box-feedback-ai');
        const txt = document.getElementById('texto-feedback-ai');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Pensando...';
        box.classList.add('d-none');

        const dados = {
            xp: Model.getXP(),
            totalTarefas: (Model.usuario.historico || []).length,
            graficos: Model.getDadosGraf()
        };

        const provider = Model.usuario.config.provider;
        const apiKey = Model.usuario.config.apiKey;

        if (!apiKey) {
            btn.disabled = false;
            btn.innerText = "🔮 Analisar Performance";
            return View.notify("Configure sua API Key primeiro!", "error");
        }

        try {
            const analise = await AI_Manager.analisarPerformance(provider, apiKey, dados);
            box.classList.remove('d-none');
            txt.innerHTML = View.formatarTextoIA(analise);
        } catch (error) {
            View.notify("Erro na análise: " + error.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerText = "🔮 Analisar Novamente";
        }
    },

    iniciarShutdown() {
        const m = Model.getMinHoje();
        const t = (Model.usuario.historico || []).length;
        const p = (Model.usuario.tarefas || []).length;
        const d = new Date().toLocaleDateString();
        let txt = `🚀 *Resumo ${d}*\n✅ ${t} Feitas\n⏱ ${m} min Foco\n📌 ${p} Pendentes\n`;
        document.getElementById('shutdown-score').innerText = `+${m}`;
        document.getElementById('shutdown-resumo-texto').innerText = txt;
        View.toggleModal('modalShutdown', 'show');
    },

    copiarResumo() {
        navigator.clipboard.writeText(document.getElementById('shutdown-resumo-texto').innerText);
        View.notify("Copiado!");
    },

    confirmarShutdown() {
        const resultado = Model.encerrarDia();
        View.toggleModal('modalShutdown', 'hide');
        this.refreshDash();
        if (resultado.migradas > 0) {
            View.notify(`${resultado.migradas} tarefas migradas para amanhã.`, "warning");
        } else {
            View.notify("Dia finalizado com sucesso! Bom descanso! 🌙", "success");
        }
        document.getElementById('display-minutos-foco').innerText = "0";
        document.getElementById('review-tarefas-feitas').innerText = "0";
        document.getElementById('lista-concluidas').innerHTML = '';
    },

    salvarConfiguracoes(fechar = false) {
        Model.usuario.config.tempoFocoMinutos = parseInt(document.getElementById('config-tempo').value);
        Model.usuario.config.provider = document.getElementById('config-provider').value;
        const k = document.getElementById('config-apikey').value.trim();
        if (k) Model.usuario.config.apiKey = k;
        Model.salvar();
        View.notify("Salvo!");

        if (fechar) {
            View.toggleModal('modalConfig', 'hide');
            if (Model.usuario.tarefas.filter(t => t.isInbox).length > 0 && k) {
                setTimeout(() => this.organizarComIA(), 500);
            }
        }
    },

    atualizarLinkKey() {
        View.atualizarLinkKey(document.getElementById('config-provider').value);
    },

    alternarTema() {
        const current = Model.usuario.config.tema;
        const next = current === 'light' ? 'dark' : 'light';
        Model.usuario.config.tema = next;
        Model.salvar();
        View.applyTheme(next);
    },

    baixarBackup() {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(Model.exportBackup());
        a.download = "focus.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
    },

    restaurarBackup() {
        const f = document.getElementById('arquivo-backup').files[0];
        if (!f) return View.notify("Selecione arquivo", "error");
        const r = new FileReader();
        r.onload = e => {
            if (Model.importBackup(e.target.result)) location.reload();
            else View.notify("Erro backup", "error");
        };
        r.readAsText(f);
    },

    resetarDados() {
        if (confirm("Apagar tudo? Isso deslogará a sessão e apagará os dados do dispositivo local.")) {
            localStorage.clear();
            location.reload();
        }
    },

    // ==========================================================
    // --- BEM-ESTAR ---
    // ==========================================================
    abrirBemEstar() {
        const el = document.getElementById('offcanvasBemEstar');
        if (!el) return;
        const canvas = bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
        canvas.show();
        setTimeout(() => View.renderBemEstar(), 100);
    },

    registrarCopo() {
        Model.registrarCopo();
        View.renderHidratacao();
    },

    removerCopo() {
        Model.removerCopo();
        View.renderHidratacao();
    },

    salvarMetaHidratacao() {
        const val = parseInt(document.getElementById('input-meta-hidratacao')?.value);
        if (!val || val < 1) return View.notify("Meta inválida.", "error");
        Model.setMetaHidratacao(val);
        View.renderHidratacao();
        View.notify("Meta de água atualizada! 💧", "success");
    },

    registrarSono() {
        const val = parseFloat(document.getElementById('input-sono-horas')?.value);
        if (!val || val <= 0 || val > 24) return View.notify("Horas inválidas.", "error");
        Model.registrarSono(val);
        View.renderSono();
        View.notify("Sono registrado! 😴", "success");
    },

    registrarTreino() {
        const desc = document.getElementById('input-treino-desc')?.value.trim();
        if (!desc) return View.notify("Descreva o treino.", "error");
        Model.registrarTreino(desc);
        document.getElementById('input-treino-desc').value = '';
        View.renderTreino();
        View.notify("Treino registrado! 💪", "success");
    },

    toggleSuplemento(nome) {
        Model.toggleSuplemento(nome);
        View.renderTreino();
    },

    adicionarVicio() {
        const nome = document.getElementById('input-vicio-nome')?.value.trim();
        if (!nome) return View.notify("Dê um nome ao hábito que quer evitar.", "error");
        Model.addVicio(nome);
        document.getElementById('input-vicio-nome').value = '';
        View.renderVicios();
        View.notify("Monitoramento iniciado! Você consegue! 💪", "success");
    },

    checkInVicio(id) {
        const ok = Model.checkInVicio(id);
        if (ok) {
            View.renderVicios();
            View.playReward();
            View.notify("Mais um dia mantido! Continue assim! 🏆", "success");
        } else {
            View.notify("Você já marcou hoje.", "primary");
        }
    },

    resetarVicio(id) {
        if (confirm("Registrar uma recaída vai zerar o streak. Confirma?")) {
            Model.resetarVicio(id);
            View.renderVicios();
            View.notify("Recomeço conta. Você consegue de novo! 💙", "primary");
        }
    },

    delVicio(id) {
        if (confirm("Remover este monitoramento?")) {
            Model.delVicio(id);
            View.renderVicios();
        }
    },

    // ==========================================================
    // --- FINANCEIRO ---
    // ==========================================================
    finMesRef: new Date(),

    abrirFinanceiro() {
        const el = document.getElementById('offcanvasFinanceiro');
        if (!el) return;
        this.finMesRef = new Date();
        const canvas = bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
        canvas.show();
        setTimeout(() => {
            View.renderResumoFinanceiro(this.finMesRef);
            View.renderFormTransacao();
            View.renderHistoricoFinanceiro();
            View.renderCalendarioFinanceiro(this.finMesRef);
        }, 100);
    },

    abrirTabLancar() {
        setTimeout(() => View.renderFormTransacao(), 50);
    },

    adicionarTransacao() {
        const tipo = document.querySelector('input[name="fin-tipo"]:checked')?.value;
        const valor = parseFloat(document.getElementById('fin-valor')?.value);
        const descricao = document.getElementById('fin-descricao')?.value.trim();
        const categoria = document.getElementById('fin-categoria')?.value;
        const data = document.getElementById('fin-data')?.value.trim();

        if (!tipo) return View.notify("Selecione o tipo.", "error");
        if (!valor || valor <= 0) return View.notify("Informe um valor válido.", "error");
        if (!descricao) return View.notify("Adicione uma descrição.", "error");

        Model.addTransacao(tipo, valor, descricao, categoria, data);

        View.renderResumoFinanceiro(this.finMesRef);
        View.renderFormTransacao();
        View.renderHistoricoFinanceiro();
        View.renderCalendarioFinanceiro(this.finMesRef);

        const icones = { receita: '💰', despesa: '💸', investimento: '📈' };
        View.notify(`${icones[tipo]} Lançado com sucesso!`, "success");
    },

    delTransacao(id) {
        if (confirm("Remover esta transação?")) {
            Model.delTransacao(id);
            View.renderResumoFinanceiro(this.finMesRef);
            View.renderHistoricoFinanceiro();
            View.renderCalendarioFinanceiro(this.finMesRef);
        }
    },

    buscarTransacoes(busca) {
        View.renderHistoricoFinanceiro(busca);
    },

    navegarCalFin(dir) {
        this.finMesRef = new Date(this.finMesRef.getFullYear(), this.finMesRef.getMonth() + dir, 1);
        View.renderResumoFinanceiro(this.finMesRef);
        View.renderCalendarioFinanceiro(this.finMesRef);
    },

    // ==========================================================
    // --- NOTAS ---
    // ==========================================================
    abrirNotas() {
        const el = document.getElementById('offcanvasNotas');
        if (!el) return;
        const canvas = bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
        canvas.show();
        setTimeout(() => {
            View.fecharNotaEditor();
            View.renderListaNotas();
        }, 100);
    },

    abrirNotaEditor(id) {
        View.renderNotaEditor(id || null);
    },

    novaNotaRapida() {
        View.renderNotaEditor(null);
    },

    salvarNota() {
        const id = document.getElementById('notas-editor')?.dataset.notaId;
        const titulo = document.getElementById('nota-titulo-input')?.value.trim();
        const conteudo = document.getElementById('nota-conteudo-input')?.value.trim();
        if (!conteudo) return View.notify("Escreva algo na nota.", "error");

        if (id) Model.updateNota(id, titulo, conteudo);
        else Model.addNota(titulo, conteudo);

        View.fecharNotaEditor();
        View.renderListaNotas();
        View.notify("Nota salva!", "success");
    },

    delNota(id) {
        if (confirm("Excluir esta nota?")) {
            Model.delNota(id);
            View.fecharNotaEditor();
            View.renderListaNotas();
        }
    },

    buscarNotas(q) {
        View.renderListaNotas(q);
    },

    // ==========================================================
    // --- TIME BLOCKING ---
    // ==========================================================
    agendaDataRef: new Date(),

    abrirAgenda() {
        const el = document.getElementById('offcanvasAgenda');
        if (!el) return;
        this.agendaDataRef = new Date();
        const canvas = bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
        canvas.show();
        setTimeout(() => View.renderAgenda(this.agendaDataRef), 100);
    },

    navegarAgenda(dir) {
        this.agendaDataRef = new Date(
            this.agendaDataRef.getFullYear(),
            this.agendaDataRef.getMonth(),
            this.agendaDataRef.getDate() + dir
        );
        View.renderAgenda(this.agendaDataRef);
    },

    abrirFormBloco(dataKey, horario) {
        const form = document.getElementById('form-bloco-agenda');
        if (!form) return;
        form.classList.remove('d-none');
        document.getElementById('bloco-data').value = dataKey;
        document.getElementById('bloco-horario').value = horario;
        document.getElementById('bloco-texto').value = '';
        document.getElementById('form-bloco-titulo').textContent = `Bloco às ${horario}`;
        const dur60 = document.getElementById('dur-60');
        if (dur60) dur60.checked = true;
        setTimeout(() => document.getElementById('bloco-texto')?.focus(), 100);
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    salvarBlocoAgenda() {
        const data = document.getElementById('bloco-data')?.value;
        const horario = document.getElementById('bloco-horario')?.value;
        const texto = document.getElementById('bloco-texto')?.value.trim();
        const duracao = parseInt(document.querySelector('input[name="bloco-dur"]:checked')?.value || '60');

        if (!texto) return View.notify("Descreva a atividade.", "error");
        Model.addBlocoTempo(data, horario, texto, duracao);

        const dataRef = Model._parseDateBR(data) || this.agendaDataRef;
        View.renderAgenda(dataRef);
        View.notify("Bloco adicionado! 🗓️", "success");
    },

    delBlocoAgenda(dataKey, id) {
        Model.delBlocoTempo(dataKey, id);
        const dataRef = Model._parseDateBR(dataKey) || this.agendaDataRef;
        View.renderAgenda(dataRef);
    },

    // ==========================================================
    // --- FILTRO DE PRIORIDADES ---
    // ==========================================================
    filtroFocoAtivo: false,

    toggleFiltroFoco() {
        this.filtroFocoAtivo = !this.filtroFocoAtivo;
        const btn = document.getElementById('btn-filtro-foco');
        const q3 = document.getElementById('col-q3');
        const q4 = document.getElementById('col-q4');
        const inbox = document.getElementById('painel-inbox');
        const banner = document.getElementById('banner-filtro-foco');

        if (this.filtroFocoAtivo) {
            q3?.classList.add('d-none');
            q4?.classList.add('d-none');
            inbox?.classList.add('d-none');
            banner?.classList.remove('d-none');
            btn?.classList.replace('btn-outline-secondary', 'btn-warning');
            btn?.classList.add('text-dark');
        } else {
            q3?.classList.remove('d-none');
            q4?.classList.remove('d-none');
            // Re-show inbox only if it has items
            if ((Model.usuario.tarefas || []).some(t => t.isInbox)) inbox?.classList.remove('d-none');
            banner?.classList.add('d-none');
            btn?.classList.replace('btn-warning', 'btn-outline-secondary');
            btn?.classList.remove('text-dark');
        }
        View.notify(this.filtroFocoAtivo ? '🎯 Modo Foco — só o essencial!' : 'Modo normal restaurado.', 'primary');
    },

    // ==========================================================
    // --- FASE 4: TEMAS ---
    // ==========================================================
    mudarTema(tema) {
        Model.usuario.config.tema = tema;
        Model.salvar();
        View.applyTheme(tema);
    },

    // ==========================================================
    // --- FASE 4: AI SETUP WIZARD ---
    // ==========================================================
    _rotinaGerada: null,

    abrirWizardIA() {
        this._rotinaGerada = null;
        const form = document.getElementById('wizard-form');
        const res = document.getElementById('wizard-resultado');
        const btnGerar = document.getElementById('btn-wizard-gerar');
        const btnAplicar = document.getElementById('btn-wizard-aplicar');
        if (form) form.classList.remove('d-none');
        if (res) { res.classList.add('d-none'); res.querySelector('#wizard-resultado-corpo').innerHTML = ''; }
        if (btnGerar) btnGerar.classList.remove('d-none');
        if (btnAplicar) btnAplicar.classList.add('d-none');
        View.toggleModal('modalWizardIA', 'show');
    },

    async executarWizardIA() {
        const objetivo = document.getElementById('wizard-objetivo')?.value.trim();
        const dificuldade = document.getElementById('wizard-dificuldade')?.value.trim();
        const horas = document.getElementById('wizard-horas')?.value;
        const area = document.getElementById('wizard-area')?.value;

        if (!objetivo || !dificuldade) return View.notify('Preencha as perguntas 1 e 2.', 'warning');

        const { provider, apiKey } = Model.usuario.config;
        if (!apiKey) return View.notify('Configure sua API Key nas configurações.', 'error');

        const btn = document.getElementById('btn-wizard-gerar');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Gerando...';

        try {
            const rotina = await AI_Manager.gerarRotina(provider, apiKey, { objetivo, dificuldade, horas, area });
            this._rotinaGerada = rotina;

            document.getElementById('wizard-form').classList.add('d-none');
            const corpo = document.getElementById('wizard-resultado-corpo');
            corpo.innerHTML = `
                <div class="alert alert-success border-0 rounded-3 mb-3">
                    <h6 class="fw-bold mb-2">🎯 Meta Semanal</h6>
                    <p class="mb-0">${View.escapeHTML(rotina.metaSemanal)}</p>
                </div>
                <div class="alert alert-info border-0 rounded-3 mb-3">
                    <h6 class="fw-bold mb-2">🚀 Meta Trimestral</h6>
                    <p class="mb-0">${View.escapeHTML(rotina.metaTrimestral)}</p>
                </div>
                <div class="card border-0 bg-body-tertiary rounded-3 mb-3">
                    <div class="card-body">
                        <h6 class="fw-bold mb-2">✅ Hábitos Sugeridos</h6>
                        <ul class="mb-0 ps-3">
                            ${(rotina.habitos || []).map(h => `<li class="small">${View.escapeHTML(h)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="alert alert-warning border-0 rounded-3 mb-0">
                    <h6 class="fw-bold mb-1">💡 Conselho Personalizado</h6>
                    <p class="mb-0 small">${View.escapeHTML(rotina.conselho)}</p>
                </div>
            `;
            document.getElementById('wizard-resultado').classList.remove('d-none');
            document.getElementById('btn-wizard-aplicar').classList.remove('d-none');
        } catch (e) {
            View.notify('Erro: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-sparkle me-1"></i> Gerar Minha Rotina';
        }
    },

    async aplicarRotinaIA() {
        if (!this._rotinaGerada) return;
        const r = this._rotinaGerada;

        // Definir meta semanal
        if (r.metaSemanal) {
            Model.atualizarTextoMetaSemanal(r.metaSemanal);
        }

        // Adicionar hábitos
        if (r.habitos && r.habitos.length) {
            const diasSemana = [0,1,2,3,4,5,6];
            for (const h of r.habitos) await Model.addHabito(h, diasSemana);
        }

        // Adicionar meta trimestral
        if (r.metaTrimestral) {
            Model.addMetaTrimestral(r.metaTrimestral);
        }

        this.refreshDash();
        View.toggleModal('modalWizardIA', 'hide');
        View.notify('🎉 Rotina aplicada com sucesso!', 'success');
        this._rotinaGerada = null;
    },

    // ==========================================================
    // --- FASE 4: NOTIFICAÇÕES ---
    // ==========================================================
    _notifTimers: [],

    salvarNotificacoes() {
        const habAtivo = document.getElementById('notif-habitos-ativo')?.checked;
        const habHora = document.getElementById('notif-habitos-hora')?.value;
        const resAtivo = document.getElementById('notif-resumo-ativo')?.checked;
        const resHora = document.getElementById('notif-resumo-hora')?.value;

        if (!Model.usuario.config.notificacoes) Model.usuario.config.notificacoes = {};
        Model.usuario.config.notificacoes = {
            habitos: { ativo: habAtivo, hora: habHora },
            resumoDiario: { ativo: resAtivo, hora: resHora }
        };
        Model.salvar();
        this._agendarNotificacoes();
        View.notify('Notificações salvas!');
    },

    _agendarNotificacoes() {
        this._notifTimers.forEach(t => clearTimeout(t));
        this._notifTimers = [];

        if (!('Notification' in window)) return;

        const cfg = Model.usuario.config.notificacoes || {};

        const agendar = (hora, mensagem) => {
            if (!hora) return;
            const [hh, mm] = hora.split(':').map(Number);
            const agora = new Date();
            const alvo = new Date();
            alvo.setHours(hh, mm, 0, 0);
            if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
            const delay = alvo - agora;
            const t = setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification('Focus Coach Pro', { body: mensagem, icon: '/icon-192.png' });
                }
                // reagendar para amanhã
                this._agendarNotificacoes();
            }, delay);
            this._notifTimers.push(t);
        };

        if (cfg.habitos?.ativo) {
            Notification.requestPermission().then(p => {
                if (p === 'granted') agendar(cfg.habitos.hora, '⚡ Hora de marcar seus hábitos do dia!');
            });
        }
        if (cfg.resumoDiario?.ativo) {
            Notification.requestPermission().then(p => {
                if (p === 'granted') agendar(cfg.resumoDiario.hora, '📊 Como foi seu dia? Veja seu resumo no Focus!');
            });
        }
    },

    _carregarConfigsNotif() {
        const cfg = Model.usuario.config.notificacoes || {};
        const habEl = document.getElementById('notif-habitos-ativo');
        const habHora = document.getElementById('notif-habitos-hora');
        const resEl = document.getElementById('notif-resumo-ativo');
        const resHora = document.getElementById('notif-resumo-hora');
        if (habEl && cfg.habitos) { habEl.checked = cfg.habitos.ativo; }
        if (habHora && cfg.habitos?.hora) { habHora.value = cfg.habitos.hora; }
        if (resEl && cfg.resumoDiario) { resEl.checked = cfg.resumoDiario.ativo; }
        if (resHora && cfg.resumoDiario?.hora) { resHora.value = cfg.resumoDiario.hora; }
    },

    // ==========================================================
    // --- FASE 4: HOBBIES ---
    // ==========================================================
    abrirFormHobby() {
        const nomeEl = document.getElementById('hobby-nome');
        if (nomeEl) nomeEl.value = '';
        View.toggleModal('modalFormHobby', 'show');
        setTimeout(() => nomeEl?.focus(), 400);
    },

    salvarHobby() {
        const nome = document.getElementById('hobby-nome')?.value.trim();
        const cat = document.getElementById('hobby-categoria')?.value;
        if (!nome) return View.notify('Dê um nome ao hobby.', 'warning');
        Model.addHobby(nome, cat);
        View.toggleModal('modalFormHobby', 'hide');
        View.renderHobbies(Model.getHobbies());
        View.notify('Hobby adicionado! 🎮');
    },

    checkinHobby(id) {
        Model.checkinHobby(id);
        View.renderHobbies(Model.getHobbies());
        View.notify('✅ Check-in registrado!', 'success');
    },

    delHobby(id) {
        if (!confirm('Remover este hobby?')) return;
        Model.delHobby(id);
        View.renderHobbies(Model.getHobbies());
    },

    // ==========================================================
    // --- FASE 4: VIAGENS ---
    // ==========================================================
    _viagemDetalheId: null,

    abrirViagens() {
        const el = document.getElementById('offcanvasViagens');
        if (!el) return;
        const canvas = bootstrap.Offcanvas.getInstance(el) || new bootstrap.Offcanvas(el);
        canvas.show();
        setTimeout(() => View.renderListaViagens(Model.getViagens()), 100);
    },

    abrirFormViagem(id = null) {
        document.getElementById('viagem-edit-id').value = id || '';
        document.getElementById('titulo-form-viagem').textContent = id ? 'Editar Viagem' : 'Nova Viagem';
        if (id) {
            const v = Model.getViagens().find(x => x.id === id);
            if (v) {
                document.getElementById('viagem-nome').value = v.nome || '';
                document.getElementById('viagem-destino').value = v.destino || '';
                document.getElementById('viagem-data-ida').value = v.dataIda || '';
                document.getElementById('viagem-data-volta').value = v.dataVolta || '';
                document.getElementById('viagem-orcamento').value = v.orcamento || '';
                document.getElementById('viagem-gasto').value = v.gasto || '';
            }
        } else {
            ['viagem-nome','viagem-destino','viagem-data-ida','viagem-data-volta','viagem-orcamento','viagem-gasto'].forEach(f => {
                document.getElementById(f).value = '';
            });
        }
        View.toggleModal('modalFormViagem', 'show');
    },

    salvarViagem() {
        const id = document.getElementById('viagem-edit-id').value;
        const dados = {
            nome: document.getElementById('viagem-nome').value.trim(),
            destino: document.getElementById('viagem-destino').value.trim(),
            dataIda: document.getElementById('viagem-data-ida').value,
            dataVolta: document.getElementById('viagem-data-volta').value,
            orcamento: parseFloat(document.getElementById('viagem-orcamento').value) || 0,
            gasto: parseFloat(document.getElementById('viagem-gasto').value) || 0
        };
        if (!dados.nome) return View.notify('Nome obrigatório.', 'warning');
        if (id) Model.updateViagem(id, dados);
        else Model.addViagem(dados);
        View.toggleModal('modalFormViagem', 'hide');
        View.renderListaViagens(Model.getViagens());
        View.notify('Viagem salva!', 'success');
    },

    delViagem(id) {
        if (!confirm('Remover esta viagem?')) return;
        Model.delViagem(id);
        View.renderListaViagens(Model.getViagens());
    },

    abrirDetalheViagem(id) {
        this._viagemDetalheId = id;
        const v = Model.getViagens().find(x => x.id === id);
        View.renderDetalheViagem(v);
        // Switch to detail tab
        const tabBtn = document.getElementById('tab-viagem-detalhe-btn');
        if (tabBtn) new bootstrap.Tab(tabBtn).show();
    },

    addItemChecklist(viagemId) {
        const input = document.getElementById('novo-item-checklist');
        const texto = input?.value.trim();
        if (!texto) return;
        Model.addItemChecklist(viagemId, texto);
        input.value = '';
        const v = Model.getViagens().find(x => x.id === viagemId);
        View.renderDetalheViagem(v);
    },

    toggleItemChecklist(viagemId, itemId) {
        Model.toggleItemChecklist(viagemId, itemId);
        const v = Model.getViagens().find(x => x.id === viagemId);
        View.renderDetalheViagem(v);
    },

    delItemChecklist(viagemId, itemId) {
        Model.delItemChecklist(viagemId, itemId);
        const v = Model.getViagens().find(x => x.id === viagemId);
        View.renderDetalheViagem(v);
    },

    verDiaFinanceiro(dia, mes, ano) {
        const container = document.getElementById('fin-detalhe-dia');
        if (!container) return;
        const diasPorDia = Model.getTransacoesPorDia(mes, ano);
        const ts = diasPorDia[dia] || [];
        if (ts.length === 0) { container.innerHTML = ''; return; }

        const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const itens = ts.map(t => {
            const cor = t.tipo === 'receita' ? 'text-success' : t.tipo === 'investimento' ? 'text-info' : 'text-danger';
            const sinal = t.tipo === 'receita' ? '+' : '-';
            return `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <div class="small fw-medium">${View.escapeHTML(t.descricao)}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${View.escapeHTML(t.categoria)}</div>
                </div>
                <span class="fw-bold ${cor}">${sinal}${fmt(t.valor)}</span>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="card border-0 bg-body-tertiary rounded-3 p-3">
                <h6 class="fw-bold mb-2">Dia ${dia}</h6>
                ${itens}
            </div>`;
    }
};