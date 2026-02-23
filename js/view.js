import {
    Model
} from './model.js';
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm';

export const View = {
    // --- SEGURANÇA (ANTI-XSS) BLINDADA ---
    escapeHTML(str) {
        if (!str) return "";
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };
        return String(str).replace(/[&<>"']/g, function(m) {
            return map[m];
        });
    },

    els: {
        login: document.getElementById('view-login'),
        onboard: document.getElementById('view-onboarding'),
        dash: document.getElementById('view-dashboard'),
        focus: document.getElementById('view-focus'),
        nav: document.getElementById('nav-principal')
    },
    audio: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'),
    ambience: {
        chuva: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
        cafe: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
        fluxo: 'https://actions.google.com/sounds/v1/transportation/airplane_cabin_sounds.ogg',
        win: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg'
    },
    currentSound: null,
    charts: {},

    toLogin() {
        this.stopSound();
        Object.values(this.els).forEach(e => e && e.classList.add('d-none'));
        if (this.els.login) this.els.login.classList.remove('d-none');
    },

    toggleModal(modalId, action = 'show') {
        const el = document.getElementById(modalId);
        if (!el) return;
        const modal = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        if (action === 'show') modal.show();
        else modal.hide();
    },

    notify(msg, type = 'success') {
        const box = document.getElementById('toast-container');
        if (!box) return;
        const bg = type === 'success' ? 'text-bg-success' : (type === 'error' ? 'text-bg-danger' : 'text-bg-primary');
        const toastHtml = `<div class="toast align-items-center ${bg} border-0 show" role="alert"><div class="d-flex"><div class="toast-body fw-bold">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
        box.insertAdjacentHTML('beforeend', toastHtml);
        setTimeout(() => {
            if (box.lastElementChild) box.lastElementChild.remove();
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
        } else {
            el.classList.add('d-none');
        }
    },

    showStep(n) {
        document.querySelectorAll('.step-container').forEach(e => e.classList.add('d-none'));
        const s = document.getElementById(`step-${n}`);
        if (s) s.classList.remove('d-none');
    },

    toDash(usuario, frase) {
        this.stopSound();
        Object.values(this.els).forEach(e => e && e.classList.add('d-none'));
        this.els.dash.classList.remove('d-none');
        this.els.nav.classList.remove('d-none');
        document.title = "Focus Coach";

        this.applyTheme(usuario.config.tema);

        const f = document.getElementById('frase-coach');
        if (f) f.innerText = `💡 "${frase}"`;

        const key = document.getElementById('config-apikey');
        if (key) key.value = usuario.config.apiKey || '';
        const prov = document.getElementById('config-provider');
        if (prov) prov.value = usuario.config.provider || 'gemini';
    },

    toFocus(txt, min) {
        this.els.dash.classList.add('d-none');
        this.els.nav.classList.add('d-none');
        this.els.focus.classList.remove('d-none');
        document.getElementById('foco-titulo').innerText = txt;
        this.updateTimer(min * 60, min * 60);
        const b = document.getElementById('badge-modo-foco');
        if (min >= 50) b.innerText = "⚡ DEEP WORK";
        else if (min <= 15) b.innerText = "🔋 START RÁPIDO";
        else b.innerText = "🚀 FLUXO";
    },

    applyTheme(tema) {
        const t = tema || Model.usuario.config.tema || 'light';
        document.documentElement.setAttribute('data-bs-theme', t);
    },

    alternarHistorico() {
        const el = document.getElementById('painel-historico');
        if (el) el.classList.toggle('d-none');
    },

    atualizarOnboarding(passo) {
        if (this.els.onboard) this.els.onboard.classList.remove('d-none');

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

    atualizarLinkKey(prov) {
        const l = document.getElementById('link-obter-key');
        if (prov === 'groq') {
            l.href = "https://console.groq.com/keys";
            l.innerText = "Chave Groq ↗";
        } else if (prov === 'openai') {
            l.href = "https://platform.openai.com/api-keys";
            l.innerText = "Chave OpenAI ↗";
        } else {
            l.href = "https://aistudio.google.com/app/apikey";
            l.innerText = "Chave Gemini ↗";
        }
    },

    render(usuario) {
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

        const metaEl = document.getElementById('texto-meta-semanal');
        const metaObj = usuario.metaSemanal || {
            texto: "",
            subtarefas: []
        };
        const textoMeta = typeof metaObj === 'string' ? metaObj : metaObj.texto;

        if (metaEl) {
            let htmlProgresso = '';
            if (metaObj.subtarefas && metaObj.subtarefas.length > 0) {
                const total = metaObj.subtarefas.length;
                const feitas = metaObj.subtarefas.filter(s => s.feita).length;
                const pct = Math.round((feitas / total) * 100);
                let cor = 'bg-primary';
                if (pct === 100) cor = 'bg-success';

                htmlProgresso = `
                    <div class="progress mt-2" style="height: 4px; width: 100%; max-width: 200px;">
                        <div class="progress-bar ${cor}" role="progressbar" style="width: ${pct}%"></div>
                    </div>
                    <small class="text-muted" style="font-size: 0.7rem;">${pct}% concluído</small>
                `;
            }

            metaEl.innerHTML = `
                <div class="${textoMeta ? '' : 'opacity-50'}">${textoMeta || "🎯 Clique para definir seu Foco Semanal"}</div>
                ${htmlProgresso}
            `;
        }

        (usuario.tarefas || []).forEach(t => {
            const badge = t.tipo === 'crescimento' ? '<span class="badge badge-crescimento ms-2">🚀</span>' : '<span class="badge badge-manutencao ms-2">🔧</span>';
            const html = `
                <li class="list-group-item d-flex justify-content-between align-items-center animate-fade-in">
                    <div class="d-flex align-items-center gap-2 overflow-hidden w-100">
                        ${t.isInbox
                    ? `<button class="btn btn-sm btn-outline-info rounded-circle" onclick="App.Controller.iniciarProcessamentoInbox('${t.id}')"><i class="ph ph-list-plus"></i></button>`
                    : `<button class="btn btn-sm btn-light rounded-circle border shadow-sm" onclick="App.Controller.startFocus('${t.id}')"><i class="ph ph-play-fill text-primary"></i></button>`
                }
                        <span class="task-text text-truncate">${this.escapeHTML(t.texto)}</span>
                        ${!t.isInbox ? badge : ''}
                    </div>
                    <i class="ph ph-trash btn-delete-task ms-2" onclick="App.Controller.delTask('${t.id}')"></i>
                </li>`;

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
        } else {
            inboxPanel.classList.add('d-none');
        }

        (usuario.historico || []).slice().reverse().slice(0, 5).forEach(t =>
            ls.done.innerHTML += `<li class="list-group-item bg-transparent text-muted text-decoration-line-through d-flex justify-content-between"><span><i class="ph ph-check-circle text-success me-2"></i>${t.texto}</span><small>+${t.tempoInvestido}m</small></li>`
        );
        this.renderHabits(usuario);
    },

    renderHabits(usuario) {
        const lh = document.getElementById('lista-habitos');
        if (lh) {
            lh.innerHTML = '';
            const hojeDia = new Date().getDay();
            (usuario.habitos || []).forEach(h => {
                const ehDia = h.dias ? h.dias.includes(hojeDia) : true;
                const opacity = ehDia ? '1' : '0.5';
                const icon = ehDia ? (h.concluidoHoje ? '🔥' : '⬜') : '💤';
                lh.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center" style="opacity: ${opacity}">
                    <div class="d-flex gap-3 align-items-center">
                        <input class="form-check-input mt-0" type="checkbox" ${h.concluidoHoje ? 'checked' : ''} ${!ehDia ? 'disabled' : ''} onchange="App.Controller.toggleHabit('${h.id}')" style="cursor: pointer;">
                        <div class="d-flex flex-column" style="line-height: 1.2;">
                            <span class="${h.concluidoHoje ? 'text-decoration-line-through text-muted' : ''}">${this.escapeHTML(h.texto)}</span>
                            <small class="text-muted" style="font-size: 0.7rem;">${icon} Streak: ${h.streak} dias</small>
                        </div>
                    </div>
                    <i class="ph ph-trash opacity-25 hover-danger" style="cursor: pointer;" onclick="App.Controller.delHabit('${h.id}')"></i>
                </li>`;
            });
            if (usuario.habitos.length === 0) lh.innerHTML = '<div class="text-center text-muted small py-3">Nenhum hábito ativo.</div>';
        }
    },

    playReward() {
        const winAudio = new Audio(this.ambience.win);
        winAudio.volume = 0.5;
        winAudio.play().catch(() => {});
        const duration = 2000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: {
                    x: 0
                },
                colors: ['#0d6efd', '#198754', '#ffc107']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: {
                    x: 1
                },
                colors: ['#0d6efd', '#198754', '#ffc107']
            });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    },

    updateStats(minHoje, nivel) {
        document.getElementById('display-minutos-foco').innerText = minHoje;
        document.getElementById('badge-nivel').innerText = `${nivel.i} ${nivel.t}`;
        const b = document.getElementById('barra-dia-fundo');
        if (b) b.style.width = `${Math.min((minHoje / 240) * 100, 100)}%`;
    },

    updateTimer(r, t) {
        const m = Math.floor(r / 60);
        const s = Math.floor(r % 60);
        document.getElementById('foco-timer').innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        document.getElementById('barra-progresso').style.width = `${100 - ((r / t) * 100)}%`;
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
        const limpo = texto.replace(/\[ADD:.*?\]/g, '').replace(/\[SET_GOAL:.*?\]/g, '').replace(/\[REMOVE:.*?\]/g, '').replace(/\[ORGANIZE\]/g, '').trim();
        return limpo.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    },

    showReport(xp, tarefas, streak, dados) {
        document.getElementById('review-total-minutos').innerText = xp;
        document.getElementById('review-tarefas-feitas').innerText = tarefas;
        document.getElementById('review-streak').innerText = streak;

        const macroContainer = document.getElementById('macro-analytics');
        const metas = Model.usuario.metasTrimestrais || [];

        if (metas.length > 0 && macroContainer) {
            macroContainer.classList.remove('d-none');
            let htmlProjetos = '';

            metas.forEach(m => {
                const total = m.subtarefas ? m.subtarefas.length : 0;
                const feitas = m.subtarefas ? m.subtarefas.filter(s => s.feita).length : 0;
                let pct = total === 0 ? 0 : Math.round((feitas / total) * 100);

                let cor = 'bg-primary';
                if (pct === 100) cor = 'bg-success';
                else if (pct < 20) cor = 'bg-danger';
                else if (pct > 80) cor = 'bg-info';

                htmlProjetos += `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold small text-truncate" style="max-width: 70%;">${this.escapeHTML(m.texto)}</span>
                            <span class="badge bg-light text-dark border">${pct}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${cor}" role="progressbar" style="width: ${pct}%"></div>
                        </div>
                        <div class="d-flex justify-content-end">
                            <small class="text-muted" style="font-size: 0.65rem;">${feitas}/${total} passos</small>
                        </div>
                    </div>
                `;
            });

            macroContainer.innerHTML = `
                <div class="p-3 bg-body bg-opacity-50 border rounded-4 shadow-sm mb-3">
                    <h6 class="fw-bold text-primary mb-3"><i class="ph ph-kanban me-2"></i>Status dos Projetos</h6>
                    ${htmlProjetos}
                </div>
            `;
        } else if (macroContainer) {
            macroContainer.classList.add('d-none');
        }

        const tot = dados.q1 + dados.q2 + dados.q3 + dados.q4;
        const fb = document.getElementById('review-feedback');

        if (tot === 0) fb.innerHTML = "Sem dados semanais.";
        else {
            const pQ2 = (dados.q2 / tot) * 100;
            if (pQ2 > 50) {
                fb.innerHTML = "🌟 <b>Semana de Ouro!</b> Foco real.";
                fb.className = "alert alert-success border mt-2";
            } else if ((dados.q1 + dados.q3) / tot > 60) {
                fb.innerHTML = "🔥 <b>Modo Bombeiro.</b> Planeje melhor.";
                fb.className = "alert alert-warning border mt-2";
            } else {
                fb.innerHTML = "Continue registrando.";
            }
        }

        if (typeof Chart !== 'undefined') {
            const c1 = document.getElementById('graficoFoco');
            if (c1) {
                if (this.charts.f) this.charts.f.destroy();
                this.charts.f = new Chart(c1, {
                    type: 'doughnut',
                    data: {
                        labels: ['Crise', 'Meta', 'Delegar', 'Lixo'],
                        datasets: [{
                            data: [dados.q1, dados.q2, dados.q3, dados.q4],
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
                });
            }
            const c2 = document.getElementById('graficoQualidade');
            if (c2) {
                if (this.charts.q) this.charts.q.destroy();
                this.charts.q = new Chart(c2, {
                    type: 'bar',
                    data: {
                        labels: ['Rotina', 'Crescimento'],
                        datasets: [{
                            label: 'Minutos',
                            data: [dados.manut, dados.cresc],
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
                });
            }
        }

        this.toggleModal('modalRelatorio', 'show');
    },

    renderTrimestral(metas) {
        const lista = document.getElementById('lista-metas-macro');
        if (!lista) return;

        lista.innerHTML = '';

        if (!metas || metas.length === 0) {
            lista.innerHTML = `
                <div class="text-center py-5 opacity-50">
                    <i class="ph ph-telescope fs-1 mb-2"></i>
                    <p>Defina suas "Big Rocks" (Metas Trimestrais).</p>
                </div>`;
            return;
        }

        metas.forEach(m => {
            const subs = m.subtarefas || [];
            const total = subs.length;
            const feitas = subs.filter(s => s.feita).length;
            const porcentagem = total === 0 ? 0 : Math.round((feitas / total) * 100);

            let barColor = 'bg-primary';
            if (porcentagem === 100) barColor = 'bg-success';

            let subTasksHTML = '';
            if (subs.length > 0) {
                subTasksHTML = `<ul class="list-group list-group-flush mt-3 border rounded-3 overflow-hidden">`;
                subs.forEach(s => {
                    subTasksHTML += `
                        <li class="list-group-item bg-body-secondary d-flex justify-content-between align-items-center py-2">
                            <div class="d-flex align-items-center gap-2">
                                <input class="form-check-input mt-0" type="checkbox" ${s.feita ? 'checked' : ''} 
                                    onchange="App.Controller.toggleSubTarefa('${m.id}', '${s.id}')" style="cursor: pointer;">
                                <span class="${s.feita ? 'text-decoration-line-through text-muted' : ''} small">${this.escapeHTML(s.texto)}</span>
                            </div>
                            <i class="ph ph-x text-danger opacity-25 hover-opacity-100" style="cursor: pointer; font-size: 0.8rem;" 
                                onclick="App.Controller.delSubTarefa('${m.id}', '${s.id}')"></i>
                        </li>
                    `;
                });
                subTasksHTML += `</ul>`;
            } else {
                subTasksHTML = `
                    <div class="alert alert-light border border-warning mt-3 mb-0 d-flex align-items-center gap-2 p-2">
                        <i class="ph ph-lightbulb text-warning"></i>
                        <small class="text-muted lh-1">Use a varinha mágica para criar o plano! 👉</small>
                    </div>
                `;
            }

            const html = `
                <div class="card mb-3 border-0 shadow-sm overflow-hidden animate-fade-in">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="w-100">
                                <h5 class="fw-bold mb-1 text-primary text-truncate">${this.escapeHTML(m.texto)}</h5>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge bg-light text-dark border">${porcentagem}%</span>
                                </div>
                            </div>
                            <button class="btn btn-icon text-danger opacity-25 hover-opacity-100" 
                                onclick="App.Controller.delMetaMacro('${m.id}')">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>

                        <div class="progress" style="height: 6px; border-radius: 4px;">
                            <div class="progress-bar ${barColor}" role="progressbar" style="width: ${porcentagem}%"></div>
                        </div>

                        ${subTasksHTML}

                        <div class="input-group input-group-sm mt-3">
                            <span class="input-group-text bg-transparent border-0 ps-0"><i class="ph ph-arrow-elbow-down-right text-muted"></i></span>
                            <input type="text" id="input-sub-${m.id}" class="form-control bg-body-tertiary border-0 rounded-pill" 
                                placeholder="Adicionar micro-passo..." 
                                onkeypress="if(event.key==='Enter') App.Controller.adicionarSubTarefa('${m.id}')">
                            
                            <button class="btn btn-sm btn-light rounded-circle ms-1" onclick="App.Controller.adicionarSubTarefa('${m.id}')" title="Adicionar">
                                <i class="ph ph-plus"></i>
                            </button>
                            
                            <button id="btn-magic-${m.id}" class="btn btn-sm btn-primary rounded-circle ms-1 text-white shadow-sm" 
                                onclick="App.Controller.autoQuebrarMeta('${m.id}')" title="Gerar passos com IA">
                                <i class="ph ph-magic-wand"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            lista.innerHTML += html;
        });
    },

    renderModalMetaSemanal() {
        const container = document.getElementById('container-meta-semanal');
        if (!container) return;

        const meta = Model.usuario.metaSemanal || {
            texto: "",
            subtarefas: []
        };

        let html = `
            <label class="form-label text-muted small fw-bold text-uppercase">Sua Prioridade #1</label>
            <div class="input-group mb-3">
                <input type="text" id="input-meta-semanal-titulo" class="form-control form-control-lg fw-bold text-primary" 
                    value="${this.escapeHTML(meta.texto)}" placeholder="Ex: Lançar Site v1..." 
                    onblur="App.Controller.salvarTextoMetaSemanal()">
            </div>
        `;

        if (meta.subtarefas && meta.subtarefas.length > 0) {
            html += `<ul class="list-group list-group-flush border rounded-3 mb-3">`;
            meta.subtarefas.forEach(s => {
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <input class="form-check-input mt-0" type="checkbox" ${s.feita ? 'checked' : ''} 
                                onchange="App.Controller.toggleSubTarefaSemanal('${s.id}')" style="cursor: pointer;">
                            <span class="${s.feita ? 'text-decoration-line-through text-muted' : ''}">${this.escapeHTML(s.texto)}</span>
                        </div>
                        <i class="ph ph-x text-danger opacity-25 hover-opacity-100" style="cursor: pointer;" 
                            onclick="App.Controller.delSubTarefaSemanal('${s.id}')"></i>
                    </li>
                `;
            });
            html += `</ul>`;
        } else {
            html += `<p class="text-muted small mb-3"><i class="ph ph-info me-1"></i> Adicione passos para completar essa semana.</p>`;
        }

        html += `
            <div class="input-group input-group-sm">
                <input type="text" id="input-sub-semanal" class="form-control bg-body-tertiary border-0 rounded-pill" 
                    placeholder="Adicionar passo..." 
                    onkeypress="if(event.key==='Enter') App.Controller.addSubTarefaSemanal()">
                <button class="btn btn-sm btn-light rounded-circle ms-1" onclick="App.Controller.addSubTarefaSemanal()">
                    <i class="ph ph-plus"></i>
                </button>
            </div>
        `;

        container.innerHTML = html;
    }
};