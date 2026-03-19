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
            ultimoMorning: null,
            bemestar: null,
            financeiro: null,
            notas: null,
            timeBlocking: null,
            viagens: null,
            notificacoes: null
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

    _defaultBemestar() {
        return {
            hidratacao: { meta: 8, copos: 0, data: '' },
            sono: [],
            treinos: [],
            suplementosConfig: ['Proteína', 'Vitamina D', 'Creatina'],
            suplementosHoje: [],
            suplementosData: '',
            vicios: []
        };
    },

    getBemestar() {
        if (!this.usuario.config.bemestar) {
            this.usuario.config.bemestar = this._defaultBemestar();
        }
        // Daily reset
        const hoje = new Date().toLocaleDateString();
        const bm = this.usuario.config.bemestar;
        if (bm.hidratacao.data !== hoje) {
            bm.hidratacao.copos = 0;
            bm.hidratacao.data = hoje;
        }
        if (bm.suplementosData !== hoje) {
            bm.suplementosHoje = [];
            bm.suplementosData = hoje;
        }
        return bm;
    },

    registrarCopo() {
        const bm = this.getBemestar();
        bm.hidratacao.copos = Math.min(bm.hidratacao.copos + 1, bm.hidratacao.meta + 4);
        this.salvarPerfilBackground();
    },

    removerCopo() {
        const bm = this.getBemestar();
        bm.hidratacao.copos = Math.max(0, bm.hidratacao.copos - 1);
        this.salvarPerfilBackground();
    },

    setMetaHidratacao(meta) {
        this.getBemestar().hidratacao.meta = Math.max(1, Math.min(20, meta));
        this.salvarPerfilBackground();
    },

    registrarSono(horas) {
        const bm = this.getBemestar();
        const data = new Date().toLocaleDateString();
        bm.sono = bm.sono.filter(s => s.data !== data);
        bm.sono.unshift({ data, horas });
        if (bm.sono.length > 7) bm.sono = bm.sono.slice(0, 7);
        this.salvarPerfilBackground();
    },

    registrarTreino(descricao) {
        const bm = this.getBemestar();
        const data = new Date().toLocaleDateString();
        bm.treinos.unshift({ id: crypto.randomUUID(), data, descricao });
        if (bm.treinos.length > 14) bm.treinos = bm.treinos.slice(0, 14);
        this.salvarPerfilBackground();
    },

    toggleSuplemento(nome) {
        const bm = this.getBemestar();
        const idx = bm.suplementosHoje.indexOf(nome);
        if (idx >= 0) bm.suplementosHoje.splice(idx, 1);
        else bm.suplementosHoje.push(nome);
        this.salvarPerfilBackground();
    },

    addVicio(nome) {
        const bm = this.getBemestar();
        bm.vicios.push({ id: crypto.randomUUID(), nome, streak: 0, ultimaData: '' });
        this.salvarPerfilBackground();
    },

    checkInVicio(id) {
        const bm = this.getBemestar();
        const v = bm.vicios.find(x => x.id === id);
        if (v) {
            const hoje = new Date().toLocaleDateString();
            if (v.ultimaData !== hoje) {
                v.streak++;
                v.ultimaData = hoje;
                this.salvarPerfilBackground();
                return true;
            }
        }
        return false;
    },

    resetarVicio(id) {
        const bm = this.getBemestar();
        const v = bm.vicios.find(x => x.id === id);
        if (v) { v.streak = 0; v.ultimaData = ''; this.salvarPerfilBackground(); }
    },

    delVicio(id) {
        const bm = this.getBemestar();
        bm.vicios = bm.vicios.filter(v => v.id !== id);
        this.salvarPerfilBackground();
    },

    // ==========================================================
    // --- FINANCEIRO ---
    // ==========================================================
    _defaultFinanceiro() {
        return {
            transacoes: [],
            categorias: {
                receita: ['Salário', 'Freelance', 'Bônus', 'Investimento', 'Outros'],
                despesa: ['Alimentação', 'Transporte', 'Lazer', 'Moradia', 'Saúde', 'Educação', 'Assinaturas', 'Outros'],
                investimento: ['Ações', 'FIIs', 'CDB/LCI', 'Cripto', 'Poupança', 'Outros']
            }
        };
    },

    getFinanceiro() {
        if (!this.usuario.config.financeiro) {
            this.usuario.config.financeiro = this._defaultFinanceiro();
        }
        return this.usuario.config.financeiro;
    },

    addTransacao(tipo, valor, descricao, categoria, data) {
        const fin = this.getFinanceiro();
        fin.transacoes.unshift({
            id: crypto.randomUUID(),
            tipo,
            valor: parseFloat(valor),
            descricao,
            categoria: categoria || 'Outros',
            data: data || new Date().toLocaleDateString('pt-BR')
        });
        if (fin.transacoes.length > 200) fin.transacoes = fin.transacoes.slice(0, 200);
        this.salvarPerfilBackground();
    },

    delTransacao(id) {
        const fin = this.getFinanceiro();
        fin.transacoes = fin.transacoes.filter(t => t.id !== id);
        this.salvarPerfilBackground();
    },

    getSaldoAtual() {
        return this.getFinanceiro().transacoes.reduce((acc, t) => {
            if (t.tipo === 'receita') return acc + t.valor;
            if (t.tipo === 'despesa') return acc - t.valor;
            return acc;
        }, 0);
    },

    _parseDateBR(str) {
        if (!str) return null;
        const p = str.split('/');
        if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
        return null;
    },

    getResumoMes(mes, ano) {
        const ts = this.getFinanceiro().transacoes.filter(t => {
            const d = this._parseDateBR(t.data);
            return d && d.getMonth() === mes && d.getFullYear() === ano;
        });
        const receitas = ts.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0);
        const despesas = ts.filter(t => t.tipo === 'despesa').reduce((a, t) => a + t.valor, 0);
        const investimentos = ts.filter(t => t.tipo === 'investimento').reduce((a, t) => a + t.valor, 0);
        return { receitas, despesas, investimentos, saldo: receitas - despesas - investimentos, transacoes: ts };
    },

    getTransacoesPorDia(mes, ano) {
        const mapa = {};
        this.getFinanceiro().transacoes.forEach(t => {
            const d = this._parseDateBR(t.data);
            if (d && d.getMonth() === mes && d.getFullYear() === ano) {
                const dia = d.getDate();
                if (!mapa[dia]) mapa[dia] = [];
                mapa[dia].push(t);
            }
        });
        return mapa;
    },

    // ==========================================================
    // --- NOTAS ---
    // ==========================================================
    getNotas() {
        if (!this.usuario.config.notas) this.usuario.config.notas = [];
        return this.usuario.config.notas;
    },

    addNota(titulo, conteudo) {
        const id = crypto.randomUUID();
        this.getNotas().unshift({ id, titulo: titulo || 'Sem título', conteudo, criadaEm: new Date().toISOString() });
        if (this.usuario.config.notas.length > 100) this.usuario.config.notas.pop();
        this.salvarPerfilBackground();
        return id;
    },

    updateNota(id, titulo, conteudo) {
        const n = this.getNotas().find(x => x.id === id);
        if (n) { n.titulo = titulo || 'Sem título'; n.conteudo = conteudo; n.atualizadaEm = new Date().toISOString(); this.salvarPerfilBackground(); }
    },

    delNota(id) {
        this.usuario.config.notas = this.getNotas().filter(n => n.id !== id);
        this.salvarPerfilBackground();
    },

    // ==========================================================
    // --- TIME BLOCKING ---
    // ==========================================================
    getTimeBlocking() {
        if (!this.usuario.config.timeBlocking) this.usuario.config.timeBlocking = {};
        return this.usuario.config.timeBlocking;
    },

    addBlocoTempo(data, horario, texto, duracao = 60) {
        const tb = this.getTimeBlocking();
        if (!tb[data]) tb[data] = [];
        tb[data] = tb[data].filter(b => b.horario !== horario);
        tb[data].push({ id: crypto.randomUUID(), horario, texto, duracao });
        tb[data].sort((a, b) => a.horario.localeCompare(b.horario));
        this.salvarPerfilBackground();
    },

    delBlocoTempo(data, id) {
        const tb = this.getTimeBlocking();
        if (tb[data]) { tb[data] = tb[data].filter(b => b.id !== id); this.salvarPerfilBackground(); }
    },

    getBlocosDia(data) {
        return this.getTimeBlocking()[data] || [];
    },

    // ==========================================================
    // --- HOBBIES ---
    // ==========================================================
    _defaultHobbies() {
        return [];
    },

    getHobbies() {
        const bm = this.getBemestar();
        if (!bm.hobbies) bm.hobbies = this._defaultHobbies();
        return bm.hobbies;
    },

    addHobby(nome, categoria) {
        const hobbies = this.getHobbies();
        hobbies.push({ id: crypto.randomUUID(), nome, categoria, streak: 0, ultimoCheckin: null });
        this.salvarPerfilBackground();
    },

    checkinHobby(id) {
        const hoje = new Date().toLocaleDateString('pt-BR');
        const h = this.getHobbies().find(x => x.id === id);
        if (!h) return;
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ontemStr = ontem.toLocaleDateString('pt-BR');
        if (h.ultimoCheckin === hoje) return; // já fez hoje
        h.streak = h.ultimoCheckin === ontemStr ? (h.streak || 0) + 1 : 1;
        h.ultimoCheckin = hoje;
        this.salvarPerfilBackground();
    },

    delHobby(id) {
        const bm = this.getBemestar();
        bm.hobbies = this.getHobbies().filter(h => h.id !== id);
        this.salvarPerfilBackground();
    },

    // ==========================================================
    // --- VIAGENS ---
    // ==========================================================
    _defaultViagens() {
        return [];
    },

    getViagens() {
        if (!this.usuario.config.viagens) this.usuario.config.viagens = this._defaultViagens();
        return this.usuario.config.viagens;
    },

    addViagem(dados) {
        const v = { id: crypto.randomUUID(), checklist: [], ...dados };
        this.getViagens().unshift(v);
        this.salvarPerfilBackground();
        return v.id;
    },

    updateViagem(id, dados) {
        const v = this.getViagens().find(x => x.id === id);
        if (!v) return;
        Object.assign(v, dados);
        this.salvarPerfilBackground();
    },

    delViagem(id) {
        this.usuario.config.viagens = this.getViagens().filter(v => v.id !== id);
        this.salvarPerfilBackground();
    },

    addItemChecklist(viagemId, texto) {
        const v = this.getViagens().find(x => x.id === viagemId);
        if (!v) return;
        if (!v.checklist) v.checklist = [];
        v.checklist.push({ id: crypto.randomUUID(), texto, feito: false });
        this.salvarPerfilBackground();
    },

    toggleItemChecklist(viagemId, itemId) {
        const v = this.getViagens().find(x => x.id === viagemId);
        if (!v) return;
        const item = v.checklist.find(i => i.id === itemId);
        if (item) { item.feito = !item.feito; this.salvarPerfilBackground(); }
    },

    delItemChecklist(viagemId, itemId) {
        const v = this.getViagens().find(x => x.id === viagemId);
        if (!v) return;
        v.checklist = v.checklist.filter(i => i.id !== itemId);
        this.salvarPerfilBackground();
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

        // Reset diário do bem-estar
        const bm = this.getBemestar();
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        bm.hidratacao.copos = 0;
        bm.hidratacao.data = amanha.toLocaleDateString();
        bm.suplementosHoje = [];
        bm.suplementosData = amanha.toLocaleDateString();

        this.salvarPerfilBackground();

        // Reset diário dos hábitos na nuvem
        if (this.session) supabase.from('habitos').update({
            concluido_hoje: false
        }).eq('user_id', this.session.user.id).then();

        return { migradas };
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