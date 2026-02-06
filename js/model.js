export const Model = {
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
    citacoes: ["Menos, porém melhor.", "O foco é a nova moeda.", "1% melhor todo dia.", "Feito é melhor que perfeito."],

    salvar() {
        try {
            localStorage.setItem('focusApp_user', JSON.stringify(this.usuario));
            localStorage.setItem('focusApp_chat', JSON.stringify(this.chatMemory));
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
                if (Date.now() - chatData.lastActive < 1800000) this.chatMemory = chatData;
                else this.chatMemory = {
                    history: [],
                    lastActive: Date.now()
                };
            } catch (e) { }
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

    // CRUD TAREFAS
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
    encerrarDia() {
        if (!Array.isArray(this.usuario.tarefas)) return;

        // 1. Separa o joio do trigo
        const pendentes = this.usuario.tarefas.filter(t => !t.feita);
        const concluidas = this.usuario.tarefas.filter(t => t.feita); // (Caso tenha sobrado alguma visualmente)

        // 2. Mantém APENAS as pendentes para amanhã
        // Opcional: Você pode adicionar uma tag "migrada" ou contar quantas vezes ela foi adiada
        this.usuario.tarefas = pendentes.map(t => ({
            ...t,
            adiada: (t.adiada || 0) + 1 // Contador de vergonha (anti-autoboicote futuro)
        }));

        // 3. Salva
        this.salvar();

        return {
            migradas: pendentes.length,
            limpas: concluidas.length
        };
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

    // HABITOS
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

    // ANALYTICS (Aqui estava o erro: garantindo que as funções existam)
    getXP() {
        return (this.usuario.historico || []).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
    },

    calcularMinutosHoje() {
        const h = new Date().toDateString();
        return (this.usuario.historico || []).filter(x => new Date(x.dataConclusao).toDateString() === h).reduce((a, b) => a + (b.tempoInvestido || 0), 0);
    },

    // Função wrapper que o Controller chama
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
        } catch (e) { }
        return false;
    },
    obterFraseAleatoria() {
        return this.citacoes[Math.floor(Math.random() * this.citacoes.length)];
    }
};