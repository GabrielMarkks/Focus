const App = {
    // ============================================================
    // 1. MODEL
    // ============================================================
    Model: {
        usuario: {
            nome: "",
            proposito: "",
            papeis: [],
            tarefas: [],
            historico: [],
            habitos: [],
            config: {
                tempoFocoMinutos: 25,
                tema: 'light',
                apiKey: '',
                provider: 'gemini'
            }
        },

        // --- NOVO: Memória do Chat ---
        chatMemory: {
            history: [], // [{role: 'user'|'ai', content: '...'}]
            lastActive: 0 // Timestamp
        },

        timer: {
            ativo: false,
            tempoTotal: 0,
            tempoRestante: 0,
            intervaloId: null,
            tarefaId: null,
            startTime: null
        },
        citacoes: ["Menos, porém melhor.", "O foco é a nova moeda.", "1% melhor todo dia.", "Feito é melhor que perfeito.", "Sua atenção é seu maior ativo."],

        salvar() {
            try {
                localStorage.setItem('focusApp_user', JSON.stringify(this.usuario));
                localStorage.setItem('focusApp_chat', JSON.stringify(this.chatMemory));
            } catch (e) {
                console.error(e)
            }
        },

        carregar() {
            // Carrega Dados
            const d = localStorage.getItem('focusApp_user');
            if (d) {
                try {
                    const p = JSON.parse(d);
                    this.usuario = {
                        ...this.usuario,
                        ...p
                    };
                    ['tarefas', 'historico', 'habitos'].forEach(k => {
                        if (!Array.isArray(this.usuario[k])) this.usuario[k] = [];
                    });
                    if (!this.usuario.config) this.usuario.config = {};
                    if (!this.usuario.config.provider) this.usuario.config.provider = 'gemini';
                } catch (e) {}
            }

            // Carrega e Valida Chat (30 min de validade)
            const c = localStorage.getItem('focusApp_chat');
            if (c) {
                try {
                    const chatData = JSON.parse(c);
                    const now = Date.now();
                    // 30 min = 1800000ms
                    if (now - chatData.lastActive < 1800000) {
                        this.chatMemory = chatData;
                    } else {
                        // Expirou? Limpa.
                        this.chatMemory = {
                            history: [],
                            lastActive: now
                        };
                    }
                } catch (e) {}
            }

            this.checkDia();
            return !!d;
        },

        // Gerencia histórico
        pushChatMessage(role, content) {
            this.chatMemory.history.push({
                role,
                content
            });
            // Mantém só as últimas 10 para economizar tokens
            if (this.chatMemory.history.length > 10) this.chatMemory.history = this.chatMemory.history.slice(-10);
            this.chatMemory.lastActive = Date.now();
            this.salvar();
        },

        checkDia() {
            const hoje = new Date().toDateString();
            let mudou = false;
            if (Array.isArray(this.usuario.habitos)) {
                this.usuario.habitos.forEach(h => {
                    if (h.ultimaData !== hoje) {
                        h.concluidoHoje = false;
                        mudou = true;
                    }
                });
            }
            if (mudou) this.salvar();
        },

        atualizarUsuario(k, v) {
            this.usuario[k] = v;
            this.salvar();
        },

        // --- CRUD TAREFAS ---
        addTarefa(texto, imp, urg, tipo = 'manutencao', inbox = false) {
            if (!Array.isArray(this.usuario.tarefas)) this.usuario.tarefas = [];
            this.usuario.tarefas.push({
                id: Date.now() + Math.random(),
                texto,
                importante: imp,
                urgente: urg,
                tipo,
                isInbox: inbox,
                feita: false
            });
            this.salvar();
        },
        atualizarTarefa(id, dados) {
            const t = this.usuario.tarefas.find(task => String(task.id) === String(id));
            if (t) {
                Object.assign(t, dados);
                this.salvar();
            }
        },
        concluirTarefa(id, minutos) {
            const idx = this.usuario.tarefas.findIndex(t => String(t.id) === String(id));
            if (idx !== -1) {
                const t = this.usuario.tarefas[idx];
                this.usuario.historico.push({
                    ...t,
                    dataConclusao: new Date().toISOString(),
                    tempoInvestido: minutos,
                    feita: true
                });
                this.usuario.tarefas.splice(idx, 1);
                this.salvar();
            }
        },
        delTarefa(id) {
            if (Array.isArray(this.usuario.tarefas)) {
                this.usuario.tarefas = this.usuario.tarefas.filter(t => String(t.id) !== String(id));
                this.salvar();
            }
        },
        limparTodasTarefas() {
            this.usuario.tarefas = [];
            this.salvar();
        },

        obterTarefa(id) {
            if (!Array.isArray(this.usuario.tarefas)) return null;
            return this.usuario.tarefas.find(t => String(t.id) === String(id));
        },

        moverInboxParaMatriz(id, imp, urg, tipo) {
            const t = this.obterTarefa(id);
            if (t) {
                t.isInbox = false;
                t.importante = imp;
                t.urgente = urg;
                t.tipo = tipo;
                this.salvar();
            }
        },

        // --- CRUD HÁBITOS ---
        addHabito(t) {
            if (!Array.isArray(this.usuario.habitos)) this.usuario.habitos = [];
            this.usuario.habitos.push({
                id: Date.now(),
                texto: t,
                streak: 0,
                ultimaData: null,
                concluidoHoje: false
            });
            this.salvar();
        },
        toggleHabito(id) {
            const h = (this.usuario.habitos || []).find(x => x.id == id);
            if (h) {
                const hoje = new Date().toDateString();
                if (!h.concluidoHoje) {
                    h.concluidoHoje = true;
                    h.ultimaData = hoje;
                    h.streak++;
                } else {
                    h.concluidoHoje = false;
                    h.ultimaData = null;
                    h.streak = Math.max(0, h.streak - 1);
                }
                this.salvar();
            }
        },
        delHabito(id) {
            if (Array.isArray(this.usuario.habitos)) {
                this.usuario.habitos = this.usuario.habitos.filter(x => x.id != id);
                this.salvar();
            }
        },

        // --- ANALYTICS ---
        getXP() {
            return (this.usuario.historico || []).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
        },
        calcularMinutosHoje() {
            const h = new Date().toDateString();
            return (this.usuario.historico || []).filter(x => new Date(x.dataConclusao).toDateString() === h).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
        },
        getMinHoje() {
            return this.calcularMinutosHoje();
        },
        getNivel() {
            const xp = this.getXP();
            return xp < 60 ? {
                t: "Iniciante",
                i: "🌱"
            } : (xp < 300 ? {
                t: "Focado",
                i: "🧘"
            } : {
                t: "Lenda",
                i: "👑"
            });
        },
        getDadosGraf() {
            let d = {
                q1: 0,
                q2: 0,
                q3: 0,
                q4: 0,
                cresc: 0,
                manut: 0
            };
            const last7 = new Date();
            last7.setDate(last7.getDate() - 7);
            (this.usuario.historico || []).forEach(h => {
                if (new Date(h.dataConclusao) >= last7) {
                    const t = h.tempoInvestido || 0;
                    if (h.urgente && h.importante) d.q1 += t;
                    else if (!h.urgente && h.importante) d.q2 += t;
                    else if (h.urgente && !h.importante) d.q3 += t;
                    else d.q4 += t;
                    if (h.tipo === 'crescimento') d.cresc += t;
                    else d.manut += t;
                }
            });
            return d;
        },

        exportBackup() {
            return JSON.stringify(this.usuario, null, 2);
        },
        importBackup(json) {
            try {
                const d = JSON.parse(json);
                if (d.nome) {
                    this.usuario = d;
                    this.salvar();
                    return true;
                }
            } catch (e) {}
            return false;
        },
        obterFraseAleatoria() {
            return this.citacoes[Math.floor(Math.random() * this.citacoes.length)];
        }
    },

    // ============================================================
    // 2. VIEW
    // ============================================================
    View: {
        els: {
            onboard: document.getElementById('view-onboarding'),
            dash: document.getElementById('view-dashboard'),
            focus: document.getElementById('view-focus'),
            nav: document.getElementById('nav-principal')
        },
        audio: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'),
        ambience: {
            chuva: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
            cafe: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
            fluxo: 'https://actions.google.com/sounds/v1/transportation/airplane_cabin_sounds.ogg'
        },
        currentSound: null,
        charts: {},

        notify(msg, type = 'success') {
            const box = document.getElementById('toast-container');
            if (!box) return;
            const bg = type === 'success' ? 'text-bg-success' : (type === 'error' ? 'text-bg-danger' : 'text-bg-primary');
            box.innerHTML += `<div class="toast align-items-center ${bg} border-0 show" role="alert"><div class="d-flex"><div class="toast-body fw-bold">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
            setTimeout(() => {
                if (box.lastChild) box.lastChild.remove();
            }, 3500);
        },

        toggleLoading(show, msg = "Processando...") {
            let el = document.getElementById('loading-overlay');
            if (!el) {
                el = document.createElement('div');
                el.id = 'loading-overlay';
                el.className = 'position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 d-flex flex-column justify-content-center align-items-center';
                el.style.zIndex = "20000";
                el.innerHTML = `<div class="spinner-border text-light mb-3"></div><h5 class="text-light fw-bold" id="loading-msg">${msg}</h5>`;
                document.body.appendChild(el);
            }
            if (show) {
                document.getElementById('loading-msg').innerText = msg;
                el.classList.remove('d-none');
            } else el.classList.add('d-none');
        },

        showStep(n) {
            document.querySelectorAll('.step-container').forEach(e => e.classList.add('d-none'));
            const s = document.getElementById(`step-${n}`);
            if (s) s.classList.remove('d-none');
        },

        toDash() {
            this.stopSound();
            Object.values(this.els).forEach(e => e && e.classList.add('d-none'));
            this.els.dash.classList.remove('d-none');
            this.els.nav.classList.remove('d-none');
            document.title = "Focus Coach";
            this.render();
            this.updateStats();
            this.applyTheme();
            const f = document.getElementById('frase-coach');
            if (f) f.innerText = `💡 "${App.Model.obterFraseAleatoria()}"`;

            // Popula Configs
            const key = document.getElementById('config-apikey');
            if (key) key.value = App.Model.usuario.config.apiKey || '';
            const prov = document.getElementById('config-provider');
            if (prov) prov.value = App.Model.usuario.config.provider || 'gemini';
            App.Controller.atualizarLinkKey();
        },

        toFocus(txt, min) {
            this.els.dash.classList.add('d-none');
            this.els.nav.classList.add('d-none');
            this.els.focus.classList.remove('d-none');
            document.getElementById('foco-titulo').innerText = txt;
            this.updateTimer(min * 60, min * 60);
            const b = document.getElementById('badge-modo-foco');
            if (min >= 50) {
                b.innerText = "⚡ DEEP WORK";
            } else if (min <= 15) {
                b.innerText = "🔋 START RÁPIDO";
            } else {
                b.innerText = "🚀 FLUXO";
            }
            Object.values(this.ambience).forEach(a => {
                if (typeof a === 'object') a.pause();
            });
        },

        applyTheme() {
            document.documentElement.setAttribute('data-bs-theme', App.Model.usuario.config.tema || 'light');
        },
        alternarHistorico() {
            const el = document.getElementById('painel-historico');
            if (el) el.classList.toggle('d-none');
        },

        render() {
            const ls = {
                q1: document.getElementById('lista-q1'),
                q2: document.getElementById('lista-q2'),
                q3: document.getElementById('lista-q3'),
                q4: document.getElementById('lista-q4'),
                inbox: document.getElementById('lista-inbox'),
                done: document.getElementById('lista-concluidas')
            };
            if (!ls.q1) return;
            Object.values(ls).forEach(l => l.innerHTML = '');
            const counts = {
                q1: 0,
                q2: 0,
                q3: 0,
                q4: 0
            };

            (App.Model.usuario.tarefas || []).forEach(t => {
                const badge = t.tipo === 'crescimento' ? '<span class="badge badge-crescimento ms-2">🚀</span>' : '<span class="badge badge-manutencao ms-2">🔧</span>';
                const html = `<li class="list-group-item d-flex justify-content-between align-items-center animate-fade-in"><div class="d-flex align-items-center gap-2 overflow-hidden w-100">${t.isInbox ? `<button class="btn btn-sm btn-outline-info rounded-circle" onclick="App.Controller.iniciarProcessamentoInbox(${t.id})"><i class="ph ph-list-plus"></i></button>` : `<button class="btn btn-sm btn-light rounded-circle border shadow-sm" onclick="App.Controller.startFocus(${t.id})"><i class="ph ph-play-fill text-primary"></i></button>`}<span class="task-text text-truncate">${t.texto}</span>${!t.isInbox?badge:''}</div><i class="ph ph-trash btn-delete-task ms-2" onclick="App.Controller.delTask(${t.id})"></i></li>`;
                if (t.isInbox) ls.inbox.innerHTML += html;
                else if (t.urgente && t.importante) {
                    ls.q1.innerHTML += html;
                    counts.q1++
                } else if (!t.urgente && t.importante) {
                    ls.q2.innerHTML += html;
                    counts.q2++
                } else if (t.urgente && !t.importante) {
                    ls.q3.innerHTML += html;
                    counts.q3++
                } else {
                    ls.q4.innerHTML += html;
                    counts.q4++
                }
            });

            ['q1', 'q2', 'q3', 'q4'].forEach(k => {
                const el = document.getElementById(`empty-${k}`);
                if (el) counts[k] === 0 ? el.classList.remove('d-none') : el.classList.add('d-none');
            });

            const inboxPanel = document.getElementById('painel-inbox');
            if (ls.inbox.innerHTML.trim() !== "") {
                inboxPanel.classList.remove('d-none');
                document.getElementById('count-inbox').innerText = ls.inbox.children.length;
            } else inboxPanel.classList.add('d-none');

            (App.Model.usuario.historico || []).slice().reverse().slice(0, 5).forEach(t => ls.done.innerHTML += `<li class="list-group-item bg-transparent text-muted text-decoration-line-through d-flex justify-content-between"><span><i class="ph ph-check-circle text-success me-2"></i>${t.texto}</span><small>+${t.tempoInvestido}m</small></li>`);
            this.renderHabits();
        },

        renderHabits() {
            const lh = document.getElementById('lista-habitos');
            if (lh) {
                lh.innerHTML = '';
                (App.Model.usuario.habitos || []).forEach(h => {
                    lh.innerHTML += `<li class="list-group-item d-flex justify-content-between"><div class="d-flex gap-3"><input class="form-check-input mt-0" type="checkbox" ${h.concluidoHoje?'checked':''} onchange="App.Controller.toggleHabit(${h.id})"><span>${h.texto}</span><small>🔥 ${h.streak}</small></div><i class="ph ph-trash opacity-50" onclick="App.Controller.delHabit(${h.id})"></i></li>`
                });
            }
        },

        updateStats() {
            const m = App.Model.getMinHoje(),
                nv = App.Model.getNivel();
            document.getElementById('display-minutos-foco').innerText = m;
            document.getElementById('badge-nivel').innerText = `${nv.i} ${nv.t}`;
            const b = document.getElementById('barra-dia-fundo');
            if (b) b.style.width = `${Math.min((m/240)*100,100)}%`;
        },
        updateTimer(r, t) {
            const m = Math.floor(r / 60),
                s = Math.floor(r % 60);
            document.getElementById('foco-timer').innerText = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            document.getElementById('barra-progresso').style.width = `${100-((r/t)*100)}%`;
        },

        alternarSom(t) {
            if (this.currentSound === t) {
                this.audio.pause();
                this.currentSound = null;
            } else {
                this.stopSound();
                this.audio.src = this.ambience[t];
                this.audio.loop = true;
                this.audio.play().catch(() => {});
                this.currentSound = t;
            }
            this.updateSoundBtns();
        },
        stopSound() {
            this.audio.pause();
            this.currentSound = null;
            this.updateSoundBtns();
        },
        updateSoundBtns() {
            ['chuva', 'cafe', 'fluxo'].forEach(t => {
                const b = document.getElementById(`btn-som-${t}`);
                if (b) {
                    if (this.currentSound === t) {
                        b.classList.remove('btn-outline-secondary');
                        b.classList.add('btn-light', 'text-dark');
                    } else {
                        b.classList.remove('btn-light', 'text-dark');
                        b.classList.add('btn-outline-secondary');
                    }
                }
            });
        },

        // --- CHAT VISUAL ---
        appendChatBubble(texto, tipo) {
            const container = document.getElementById('chat-history');
            const id = 'bubble-' + Date.now();
            const div = document.createElement('div');
            div.id = id;
            div.className = `chat-bubble ${tipo}`;
            div.innerHTML = tipo === 'ai' ? texto : texto.replace(/\n/g, '<br>');
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            return id;
        },

        restoreChatHistory(history) {
            const container = document.getElementById('chat-history');
            if (history.length > 0) container.innerHTML = '';
            history.forEach(msg => {
                const div = document.createElement('div');
                div.className = `chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
                div.innerHTML = msg.content.replace(/\n/g, '<br>');
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        },

        formatarTextoIA(texto) {
            // Remove as tags de comando para não mostrar pro usuário
            const limpo = texto.replace(/\[ADD:.*?\]/g, '').replace(/\[ORGANIZE\]/g, '').trim();
            return limpo.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        },

        showReport() {
            document.getElementById('review-total-minutos').innerText = App.Model.getXP();
            document.getElementById('review-tarefas-feitas').innerText = (App.Model.usuario.historico || []).length;
            document.getElementById('review-streak').innerText = Math.max(...(App.Model.usuario.habitos || []).map(h => h.streak), 0);
            const d = App.Model.getDadosGraf(),
                tot = d.q1 + d.q2 + d.q3 + d.q4,
                fb = document.getElementById('review-feedback');
            if (tot === 0) fb.innerHTML = "Sem dados semanais.";
            else {
                const pQ2 = (d.q2 / tot) * 100;
                if (pQ2 > 50) {
                    fb.innerHTML = "🌟 <b>Semana de Ouro!</b> Foco real.";
                    fb.className = "alert alert-success border mt-2";
                } else if ((d.q1 + d.q3) / tot > 60) {
                    fb.innerHTML = "🔥 <b>Modo Bombeiro.</b> Planeje melhor.";
                    fb.className = "alert alert-warning border mt-2";
                } else fb.innerHTML = "Continue registrando.";
            }
            const c1 = document.getElementById('graficoFoco');
            if (c1) {
                if (this.charts.f) this.charts.f.destroy();
                this.charts.f = new Chart(c1, {
                    type: 'doughnut',
                    data: {
                        labels: ['Crise', 'Meta', 'Delegar', 'Lixo'],
                        datasets: [{
                            data: [d.q1, d.q2, d.q3, d.q4],
                            backgroundColor: ['#dc3545', '#0d6efd', '#ffc107', '#6c757d'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        cutout: '75%',
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                })
            }
            const c2 = document.getElementById('graficoQualidade');
            if (c2) {
                if (this.charts.q) this.charts.q.destroy();
                this.charts.q = new Chart(c2, {
                    type: 'bar',
                    data: {
                        labels: ['Rotina', 'Crescimento'],
                        datasets: [{
                            label: 'Min',
                            data: [d.manut, d.cresc],
                            backgroundColor: ['#adb5bd', '#198754'],
                            borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                })
            }
            new bootstrap.Modal(document.getElementById('modalRelatorio')).show();
        }
    },

    // ============================================================
    // 3. CONTROLLER
    // ============================================================
    Controller: {
        pendingId: null,
        inboxProcessId: null,

        init() {
            if (App.Model.carregar()) {
                App.View.toDash();
            } else {
                App.Controller.atualizarOnboarding(1);
            }

            // Listeners
            document.getElementById('input-tarefa-texto').addEventListener('keypress', e => {
                if (e.key === 'Enter') App.Controller.tentarAdicionarTarefa();
            });
            document.getElementById('input-habito').addEventListener('keypress', e => {
                if (e.key === 'Enter') App.Controller.adicionarHabito();
            });

            // CORREÇÃO DO ENTER NO CHAT
            document.getElementById('input-chat').addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    App.Controller.enviarMensagemChat();
                }
            });

            document.addEventListener('keydown', e => {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
                if (e.key.toLowerCase() === 'n') {
                    e.preventDefault();
                    document.getElementById('input-tarefa-texto').focus();
                }
                if (e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    this.abrirBrainDump();
                }
                if (e.key === 'Escape') {
                    const m = document.querySelector('.modal.show');
                    if (m) bootstrap.Modal.getInstance(m).hide();
                    const o = document.querySelector('.offcanvas.show');
                    if (o) bootstrap.Offcanvas.getInstance(o).hide();
                }
            });
            if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
        },

        // --- ONBOARDING ---
        atualizarOnboarding(passo) {
            document.querySelectorAll('.step-container').forEach(e => e.classList.add('d-none'));
            const atual = document.getElementById(`step-${passo}`);
            if (atual) {
                atual.classList.remove('d-none');
                const input = atual.querySelector('input, textarea');
                if (input) setTimeout(() => input.focus(), 300);
            }
            const prog = document.getElementById('onboarding-progress');
            if (prog) prog.style.width = `${passo * 33.33}%`;
        },
        proximoPasso(n) {
            if (n === 2) {
                const nome = document.getElementById('input-name').value.trim();
                if (!nome) return App.View.notify("Diga seu nome!", "primary");
                App.Model.atualizarUsuario('nome', nome);
            }
            if (n === 3) {
                const prop = document.getElementById('input-proposito').value.trim();
                if (!prop) return App.View.notify("Defina um objetivo!", "primary");
                App.Model.atualizarUsuario('proposito', prop);
            }
            this.atualizarOnboarding(n);
        },
        voltarPasso(n) {
            this.atualizarOnboarding(n);
        },
        finalizarOnboarding() {
            const papeis = document.getElementById('input-papeis').value.split(',');
            App.Model.atualizarUsuario('papeis', papeis);
            const proposito = App.Model.usuario.proposito;
            if (proposito) App.Model.addTarefa(proposito, true, true, 'crescimento');
            App.View.toDash();
            App.View.notify(`Bem-vindo, ${App.Model.usuario.nome}! 🚀`);
        },

        // --- TAREFAS ---
        tentarAdicionarTarefa() {
            const txt = document.getElementById('input-tarefa-texto').value.trim();
            if (!txt) return App.View.notify("Escreva algo!", "error");
            const imp = document.getElementById('check-importante').checked;
            const urg = document.getElementById('check-urgente').checked;
            const tipo = document.querySelector('input[name="tipoTarefa"]:checked').value;

            const growthCount = (App.Model.usuario.tarefas || []).filter(t => t.tipo === 'crescimento').length;
            if (tipo === 'crescimento' && growthCount >= 3) {
                this.pendingTask = {
                    txt,
                    imp,
                    urg,
                    tipo
                };
                document.getElementById('gatekeeper-proposito').innerText = `"${App.Model.usuario.proposito}"`;
                document.getElementById('gatekeeper-tarefa').innerText = `"${txt}"`;
                new bootstrap.Modal(document.getElementById('modalGatekeeper')).show();
                return;
            }
            this.executarAdicao(txt, imp, urg, tipo);
        },
        rebaixarParaManutenção() {
            this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'manutencao');
            bootstrap.Modal.getInstance(document.getElementById('modalGatekeeper')).hide();
        },
        forcarAdicao() {
            this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'crescimento');
            bootstrap.Modal.getInstance(document.getElementById('modalGatekeeper')).hide();
        },
        executarAdicao(t, i, u, type, inbox = false) {
            App.Model.addTarefa(t, i, u, type, inbox);
            App.View.render();
            document.getElementById('input-tarefa-texto').value = '';
        },

        // --- IA MAGIC SORT ---
        async organizarComIA() {
            const provider = App.Model.usuario.config.provider || 'gemini';
            const apiKey = App.Model.usuario.config.apiKey;
            if (!apiKey) {
                new bootstrap.Modal(document.getElementById('modalConfig')).show();
                return App.View.notify("Configure sua API Key!", "error");
            }

            const inboxTasks = App.Model.usuario.tarefas.filter(t => t.isInbox);
            if (inboxTasks.length === 0) return App.View.notify("Inbox vazia.", "primary");

            App.View.toggleLoading(true, `IA ${provider.toUpperCase()} organizando...`);

            try {
                const classified = await AI_Manager.classificar(provider, apiKey, inboxTasks);
                classified.forEach(c => {
                    App.Model.atualizarTarefa(c.id, {
                        importante: c.importante,
                        urgente: c.urgente,
                        tipo: c.tipo,
                        isInbox: false
                    });
                });
                App.View.render();
                App.View.notify(`${classified.length} tarefas organizadas!`, "success");
            } catch (e) {
                alert(`Erro IA: ${e.message}`);
            } finally {
                App.View.toggleLoading(false);
            }
        },

        // --- CHAT COM IA & AGENTE ---
        abrirChat() {
            new bootstrap.Modal(document.getElementById('modalChat')).show();
            if (App.Model.chatMemory.history.length > 0) App.View.restoreChatHistory(App.Model.chatMemory.history);
            setTimeout(() => document.getElementById('input-chat').focus(), 500);
        },
        async enviarMensagemChat() {
            const input = document.getElementById('input-chat');
            const msg = input.value.trim();
            if (!msg) return;

            input.value = ''; // Limpa input
            App.View.appendChatBubble(msg, 'user');
            App.Model.pushChatMessage('user', msg);

            const context = {
                nome: App.Model.usuario.nome || "Usuário",
                proposito: App.Model.usuario.proposito || "Focar",
                tarefas: App.Model.usuario.tarefas || []
            };
            const provider = App.Model.usuario.config.provider || 'gemini';
            const apiKey = App.Model.usuario.config.apiKey;

            if (!apiKey) return App.View.appendChatBubble("⚠️ Configure sua API Key nos ajustes.", 'ai');

            const loadingId = App.View.appendChatBubble('<div class="spinner-grow spinner-grow-sm" role="status"></div>', 'ai');

            try {
                // Chama a IA (com histórico)
                const resposta = await AI_Manager.chat(provider, apiKey, msg, context, App.Model.chatMemory.history);

                // Processa a resposta em busca de Comandos
                this.processarComandosIA(resposta, loadingId);

            } catch (error) {
                const bubble = document.getElementById(loadingId);
                if (bubble) bubble.innerText = "Erro: " + error.message;
            }
        },

        // --- CÉREBRO DO AGENTE (EXECUTA AÇÕES) ---
        processarComandosIA(resposta, bubbleId) {
            let textoFinal = resposta;
            let acaoExecutada = false;

            // Comando [ADD: ...]
            const addMatch = resposta.match(/\[ADD: (.*?)\]/);
            if (addMatch) {
                const tarefaTexto = addMatch[1];
                App.Model.addTarefa(tarefaTexto, false, false, 'manutencao', true); // Adiciona na Inbox
                App.View.render();
                App.View.notify(`IA criou: "${tarefaTexto}"`, "success");
                textoFinal = textoFinal.replace(addMatch[0], ''); // Remove comando do texto
                acaoExecutada = true;
            }

            // Comando [ORGANIZE]
            if (resposta.includes('[ORGANIZE]')) {
                this.organizarComIA();
                textoFinal = textoFinal.replace('[ORGANIZE]', '');
                acaoExecutada = true;
            }

            // Atualiza UI do Chat
            const bubble = document.getElementById(bubbleId);
            if (bubble) bubble.innerHTML = App.View.formatarTextoIA(textoFinal);

            // Salva na memória o texto limpo (sem comandos técnicos)
            App.Model.pushChatMessage('ai', textoFinal);
        },

        // --- VOZ ---
        toggleVoice(inputId, btnId) {
            if (!('webkitSpeechRecognition' in window)) return App.View.notify("Use Chrome/Edge.", "error");
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.start();
            const btn = document.getElementById(btnId);
            btn.innerHTML = '<i class="ph ph-spinner animate-spin text-danger"></i>';
            recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                const input = document.getElementById(inputId);
                input.value = input.value ? `${input.value} ${transcript}` : transcript;
            };
            recognition.onend = () => {
                btn.innerHTML = '<i class="ph ph-microphone"></i>';
                App.View.notify("Ok!");
            };
        },

        // --- EXTRAS ---
        iniciarProcessamentoInbox(id) {
            this.inboxProcessId = id;
            document.getElementById('inbox-task-text').innerText = App.Model.obterTarefa(id).texto;
            new bootstrap.Modal(document.getElementById('modalProcessarInbox')).show();
        },
        confirmarProcessamento(i, u) {
            const tipo = document.querySelector('input[name="procTipo"]:checked').value;
            App.Model.moverInboxParaMatriz(this.inboxProcessId, i, u, tipo);
            App.View.render();
            bootstrap.Modal.getInstance(document.getElementById('modalProcessarInbox')).hide();
        },
        delTask(id) {
            if (confirm("Excluir?")) {
                App.Model.delTarefa(id);
                App.View.render();
            }
        },
        adicionarHabito() {
            const v = document.getElementById('input-habito').value.trim();
            if (v) {
                App.Model.addHabito(v);
                App.View.renderHabits();
                document.getElementById('input-habito').value = '';
            }
        },
        toggleHabit(id) {
            App.Model.toggleHabito(id);
            App.View.renderHabits();
        },
        delHabit(id) {
            if (confirm("Remover?")) {
                App.Model.delHabito(id);
                App.View.renderHabits();
            }
        },
        startFocus(id) {
            this.pendingId = id;
            new bootstrap.Modal(document.getElementById('modalEnergia')).show();
        },
        confirmarFoco(e) {
            bootstrap.Modal.getInstance(document.getElementById('modalEnergia')).hide();
            const t = App.Model.obterTarefa(this.pendingId);
            if (!t) return;
            const min = e === 'alta' ? 50 : (e === 'baixa' ? 15 : 25);
            App.Model.timer.tarefaAtualId = this.pendingId;
            App.Model.timer.tempoPadrao = min * 60;
            App.Model.timer.tempoRestante = min * 60;
            App.Model.timer.ativo = true;
            App.Model.timer.startTime = Date.now();
            App.View.toFocus(t.texto, min);
            this.loopTimer();
        },
        loopTimer() {
            if (App.Model.timer.intervaloId) clearInterval(App.Model.timer.intervaloId);
            const dur = App.Model.timer.tempoPadrao * 1000;
            const start = App.Model.timer.startTime;
            App.Model.timer.intervaloId = setInterval(() => {
                if (!App.Model.timer.ativo) return;
                const elap = Date.now() - start;
                const rem = Math.ceil((dur - elap) / 1000);
                App.Model.timer.tempoRestante = rem;
                App.View.updateTimer(rem, App.Model.timer.tempoPadrao);
                if (rem <= 0) {
                    this.pausarFoco();
                    App.View.audio.play();
                    new Notification("Fim!");
                    App.View.notify("Acabou!");
                }
            }, 1000);
        },
        pausarFoco() {
            App.Model.timer.ativo = !App.Model.timer.ativo;
            if (!App.Model.timer.ativo) {
                App.View.stopSound();
                clearInterval(App.Model.timer.intervaloId);
            } else {
                App.Model.timer.startTime = Date.now() - ((App.Model.timer.tempoPadrao - App.Model.timer.tempoRestante) * 1000);
                this.loopTimer();
            }
            const b = document.getElementById('btn-pausa');
            if (b) b.innerText = App.Model.timer.ativo ? 'Pausar' : 'Retomar';
        },
        concluirFoco() {
            clearInterval(App.Model.timer.intervaloId);
            App.View.stopSound();
            if (confirm("Concluiu?")) {
                const inv = Math.ceil((App.Model.timer.tempoPadrao - App.Model.timer.tempoRestante) / 60);
                App.Model.concluirTarefa(App.Model.timer.tarefaAtualId, inv);
            }
            App.View.toDash();
        },
        cancelarFoco() {
            clearInterval(App.Model.timer.intervaloId);
            App.View.stopSound();
            App.View.toDash();
        },
        abrirBrainDump() {
            new bootstrap.Modal(document.getElementById('modalBrainDump')).show();
            setTimeout(() => document.getElementById('input-brain-dump').focus(), 500);
        },
        adicionarBrainDump() {
            const t = document.getElementById('input-brain-dump').value.trim();
            if (t) {
                this.executarAdicao(t, false, false, 'manutencao', true);
                document.getElementById('input-brain-dump').value = '';
                bootstrap.Modal.getInstance(document.getElementById('modalBrainDump')).hide();
            }
        },
        salvarConfiguracoes(fechar = false) {
            App.Model.usuario.config.tempoFocoMinutos = parseInt(document.getElementById('config-tempo').value);
            App.Model.usuario.config.provider = document.getElementById('config-provider').value;
            const k = document.getElementById('config-apikey').value.trim();
            if (k) App.Model.usuario.config.apiKey = k;
            App.Model.salvar();
            App.View.notify("Salvo!");
            if (fechar) {
                bootstrap.Modal.getInstance(document.getElementById('modalConfig')).hide();
                if (App.Model.usuario.tarefas.filter(t => t.isInbox).length > 0 && k) setTimeout(() => App.Controller.organizarComIA(), 500);
            }
        },
        atualizarLinkKey() {
            const p = document.getElementById('config-provider').value;
            const l = document.getElementById('link-obter-key');
            if (p === 'groq') {
                l.href = "https://console.groq.com/keys";
                l.innerText = "Chave Groq ↗";
            } else if (p === 'openai') {
                l.href = "https://platform.openai.com/api-keys";
                l.innerText = "Chave OpenAI ↗";
            } else {
                l.href = "https://aistudio.google.com/app/apikey";
                l.innerText = "Chave Gemini ↗";
            }
        },
        baixarBackup() {
            const a = document.createElement('a');
            a.href = "data:text/json;charset=utf-8," + encodeURIComponent(App.Model.exportBackup());
            a.download = "focus.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
        },
        restaurarBackup() {
            const f = document.getElementById('arquivo-backup').files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = e => {
                if (App.Model.importBackup(e.target.result)) location.reload();
            };
            r.readAsText(f);
        },
        resetarDados() {
            if (confirm("Apagar tudo?")) {
                localStorage.clear();
                location.reload();
            }
        },
        abrirRelatorio() {
            App.View.showReport();
        },
        alternarTema() {
            const n = App.Model.usuario.config.tema === 'light' ? 'dark' : 'light';
            App.Model.usuario.config.tema = n;
            App.Model.salvar();
            App.View.applyTheme();
        },
        iniciarShutdown() {
            const m = App.Model.calcularMinutosHoje();
            document.getElementById('shutdown-score').innerText = `+${m}`;
            document.getElementById('shutdown-resumo-texto').innerText = `Resumo: ${m} min de foco hoje!`;
            new bootstrap.Modal(document.getElementById('modalShutdown')).show();
        },
        copiarResumo() {
            navigator.clipboard.writeText(document.getElementById('shutdown-resumo-texto').innerText);
            App.View.notify("Copiado!");
        },
        confirmarShutdown() {
            if (confirm("Limpar dia?")) {
                App.Model.limparTodasTarefas();
                App.View.render();
                bootstrap.Modal.getInstance(document.getElementById('modalShutdown')).hide();
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.Controller.init());