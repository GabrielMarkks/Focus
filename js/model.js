import {
    supabase
} from './supabase.js';

export const Model = {
    usuario: {
        nome: "",
        proposito: "",
        metaSemanal: {
            texto: "",
            subtarefas: []
        },
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
    citacoes: ["Menos, porém melhor.", "O foco é a nova moeda.", "1% melhor todo dia.", "Feito é melhor que perfeito.", "A tua atenção é o teu maior ativo."],
    session: null,

    obterFraseAleatoria() {
        return this.citacoes[Math.floor(Math.random() * this.citacoes.length)];
    },

    // ==========================================================
    // --- 1. AUTENTICAÇÃO SUPABASE ---
    // ==========================================================
    async verificarSessao() {
        const {
            data
        } = await supabase.auth.getSession();
        this.session = data.session;
        return this.session;
    },
    async cadastrar(email, senha) {
        const {
            data,
            error
        } = await supabase.auth.signUp({
            email,
            password: senha
        });
        if (error) throw error;
        return data;
    },
    async entrar(email, senha) {
        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email,
            password: senha
        });
        if (error) throw error;
        return data;
    },

    // ==========================================================
    // --- 2. CARREGAMENTO (NUVEM -> ECRÃ) ---
    // ==========================================================
    async carregar() {
        if (!this.session) return false;
        const uid = this.session.user.id;

        try {
            // 1. Perfil Principal
            let {
                data: perfil
            } = await supabase.from('perfis').select('*').eq('id', uid).single();
            if (!perfil) {
                // Primeiro acesso na nuvem: Cria perfil em branco
                await supabase.from('perfis').insert({
                    id: uid,
                    config: this.usuario.config
                });
                return false; // Retorna false para mostrar o ecrã de Onboarding
            }
            this.usuario.nome = perfil.nome || "";
            this.usuario.proposito = perfil.proposito || "";
            this.usuario.papeis = perfil.papeis || [];
            this.usuario.config = perfil.config || this.usuario.config;

            // 2. Tarefas e Histórico (Matriz e Inbox)
            const {
                data: tarefasDb
            } = await supabase.from('tarefas').select('*').eq('user_id', uid);
            this.usuario.tarefas = (tarefasDb || []).filter(t => !t.feita).map(t => ({
                id: t.id,
                texto: t.texto,
                urgente: t.urgente,
                importante: t.importante,
                tipo: t.tipo,
                isInbox: t.is_inbox,
                feita: t.feita,
                tempoInvestido: t.tempo_investido,
                criadaEm: new Date(t.criada_em).getTime()
            }));
            this.usuario.historico = (tarefasDb || []).filter(t => t.feita).map(t => ({
                id: t.id,
                texto: t.texto,
                tempoInvestido: t.tempo_investido,
                concluidaEm: new Date(t.concluida_em).getTime()
            }));

            // 3. Hábitos Diários
            const {
                data: habitosDb
            } = await supabase.from('habitos').select('*').eq('user_id', uid);
            this.usuario.habitos = (habitosDb || []).map(h => ({
                id: h.id,
                texto: h.texto,
                dias: h.dias,
                streak: h.streak,
                concluidoHoje: h.concluido_hoje
            }));

            // 4. Metas Trimestrais e Subtarefas
            const {
                data: metasDb
            } = await supabase.from('metas').select('*, subtarefas_metas(*)').eq('user_id', uid);
            this.usuario.metasTrimestrais = (metasDb || []).map(m => ({
                id: m.id,
                texto: m.texto,
                concluida: m.concluida,
                subtarefas: m.subtarefas_metas.map(s => ({
                    id: s.id,
                    texto: s.texto,
                    feita: s.feita
                }))
            }));

            this.usuario.metaSemanal = this.usuario.config.metaSemanal || {
                texto: "",
                subtarefas: []
            };

            // 5. Histórico do Chat IA
            const {
                data: chatDb
            } = await supabase.from('chat_history').select('*').eq('user_id', uid).order('criado_em', {
                ascending: true
            });
            this.chatMemory.history = (chatDb || []).map(c => ({
                role: c.role,
                content: c.content
            }));

            return !!this.usuario.nome; // Se tem nome guardado, entra direto no Dashboard
        } catch (e) {
            console.error("Erro ao puxar dados do Supabase:", e);
            return false;
        }
    },

    // ==========================================================
    // --- 3. SINCRONIZAÇÃO DE PERFIL (BACKGROUND) ---
    // ==========================================================
    salvarPerfilBackground() {
        if (!this.session) return;
        this.usuario.config.metaSemanal = this.usuario.metaSemanal;
        supabase.from('perfis').update({
            nome: this.usuario.nome,
            proposito: this.usuario.proposito,
            papeis: this.usuario.papeis,
            config: this.usuario.config
        }).eq('id', this.session.user.id).then(); // `.then()` faz o sync acontecer em background
    },
    salvar() {
        this.salvarPerfilBackground();
    },
    atualizarUsuario(chave, valor) {
        this.usuario[chave] = valor;
        this.salvarPerfilBackground();
    },

    // ==========================================================
    // --- 4. GESTÃO DE TAREFAS (OPTIMISTIC UI) ---
    // ==========================================================
    obterTarefa(id) {
        return this.usuario.tarefas.find(t => t.id === id);
    },
    addTarefa(texto, importante, urgente, tipo, isInbox = false) {
        const id = crypto.randomUUID();
        const novaTarefa = {
            id,
            texto,
            importante,
            urgente,
            tipo,
            isInbox,
            feita: false,
            tempoInvestido: 0,
            criadaEm: Date.now()
        };

        // Atualiza a UI imediatamente
        this.usuario.tarefas.push(novaTarefa);

        // Envia para a base de dados
        if (this.session) {
            supabase.from('tarefas').insert({
                id,
                user_id: this.session.user.id,
                texto,
                urgente,
                importante,
                tipo,
                is_inbox: isInbox
            }).then();
        }
    },
    delTarefa(id) {
        this.usuario.tarefas = this.usuario.tarefas.filter(t => t.id !== id);
        if (this.session) supabase.from('tarefas').delete().eq('id', id).then();
    },
    concluirTarefa(id, minutos) {
        const t = this.usuario.tarefas.find(x => x.id === id);
        if (t) {
            t.feita = true;
            t.tempoInvestido += minutos;
            t.concluidaEm = Date.now();
            this.usuario.historico.push(t);
            this.usuario.tarefas = this.usuario.tarefas.filter(x => x.id !== id);

            if (this.session) {
                supabase.from('tarefas').update({
                    feita: true,
                    tempo_investido: t.tempoInvestido,
                    concluida_em: new Date().toISOString()
                }).eq('id', id).then();
            }
        }
    },
    moverInboxParaMatriz(id, importante, urgente, tipo) {
        const t = this.obterTarefa(id);
        if (t) {
            t.importante = importante;
            t.urgente = urgente;
            t.tipo = tipo;
            t.isInbox = false;
            if (this.session) supabase.from('tarefas').update({
                importante,
                urgente,
                tipo,
                is_inbox: false
            }).eq('id', id).then();
        }
    },
    encerrarDia() {
        let migradas = 0;
        this.usuario.tarefas.forEach(t => {
            if (!t.feita) {
                t.adiada = (t.adiada || 0) + 1;
                migradas++;
            }
        });
        this.usuario.habitos.forEach(h => {
            h.concluidoHoje = false;
        });
        this.salvarPerfilBackground();

        // Reset diário dos hábitos na nuvem
        if (this.session) supabase.from('habitos').update({
            concluido_hoje: false
        }).eq('user_id', this.session.user.id).then();

        return {
            migradas
        };
    },

    // ==========================================================
    // --- 5. HÁBITOS ---
    // ==========================================================
    addHabito(texto, dias) {
        const id = crypto.randomUUID();
        this.usuario.habitos.push({
            id,
            texto,
            dias,
            streak: 0,
            concluidoHoje: false
        });
        if (this.session) supabase.from('habitos').insert({
            id,
            user_id: this.session.user.id,
            texto,
            dias
        }).then();
    },
    toggleHabito(id) {
        const h = this.usuario.habitos.find(x => x.id === id);
        if (h) {
            h.concluidoHoje = !h.concluidoHoje;
            if (h.concluidoHoje) {
                h.streak++;
                h.ultimaData = new Date().toLocaleDateString();
            } else h.streak = Math.max(0, h.streak - 1);

            if (this.session) supabase.from('habitos').update({
                concluido_hoje: h.concluidoHoje,
                streak: h.streak,
                ultima_data: new Date().toISOString()
            }).eq('id', id).then();
        }
    },
    delHabito(id) {
        this.usuario.habitos = this.usuario.habitos.filter(h => h.id !== id);
        if (this.session) supabase.from('habitos').delete().eq('id', id).then();
    },

    // ==========================================================
    // --- 6. METAS TRIMESTRAIS (VISION) ---
    // ==========================================================
    addMetaTrimestral(texto) {
        const id = crypto.randomUUID();
        this.usuario.metasTrimestrais.push({
            id,
            texto,
            concluida: false,
            subtarefas: []
        });
        if (this.session) supabase.from('metas').insert({
            id,
            user_id: this.session.user.id,
            texto
        }).then();
    },
    delMetaTrimestral(id) {
        this.usuario.metasTrimestrais = this.usuario.metasTrimestrais.filter(m => m.id !== id);
        if (this.session) supabase.from('metas').delete().eq('id', id).then();
    },
    toggleMetaTrimestral(id) {
        const m = this.usuario.metasTrimestrais.find(x => x.id === id);
        if (m) {
            m.concluida = !m.concluida;
            if (this.session) supabase.from('metas').update({
                concluida: m.concluida
            }).eq('id', id).then();
        }
    },
    addSubTarefaMeta(metaId, texto) {
        const m = this.usuario.metasTrimestrais.find(x => x.id === metaId);
        if (m) {
            const subId = crypto.randomUUID();
            m.subtarefas = m.subtarefas || [];
            m.subtarefas.push({
                id: subId,
                texto,
                feita: false
            });
            if (this.session) supabase.from('subtarefas_metas').insert({
                id: subId,
                meta_id: metaId,
                texto
            }).then();
        }
    },
    toggleSubTarefaMeta(metaId, subId) {
        const m = this.usuario.metasTrimestrais.find(x => x.id === metaId);
        if (m && m.subtarefas) {
            const s = m.subtarefas.find(x => x.id === subId);
            if (s) {
                s.feita = !s.feita;
                if (this.session) supabase.from('subtarefas_metas').update({
                    feita: s.feita
                }).eq('id', subId).then();
            }
        }
    },
    delSubTarefaMeta(metaId, subId) {
        const m = this.usuario.metasTrimestrais.find(x => x.id === metaId);
        if (m && m.subtarefas) {
            m.subtarefas = m.subtarefas.filter(x => x.id !== subId);
            if (this.session) supabase.from('subtarefas_metas').delete().eq('id', subId).then();
        }
    },

    // ==========================================================
    // --- 7. META SEMANAL ---
    // ==========================================================
    addSubTarefaSemanal(texto) {
        if (typeof this.usuario.metaSemanal !== 'object') this.usuario.metaSemanal = {
            texto: "",
            subtarefas: []
        };
        this.usuario.metaSemanal.subtarefas.push({
            id: crypto.randomUUID(),
            texto,
            feita: false
        });
        this.salvarPerfilBackground();
    },
    toggleSubTarefaSemanal(id) {
        if (this.usuario.metaSemanal && this.usuario.metaSemanal.subtarefas) {
            const s = this.usuario.metaSemanal.subtarefas.find(x => x.id === id);
            if (s) {
                s.feita = !s.feita;
                this.salvarPerfilBackground();
            }
        }
    },
    delSubTarefaSemanal(id) {
        if (this.usuario.metaSemanal && this.usuario.metaSemanal.subtarefas) {
            this.usuario.metaSemanal.subtarefas = this.usuario.metaSemanal.subtarefas.filter(x => x.id !== id);
            this.salvarPerfilBackground();
        }
    },
    atualizarTextoMetaSemanal(texto) {
        if (typeof this.usuario.metaSemanal !== 'object') this.usuario.metaSemanal = {
            texto: "",
            subtarefas: []
        };
        this.usuario.metaSemanal.texto = texto;
        this.salvarPerfilBackground();
    },

    // ==========================================================
    // --- 8. ANALYTICS ---
    // ==========================================================
    getXP() {
        return this.usuario.historico.reduce((acc, t) => acc + (t.tempoInvestido || 0), 0);
    },
    getNivel() {
        const xp = this.getXP();
        if (xp < 100) return {
            t: "Iniciante",
            i: "🌱"
        };
        if (xp < 500) return {
            t: "Focado",
            i: "🔥"
        };
        if (xp < 1500) return {
            t: "Produtivo",
            i: "⚡"
        };
        return {
            t: "Lenda",
            i: "👑"
        };
    },
    getMinHoje() {
        const h = new Date().toLocaleDateString();
        return this.usuario.historico.filter(t => new Date(t.concluidaEm).toLocaleDateString() === h)
            .reduce((acc, t) => acc + (t.tempoInvestido || 0), 0);
    },
    getDadosGraf() {
        const msSemana = 7 * 24 * 60 * 60 * 1000;
        const agora = Date.now();
        const hs = this.usuario.historico.filter(t => (agora - t.concluidaEm) <= msSemana);
        const ts = this.usuario.tarefas;
        return {
            q1: ts.filter(t => t.urgente && t.importante && !t.isInbox).length,
            q2: ts.filter(t => !t.urgente && t.importante && !t.isInbox).length,
            q3: ts.filter(t => t.urgente && !t.importante && !t.isInbox).length,
            q4: ts.filter(t => !t.urgente && !t.importante && !t.isInbox).length,
            manut: hs.filter(t => t.tipo === 'manutencao').reduce((acc, t) => acc + (t.tempoInvestido || 0), 0),
            cresc: hs.filter(t => t.tipo === 'crescimento').reduce((acc, t) => acc + (t.tempoInvestido || 0), 0)
        };
    },

    // ==========================================================
    // --- 9. CHAT DA IA (PERSISTÊNCIA) ---
    // ==========================================================
    pushChatMessage(role, content) {
        this.chatMemory.history.push({
            role,
            content
        });
        if (this.session) supabase.from('chat_history').insert({
            user_id: this.session.user.id,
            role,
            content
        }).then();
    }
};