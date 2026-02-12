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

    init() {
        if (Model.carregar()) {
            this.refreshDash();
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
            View.atualizarOnboarding(1);
        }
        this.setupListeners();
    },

    // --- MORNING SETUP ---
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
            // CORREÇÃO LÓGICA: Urgente=false, Importante=true -> Vai para Q2 (Deep Work/Meta)
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

    // --- ZUMBIS ---
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

        // CORREÇÃO CRÍTICA DO ERRO DE CONSOLE
        // O ID correto no HTML é 'input-habito-nome', não 'input-habito'
        const habitoInput = document.getElementById('input-habito-nome');
        if (habitoInput) {
            habitoInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') this.salvarNovoHabito(); // Chama direto a função de salvar
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
    },

    abrirRelatorio() {
        const xp = Model.getXP();
        const totalTarefas = (Model.usuario.historico || []).length;
        const streak = Math.max(...(Model.usuario.habitos || []).map(h => h.streak), 0);
        const dadosGrafico = Model.getDadosGraf();
        View.showReport(xp, totalTarefas, streak, dadosGrafico);
    },

    // --- Onboarding ---
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
        if (Model.usuario.proposito) Model.addTarefa(Model.usuario.proposito, true, true, 'crescimento');
        this.refreshDash();
        View.notify(`Bem-vindo, ${Model.usuario.nome}! 🚀`);
    },

    // --- Tarefas ---
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

    definirMetaSemanal() {
        // Renderiza o conteúdo do modal antes de abrir
        App.View.renderModalMetaSemanal();
        View.toggleModal('modalMeta', 'show');
    },

    salvarTextoMetaSemanal() {
        // Salva apenas o título (as sub-tarefas salvam direto)
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
            App.View.renderModalMetaSemanal(); // Re-renderiza a lista no modal
            this.refreshDash(); // Atualiza a barra de progresso no fundo
        }
    },

    toggleSubTarefaSemanal(id) {
        Model.toggleSubTarefaSemanal(id);
        App.View.renderModalMetaSemanal();
        this.refreshDash();
    },

    delSubTarefaSemanal(id) {
        Model.delSubTarefaSemanal(id);
        App.View.renderModalMetaSemanal();
        this.refreshDash();
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
            // MELHORIA: Mensagem mais clara baseada no erro
            let msg = "Erro na IA. Tente novamente.";
            if (e.message.includes("401") || e.message.includes("API Key")) msg = "Chave de API inválida. Verifique nos Ajustes.";
            if (e.message.includes("429") || e.message.includes("Quota")) msg = "Limite da API excedido (Quota).";

            View.notify(msg, "error");
            // Se falhar, abre o modal de config para o usuário corrigir se for chave
            if (msg.includes("Chave")) new bootstrap.Modal(document.getElementById('modalConfig')).show();
        } finally {
            View.toggleLoading(false);
        }
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

    delTask(id) {
        if (confirm("Excluir?")) {
            Model.delTarefa(id);
            this.refreshDash();
        }
    },
    adicionarHabito() {
        const v = document.getElementById('input-habito-nome').value.trim();
        if (v) {
            this.salvarNovoHabito();
        }
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
        Model.timer.startTime = Date.now();
        View.toFocus(t.texto, min);
        this.loopTimer();
    },
    loopTimer() {
        if (Model.timer.intervaloId) clearInterval(Model.timer.intervaloId);
        const dur = Model.timer.tempoPadrao * 1000;
        const start = Model.timer.startTime;
        Model.timer.intervaloId = setInterval(() => {
            if (!Model.timer.ativo) return;
            const elapsed = Date.now() - start;
            const rem = Math.ceil((dur - elapsed) / 1000);
            Model.timer.tempoRestante = rem;
            View.updateTimer(rem, Model.timer.tempoPadrao);
            if (rem <= 0) {
                this.pausarFoco();
                View.audio.play();
                new Notification("Fim!");
                View.notify("Tempo esgotado!");
            }
        }, 1000);
    },
    pausarFoco() {
        Model.timer.ativo = !Model.timer.ativo;
        if (!Model.timer.ativo) {
            View.stopSound();
            clearInterval(Model.timer.intervaloId);
        } else {
            Model.timer.startTime = Date.now() - ((Model.timer.tempoPadrao - Model.timer.tempoRestante) * 1000);
            this.loopTimer();
        }
        const btn = document.getElementById('btn-pausa');
        if (btn) btn.innerText = Model.timer.ativo ? 'Pausar' : 'Retomar';
    },

    concluirFoco() {
        clearInterval(Model.timer.intervaloId);
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
        clearInterval(Model.timer.intervaloId);
        View.stopSound();
        View.toDash();
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

    salvarConfiguracoes(fechar = false) {
        Model.usuario.config.tempoFocoMinutos = parseInt(document.getElementById('config-tempo').value);
        Model.usuario.config.provider = document.getElementById('config-provider').value;
        const k = document.getElementById('config-apikey').value.trim();
        if (k) Model.usuario.config.apiKey = k;
        Model.salvar();
        View.notify("Salvo!");
        if (fechar) {
            View.toggleModal('modalConfig', 'hide');
            if (Model.usuario.tarefas.filter(t => t.isInbox).length > 0 && k) setTimeout(() => App.Controller.organizarComIA(), 500);
        }
    },
    atualizarLinkKey() {
        View.atualizarLinkKey(document.getElementById('config-provider').value);
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
        if (confirm("Apagar tudo?")) {
            localStorage.clear();
            location.reload();
        }
    },
    alternarTema() {
        const current = Model.usuario.config.tema;
        const next = current === 'light' ? 'dark' : 'light';
        Model.usuario.config.tema = next;
        Model.salvar();
        View.applyTheme(next);
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

    // --- PLANEJAMENTO TRIMESTRAL ---
    abrirVisaoMacro() {
        // Renderiza a lista antes de abrir
        App.View.renderTrimestral(Model.usuario.metasTrimestrais || []);
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
            input.value = ''; // Limpa input
            // Re-renderiza a lista
            App.View.renderTrimestral(Model.usuario.metasTrimestrais);
            View.notify("Meta de longo prazo definida! 🔭");
        }
    },

    toggleMetaMacro(id) {
        Model.toggleMetaTrimestral(id);
        App.View.renderTrimestral(Model.usuario.metasTrimestrais);
    },

    delMetaMacro(id) {
        if (confirm("Desistir dessa meta?")) {
            Model.delMetaTrimestral(id);
            App.View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    // --- VISÃO MACRO (ATUALIZADO) ---
    adicionarSubTarefa(metaId) {
        const input = document.getElementById(`input-sub-${metaId}`);
        const valor = input.value.trim();
        if (valor) {
            Model.addSubTarefaMeta(metaId, valor);
            App.View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    toggleSubTarefa(metaId, subId) {
        Model.toggleSubTarefaMeta(metaId, subId);
        App.View.renderTrimestral(Model.usuario.metasTrimestrais);
    },

    delSubTarefa(metaId, subId) {
        if (confirm("Remover este passo?")) {
            Model.delSubTarefaMeta(metaId, subId);
            App.View.renderTrimestral(Model.usuario.metasTrimestrais);
        }
    },

    // --- NOVO: AUTO-QUEBRAR META COM IA ---
    async autoQuebrarMeta(metaId) {
        const meta = Model.usuario.metasTrimestrais.find(m => m.id == metaId);
        if (!meta) return;

        const provider = Model.usuario.config.provider;
        const apiKey = Model.usuario.config.apiKey;

        if (!apiKey) {
            View.notify("Configure sua API Key para usar a mágica! ✨", "error");
            return;
        }

        // Feedback visual (Botão girando)
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
                App.View.renderTrimestral(Model.usuario.metasTrimestrais);
                View.notify("Plano tático gerado! 🚀", "success");
            }
        } catch (e) {
            console.error(e);
            View.notify("Não consegui criar o plano. Verifique sua API Key.", "error");
            // Restaura o botão original
            btn.innerHTML = iconOriginal;
            btn.disabled = false;
        }
    },
};