export const Model = {
    usuario: {
        nome: "",
        proposito: "",
        metaSemanal: "",
        metasTrimestrais: [],
        papeis: [],
        tarefas: [],
        historico: [],
        habitos: [],
        config: {
            tempoFocoMinutos: 25,
            tema: 'light',
            apiKey: '',
            provider: 'gemini',
            ultimoMorning: null
        }
    },
    chatMemory: {
        history: [],
        lastActive: 0
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
            console.error(e);
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
                ['tarefas', 'historico', 'habitos'].forEach(k => {
                    if (!Array.isArray(this.usuario[k])) this.usuario[k] = [];
                });
                if (!this.usuario.config) this.usuario.config = {};
                if (!this.usuario.config.provider) this.usuario.config.provider = 'gemini';
            } catch (e) { }
        }

        const c = localStorage.getItem('focusApp_chat');
        if (c) {
            try {
                const chatData = JSON.parse(c);
                // 30 min de validade para a memória do chat
                if (Date.now() - chatData.lastActive < 1800000) {
                    this.chatMemory = chatData;
                } else {
                    this.chatMemory = {
                        history: [],
                        lastActive: Date.now()
                    };
                }
            } catch (e) { }
        }

        // --- MIGRAÇÃO AUTOMÁTICA (String -> Objeto) ---
        if (typeof this.usuario.metaSemanal === 'string') {
            this.usuario.metaSemanal = {
                texto: this.usuario.metaSemanal,
                subtarefas: []
            };
        }
        if (!this.usuario.metaSemanal) {
            this.usuario.metaSemanal = { texto: "", subtarefas: [] };
        }
        this.checkDia();
        return !!d;
    },

    pushChatMessage(role, content) {
        this.chatMemory.history.push({
            role,
            content
        });
        if (this.chatMemory.history.length > 10) this.chatMemory.history = this.chatMemory.history.slice(-10);
        this.chatMemory.lastActive = Date.now();
        this.salvar();
    },

    checkDia() {
        const hoje = new Date().toDateString();
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = ontem.toDateString();
        const diaSemanaOntem = ontem.getDay();

        let mudou = false;
        if (Array.isArray(this.usuario.habitos)) {
            this.usuario.habitos.forEach(h => {
                // Reseta status diário
                if (h.ultimaData !== hoje) {
                    h.concluidoHoje = false;
                    mudou = true;
                }
                // Verifica quebra de streak
                if (h.ultimaData !== ontemStr && h.ultimaData !== hoje) {
                    if (h.dias && h.dias.includes(diaSemanaOntem)) {
                        h.streak = 0;
                        mudou = true;
                    }
                }
            });
        }
        if (mudou) this.salvar();
    },

    atualizarUsuario(k, v) {
        this.usuario[k] = v;
        this.salvar();
    },

    // --- TAREFAS ---
    addTarefa(texto, urgente, importante, tipo, isInbox = false) {
        if (!Array.isArray(this.usuario.tarefas)) this.usuario.tarefas = [];
        const novaTarefa = {
            id: crypto.randomUUID(),
            texto: texto,
            urgente: urgente,
            importante: importante,
            tipo: tipo,
            feita: false,
            isInbox: isInbox,
            tempoInvestido: 0,
            criadaEm: Date.now()
        };
        this.usuario.tarefas.push(novaTarefa);
        this.salvar();
        return novaTarefa;
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
        this.usuario.tarefas = this.usuario.tarefas.filter(t => String(t.id) !== String(id));
        this.salvar();
    },
    encerrarDia() {
        const pendentes = this.usuario.tarefas.filter(t => !t.feita);
        const concluidas = this.usuario.tarefas.filter(t => t.feita);

        this.usuario.tarefas = pendentes.map(t => ({
            ...t,
            adiada: (t.adiada || 0) + 1
        }));
        this.salvar();
        return {
            migradas: pendentes.length,
            limpas: concluidas.length
        };
    },
    obterTarefa(id) {
        return this.usuario.tarefas.find(t => String(t.id) === String(id)) || null;
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

    // --- HÁBITOS ---
    addHabito(texto, dias = [0, 1, 2, 3, 4, 5, 6]) {
        if (!Array.isArray(this.usuario.habitos)) this.usuario.habitos = [];
        this.usuario.habitos.push({
            id: crypto.randomUUID(),
            texto: texto,
            dias: dias,
            streak: 0,
            ultimaData: null,
            concluidoHoje: false
        });
        this.salvar();
    },
    toggleHabito(id) {
        const h = this.usuario.habitos.find(x => x.id == id);
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
        this.usuario.habitos = this.usuario.habitos.filter(x => x.id != id);
        this.salvar();
    },

    // --- ANALYTICS ---
    getXP() {
        return (this.usuario.historico || []).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
    },
    getMinHoje() {
        const h = new Date().toDateString();
        return (this.usuario.historico || []).filter(x => new Date(x.dataConclusao).toDateString() === h).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
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
        } catch (e) { }
        return false;
    },
    obterFraseAleatoria() {
        return this.citacoes[Math.floor(Math.random() * this.citacoes.length)];
    },



    // --- CRUD TRIMESTRAL (ATUALIZADO COM SUB-TAREFAS) ---
    addMetaTrimestral(texto) {
        if (!Array.isArray(this.usuario.metasTrimestrais)) this.usuario.metasTrimestrais = [];
        this.usuario.metasTrimestrais.push({
            id: crypto.randomUUID(),
            texto: texto,
            subtarefas: [], // Array para os passos menores
            concluida: false
        });
        this.salvar();
    },
    delMetaTrimestral(id) {
        this.usuario.metasTrimestrais = this.usuario.metasTrimestrais.filter(x => x.id != id);
        this.salvar();
    },
    // Adicionar Sub-tarefa dentro da Meta
    addSubTarefaMeta(metaId, textoSub) {
        const meta = this.usuario.metasTrimestrais.find(m => m.id == metaId);
        if (meta) {
            if (!meta.subtarefas) meta.subtarefas = [];
            meta.subtarefas.push({
                id: crypto.randomUUID(),
                texto: textoSub,
                feita: false
            });
            this.salvar();
        }
    },
    // Marcar/Desmarcar Sub-tarefa
    toggleSubTarefaMeta(metaId, subId) {
        const meta = this.usuario.metasTrimestrais.find(m => m.id == metaId);
        if (meta && meta.subtarefas) {
            const sub = meta.subtarefas.find(s => s.id == subId);
            if (sub) {
                sub.feita = !sub.feita;
                // Opcional: Se todas estiverem feitas, marca a meta pai como feita? 
                // Por enquanto deixamos manual para o usuário sentir o prazer de concluir a meta grande.
                this.salvar();
            }
        }
    },
    // Deletar Sub-tarefa
    delSubTarefaMeta(metaId, subId) {
        const meta = this.usuario.metasTrimestrais.find(m => m.id == metaId);
        if (meta && meta.subtarefas) {
            meta.subtarefas = meta.subtarefas.filter(s => s.id != subId);
            this.salvar();
        }
    },

    // Adiciona sub-tarefa na meta da semana
    addSubTarefaSemanal(texto) {
        // Garante estrutura
        if (typeof this.usuario.metaSemanal !== 'object') this.usuario.metaSemanal = { texto: "", subtarefas: [] };

        this.usuario.metaSemanal.subtarefas.push({
            id: crypto.randomUUID(),
            texto: texto,
            feita: false
        });
        this.salvar();
    },

    toggleSubTarefaSemanal(id) {
        if (this.usuario.metaSemanal && this.usuario.metaSemanal.subtarefas) {
            const sub = this.usuario.metaSemanal.subtarefas.find(s => s.id == id);
            if (sub) {
                sub.feita = !sub.feita;
                this.salvar();
            }
        }
    },

    delSubTarefaSemanal(id) {
        if (this.usuario.metaSemanal && this.usuario.metaSemanal.subtarefas) {
            this.usuario.metaSemanal.subtarefas = this.usuario.metaSemanal.subtarefas.filter(s => s.id != id);
            this.salvar();
        }
    },

    atualizarTextoMetaSemanal(texto) {
        if (typeof this.usuario.metaSemanal !== 'object') this.usuario.metaSemanal = { texto: "", subtarefas: [] };
        this.usuario.metaSemanal.texto = texto;
        this.salvar();
    }
};
