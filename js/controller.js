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
        // Tenta carregar dados. Se falhar ou for vazio, inicia onboarding.
        if (Model.carregar()) {
            this.refreshDash();
        } else {
            View.atualizarOnboarding(1);
        }
        this.setupListeners();
    },

    refreshDash() {
        View.toDash(Model.usuario, Model.obterFraseAleatoria());
        View.render(Model.usuario);

        // Garante que o Model tenha os métodos antes de chamar
        const minHoje = Model.getMinHoje ? Model.getMinHoje() : 0;
        const nivel = Model.getNivel ? Model.getNivel() : {
            t: "Iniciante",
            i: "🌱"
        };

        View.updateStats(minHoje, nivel);
        View.atualizarLinkKey(Model.usuario.config.provider);
    },

    setupListeners() {
        // Inputs
        const tarefaInput = document.getElementById('input-tarefa-texto');
        if (tarefaInput) tarefaInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') this.tentarAdicionarTarefa();
        });

        const habitoInput = document.getElementById('input-habito');
        if (habitoInput) habitoInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') this.adicionarHabito();
        });

        const chatInput = document.getElementById('input-chat');
        if (chatInput) chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.enviarMensagemChat();
            }
        });

        // Atalhos de Teclado
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
                // Fecha modais abertos
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    const modalInstance = bootstrap.Modal.getInstance(openModal);
                    if (modalInstance) modalInstance.hide();
                }
                const openCanvas = document.querySelector('.offcanvas.show');
                if (openCanvas) {
                    const canvasInstance = bootstrap.Offcanvas.getInstance(openCanvas);
                    if (canvasInstance) canvasInstance.hide();
                }
            }
        });

        if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    },

    // --- RELATÓRIO (A FUNÇÃO QUE FALTAVA) ---
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
        // Cria tarefa do propósito
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

    // --- META SEMANAL (MODAL ATUALIZADO) ---
    definirMetaSemanal() {
        const input = document.getElementById('input-meta-semanal');
        if (input) {
            input.value = Model.usuario.metaSemanal || "";
            // Atalho para salvar com Enter (sem shift)
            input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.salvarMetaSemanal();
                }
            };
        }
        View.toggleModal('modalMeta', 'show');
        setTimeout(() => input && input.focus(), 300);
    },

    salvarMetaSemanal() {
        const val = document.getElementById('input-meta-semanal').value.trim();
        if (val) {
            Model.atualizarUsuario('metaSemanal', val);
            this.refreshDash();
            View.notify("Foco definido! 🎯");
        }
        View.toggleModal('modalMeta', 'hide');
    },

    // --- IA ---
    async organizarComIA() {
        const provider = Model.usuario.config.provider || 'gemini';
        const apiKey = Model.usuario.config.apiKey;
        if (!apiKey) {
            View.toggleModal('modalConfig', 'show');
            return View.notify("Configure sua API Key!", "error");
        }

        const inboxTasks = Model.usuario.tarefas.filter(t => t.isInbox);
        if (inboxTasks.length === 0) return View.notify("Inbox vazia.", "primary");

        View.toggleLoading(true, `IA ${provider.toUpperCase()} trabalhando...`);
        try {
            const classified = await AI_Manager.classificar(provider, apiKey, inboxTasks);
            classified.forEach(c => Model.atualizarTarefa(c.id, {
                importante: c.importante,
                urgente: c.urgente,
                tipo: c.tipo,
                isInbox: false
            }));
            View.render(Model.usuario);
            View.notify(`${classified.length} tarefas organizadas!`, "success");
        } catch (e) {
            alert(`Erro IA: ${e.message}`);
        } finally {
            View.toggleLoading(false);
        }
    },

    // --- Chat ---
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

        // Contexto completo com a Meta Semanal
        const context = {
            nome: Model.usuario.nome,
            proposito: Model.usuario.proposito,
            metaSemanal: Model.usuario.metaSemanal, // IMPORTANTE
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

        // Comando ADD
        const addMatch = resposta.match(/\[ADD: (.*?)\]/);
        if (addMatch) {
            Model.addTarefa(addMatch[1], false, false, 'manutencao', true);
            this.refreshDash(); // Atualiza paineis
            View.notify(`IA criou: "${addMatch[1]}"`, "success");
            textoFinal = textoFinal.replace(addMatch[0], '');
        }

        // Comando SET_GOAL (NOVO!)
        const goalMatch = resposta.match(/\[SET_GOAL: (.*?)\]/);
        if (goalMatch) {
            const novaMeta = goalMatch[1];
            Model.atualizarUsuario('metaSemanal', novaMeta);
            this.refreshDash();
            View.notify(`Meta da Semana atualizada! 🎯`, "success");
            textoFinal = textoFinal.replace(goalMatch[0], '');
        }

        // Comando ORGANIZE
        if (resposta.includes('[ORGANIZE]')) {
            this.organizarComIA();
            textoFinal = textoFinal.replace('[ORGANIZE]', '');
        }

        const bubble = document.getElementById(bubbleId);
        if (bubble) bubble.innerHTML = View.formatarTextoIA(textoFinal);
        Model.pushChatMessage('ai', textoFinal);
    },

    // --- Voz ---
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

    // --- Ações ---
    delTask(id) {
        if (confirm("Excluir?")) {
            Model.delTarefa(id);
            this.refreshDash();
        }
    },
    adicionarHabito() {
        const v = document.getElementById('input-habito').value.trim();
        if (v) {
            Model.addHabito(v);
            View.renderHabits(Model.usuario);
            document.getElementById('input-habito').value = '';
        }
    },
    toggleHabit(id) {
        Model.toggleHabito(id);
        View.renderHabits(Model.usuario);
    },
    delHabit(id) {
        if (confirm("Remover?")) {
            Model.delHabito(id);
            View.renderHabits(Model.usuario);
        }
    },

    // --- Foco ---
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
        if (confirm("Concluiu?")) {
            const inv = Math.ceil((Model.timer.tempoPadrao - Model.timer.tempoRestante) / 60);
            Model.concluirTarefa(Model.timer.tarefaAtualId, inv);
        }
        this.refreshDash();
    },
    cancelarFoco() {
        clearInterval(Model.timer.intervaloId);
        View.stopSound();
        this.refreshDash();
    },

    // --- Brain Dump e Configs ---
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
            if (Model.usuario.tarefas.filter(t => t.isInbox).length > 0 && k) setTimeout(() => this.organizarComIA(), 500);
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
        Model.usuario.config.tema = Model.usuario.config.tema === 'light' ? 'dark' : 'light';
        Model.salvar();
        View.applyTheme(Model.usuario.config.tema);
    },

    // --- SHUTDOWN ---
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
        if (confirm("Encerrar o dia? Tarefas pendentes serão movidas para amanhã.")) {
            const resultado = Model.encerrarDia();
            this.refreshDash();
            View.toggleModal('modalShutdown', 'hide');

            if (resultado.migradas > 0) {
                View.notify(`${resultado.migradas} tarefas migradas para amanhã. Foco! 🗓️`, "warning");
            } else {
                View.notify("Dia limpo! Bom descanso! 🌙", "success");
            }
        }
    }
};