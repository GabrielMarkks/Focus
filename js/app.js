const App = {
    // ============================================================
    // 1. MODEL (Dados & Persistência)
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
        timer: {
            ativo: false,
            tempoTotal: 0,
            tempoRestante: 0,
            intervaloId: null,
            tarefaId: null,
            startTime: null
        },
        citacoes: ["Menos, porém melhor.", "O foco é a nova moeda.", "1% melhor todo dia.", "Feito é melhor que perfeito.", "Sua atenção é seu maior ativo."],

        // --- Persistência ---
        salvar() {
            try {
                localStorage.setItem('focusApp_user', JSON.stringify(this.usuario));
            } catch (e) {
                console.error(e)
            }
        },

        carregar() {
            const d = localStorage.getItem('focusApp_user');
            if (d) {
                try {
                    const p = JSON.parse(d);
                    this.usuario = {
                        ...this.usuario,
                        ...p
                    };
                    // Blindagem de Arrays
                    ['tarefas', 'historico', 'habitos'].forEach(k => {
                        if (!Array.isArray(this.usuario[k])) this.usuario[k] = [];
                    });
                    // Blindagem de Config
                    if (!this.usuario.config) this.usuario.config = {};
                    if (!this.usuario.config.provider) this.usuario.config.provider = 'gemini';

                    this.checkDia();
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return false;
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

        // --- CRUD Tarefas ---
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
            // Busca flexível (String vs Number)
            const t = this.usuario.tarefas.find(task => String(task.id) === String(id));
            if (t) {
                Object.assign(t, dados);
                this.salvar();
            }
        },
        concluirTarefa(id, minutos) {
            const idx = this.usuario.tarefas.findIndex(t => t.id == id); // Comparação flexível
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
                this.usuario.tarefas = this.usuario.tarefas.filter(t => t.id != id);
                this.salvar();
            }
        },
        limparTodasTarefas() {
            this.usuario.tarefas = [];
            this.salvar();
        },

        obterTarefa(id) {
            if (!Array.isArray(this.usuario.tarefas)) return null;
            return this.usuario.tarefas.find(t => t.id == id); // Comparação flexível
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

        // --- CRUD Hábitos ---
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

        // --- Analytics ---
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
            if (xp < 60) return {
                t: "Iniciante",
                i: "🌱"
            };
            if (xp < 300) return {
                t: "Focado",
                i: "🧘"
            };
            return {
                t: "Lenda",
                i: "👑"
            };
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
            } catch (e) { }
            return false;
        },
        obterFraseAleatoria() {
            return this.citacoes[Math.floor(Math.random() * this.citacoes.length)];
        }
    },

    // ============================================================
    // 2. VIEW (Interface)
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
                const html = `<li class="list-group-item d-flex justify-content-between align-items-center animate-fade-in"><div class="d-flex align-items-center gap-2 overflow-hidden w-100">${t.isInbox ? `<button class="btn btn-sm btn-outline-info rounded-circle" onclick="App.Controller.iniciarProcessamentoInbox(${t.id})"><i class="ph ph-list-plus"></i></button>` : `<button class="btn btn-sm btn-light rounded-circle border shadow-sm" onclick="App.Controller.startFocus(${t.id})"><i class="ph ph-play-fill text-primary"></i></button>`}<span class="task-text text-truncate">${t.texto}</span>${!t.isInbox ? badge : ''}</div><i class="ph ph-trash btn-delete-task ms-2" onclick="App.Controller.delTask(${t.id})"></i></li>`;
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
                    lh.innerHTML += `<li class="list-group-item d-flex justify-content-between"><div class="d-flex gap-3"><input class="form-check-input mt-0" type="checkbox" ${h.concluidoHoje ? 'checked' : ''} onchange="App.Controller.toggleHabit(${h.id})"><span>${h.texto}</span><small>🔥 ${h.streak}</small></div><i class="ph ph-trash opacity-50" onclick="App.Controller.delHabit(${h.id})"></i></li>`
                });
            }
        },

        updateStats() {
            const m = App.Model.getMinHoje(),
                nv = App.Model.getNivel();
            document.getElementById('display-minutos-foco').innerText = m;
            document.getElementById('badge-nivel').innerText = `${nv.i} ${nv.t}`;
            const b = document.getElementById('barra-dia-fundo');
            if (b) b.style.width = `${Math.min((m / 240) * 100, 100)}%`;
        },
        updateTimer(r, t) {
            const m = Math.floor(r / 60),
                s = Math.floor(r % 60);
            document.getElementById('foco-timer').innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            document.getElementById('barra-progresso').style.width = `${100 - ((r / t) * 100)}%`;
        },

        alternarSom(t) {
            // Fix Audio Object
            if (this.currentSound === t) {
                this.audio.pause();
                this.currentSound = null;
            } else {
                this.stopSound();
                this.audio.src = this.ambience[t];
                this.audio.loop = true;
                this.audio.play().catch(e => console.log("Audio play error:", e));
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
            // Graficos
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
        pendingTask: null,
        inboxProcessId: null,

        init() {
            if(App.Model.carregar()) {
                App.View.toDash(); 
            } else {
                // Inicia no passo 1
                App.Controller.atualizarOnboarding(1);
            }

            document.getElementById('input-tarefa-texto').addEventListener('keypress', e => {
                if (e.key === 'Enter') App.Controller.tentarAdicionarTarefa();
            });
            document.getElementById('input-habito').addEventListener('keypress', e => {
                if (e.key === 'Enter') App.Controller.adicionarHabito();
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
                    const m = document.querySelector('.modal.show');
                    if (m) bootstrap.Modal.getInstance(m).hide();
                    const o = document.querySelector('.offcanvas.show');
                    if (o) bootstrap.Offcanvas.getInstance(o).hide();
                }
            });
            if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
        },


        // Atualiza a barra e muda o slide
        atualizarOnboarding(passo) {
            // Esconde todos
            document.querySelectorAll('.step-container').forEach(e => e.classList.add('d-none'));
            // Mostra o atual
            const atual = document.getElementById(`step-${passo}`);
            if (atual) {
                atual.classList.remove('d-none');
                // Foco automático no input
                const input = atual.querySelector('input, textarea');
                if (input) setTimeout(() => input.focus(), 300);
            }

            // Atualiza barra de progresso
            const prog = document.getElementById('onboarding-progress');
            if (prog) prog.style.width = `${passo * 33.33}%`;
        },

        proximoPasso(n) {
            // Salva o dado do passo anterior
            if (n === 2) {
                const nome = document.getElementById('input-name').value.trim();
                if (!nome) return App.View.notify("Por favor, diga seu nome.", "primary");
                App.Model.atualizarUsuario('nome', nome);
            }
            if (n === 3) {
                const prop = document.getElementById('input-proposito').value.trim();
                if (!prop) return App.View.notify("Defina um objetivo.", "primary");
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
            App.View.toDash();
            App.View.notify(`Bem-vindo, ${App.Model.usuario.nome}! 🚀`);
        },

        // --- Adicionar Tarefas e Gatekeeper ---
        tentarAdicionarTarefa() {
            const txt = document.getElementById('input-tarefa-texto').value.trim();
            if (!txt) return App.View.notify("Escreva algo!", "error");
            const imp = document.getElementById('check-importante').checked,
                urg = document.getElementById('check-urgente').checked;
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
            if (this.pendingTask) {
                this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'manutencao');
                App.View.notify("Sábia escolha.", "success");
            }
            bootstrap.Modal.getInstance(document.getElementById('modalGatekeeper')).hide();
        },
        forcarAdicao() {
            if (this.pendingTask) {
                this.executarAdicao(this.pendingTask.txt, this.pendingTask.imp, this.pendingTask.urg, 'crescimento');
                App.View.notify("Adicionado.", "warning");
            }
            bootstrap.Modal.getInstance(document.getElementById('modalGatekeeper')).hide();
        },
        executarAdicao(t, i, u, type, inbox = false) {
            App.Model.addTarefa(t, i, u, type, inbox);
            App.View.render();
            document.getElementById('input-tarefa-texto').value = '';
        },
        adicionarTarefa() {
            this.tentarAdicionarTarefa();
        },

        // --- IA INTEGRATION ---
        async organizarComIA() {
            const provider = App.Model.usuario.config.provider || 'gemini';
            const apiKey = App.Model.usuario.config.apiKey;
            if (!apiKey) {
                new bootstrap.Modal(document.getElementById('modalConfig')).show();
                return App.View.notify("Chave API necessária!", "error");
            }
            const inboxTasks = App.Model.usuario.tarefas.filter(t => t.isInbox);
            if (inboxTasks.length === 0) return App.View.notify("Inbox vazia.", "primary");

            App.View.toggleLoading(true, `IA ${provider.toUpperCase()} trabalhando...`);
            try {
                // Passa IDs como String para evitar conflitos de tipo
                const classified = await AI_Manager.classificar(provider, apiKey, inboxTasks);

                classified.forEach(c => {
                    // Atualiza a tarefa original (comparando ID como string)
                    App.Model.atualizarTarefa(c.id, {
                        importante: c.importante,
                        urgente: c.urgente,
                        tipo: c.tipo,
                        isInbox: false
                    });
                });

                App.View.render();
                App.View.notify(`${classified.length} tarefas organizadas!`, "success");
            } catch (error) {
                alert(`Erro IA: ${error.message}`);
            } finally {
                App.View.toggleLoading(false);
            }
        },

        // --- Inbox Manual ---
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
                App.View.notify("Capturado!");
            }
        },
        iniciarProcessamentoInbox(id) {
            const t = App.Model.obterTarefa(id);
            if (!t) return;
            this.inboxProcessId = id;
            document.getElementById('inbox-task-text').innerText = `"${t.texto}"`;
            new bootstrap.Modal(document.getElementById('modalProcessarInbox')).show();
        },
        confirmarProcessamento(imp, urg) {
            const tipo = document.querySelector('input[name="procTipo"]:checked').value;
            App.Model.moverInboxParaMatriz(this.inboxProcessId, imp, urg, tipo);
            App.View.render();
            bootstrap.Modal.getInstance(document.getElementById('modalProcessarInbox')).hide();
            App.View.notify("Organizado!", "success");
        },

        // --- Ações ---
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

        // --- Foco ---
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
            const dur = App.Model.timer.tempoPadrao * 1000,
                start = App.Model.timer.startTime;
            App.Model.timer.intervaloId = setInterval(() => {
                if (!App.Model.timer.ativo) return;
                const elap = Date.now() - start,
                    rem = Math.ceil((dur - elap) / 1000);
                App.Model.timer.tempoRestante = rem;
                App.View.updateTimer(rem, App.Model.timer.tempoPadrao);
                if (rem <= 0) {
                    this.pausarFoco();
                    App.View.audio.play();
                    if (Notification.permission === "granted") new Notification("Fim!");
                    App.View.notify("Tempo esgotado!", "success");
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

        // --- Configs ---
        alternarTema() {
            const n = App.Model.usuario.config.tema === 'light' ? 'dark' : 'light';
            App.Model.usuario.config.tema = n;
            App.Model.salvar();
            App.View.applyTheme();
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
        salvarConfiguracoes(fechar = false) {
            App.Model.usuario.config.tempoFocoMinutos = parseInt(document.getElementById('config-tempo').value);
            App.Model.usuario.config.provider = document.getElementById('config-provider').value;
            const key = document.getElementById('config-apikey').value.trim();
            if (key) App.Model.usuario.config.apiKey = key;

            App.Model.salvar();
            App.View.notify("Salvo!");
            if (fechar) {
                bootstrap.Modal.getInstance(document.getElementById('modalConfig')).hide();
                if (App.Model.usuario.tarefas.filter(t => t.isInbox).length > 0 && key) setTimeout(() => App.Controller.organizarComIA(), 500);
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
            if (!f) return App.View.notify("Selecione arquivo", "error");
            const r = new FileReader();
            r.onload = e => {
                if (App.Model.importBackup(e.target.result)) location.reload();
                else App.View.notify("Erro", "error");
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

        iniciarShutdown() {
            const m = App.Model.calcularMinutosHoje(),
                t = (App.Model.usuario.historico || []).length,
                p = (App.Model.usuario.tarefas || []).length,
                d = new Date().toLocaleDateString();
            let txt = `🚀 *Resumo ${d}*\n✅ ${t} Feitas\n⏱ ${m} min Foco\n📌 ${p} Pendentes\n`;
            (App.Model.usuario.historico || []).slice(-3).forEach(x => txt += `▪ ${x.texto}\n`);
            document.getElementById('shutdown-score').innerText = `+${m}`;
            document.getElementById('shutdown-resumo-texto').innerText = txt;
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
                App.View.notify("Bom descanso! 🌙");
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.Controller.init());