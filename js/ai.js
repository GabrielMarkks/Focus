export const AI_Manager = {
    // Prompt para Classificação (JSON Mode)
    SYSTEM_PROMPT_SORT: `
        Você é um algoritmo JSON. 
        Receba uma lista de tarefas com IDs e Textos.
        Para CADA tarefa, decida se é Importante/Urgente.
        
        REGRAS RÍGIDAS:
        1. DEVOLVA O MESMO ID ORIGINAL EXATO (String). Não crie IDs novos.
        2. "Ler", "Estudar", "Treinar" -> Geralmente Crescimento (Importante=true, Urgente=false).
        3. Retorne APENAS o JSON array.
        
        Estrutura de Saída: 
        [{"id": "ID_ORIGINAL", "importante": true/false, "urgente": true/false, "tipo": "manutencao"/"crescimento"}]
    `,

    // --- 1. CLASSIFICADOR (MAGIC SORT) ---
    async classificar(provider, apiKey, tarefas) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const payload = {
            tarefas: tarefas.map(t => ({
                id: String(t.id),
                texto: t.texto
            }))
        };
        console.log(`🤖 Classificando via: ${provider}`);

        if (provider === 'gemini') return await this.callGemini(cleanKey, payload, 'sort');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, payload, 'sort');
        if (provider === 'groq') return await this.callGroq(cleanKey, payload, 'sort');
    },

    // --- 2. GERADOR DE SUB-TAREFAS (BOTÃO MÁGICO) [NOVO] ---
    async gerarSubtarefas(provider, apiKey, metaTexto) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const prompt = `
            ATUE COMO: Um Gerente de Projetos especialista em GTD e Agile.
            OBJETIVO: Quebrar a meta macro "${metaTexto}" em 3 a 5 micro-passos acionáveis e imediatos.
            
            REGRAS:
            1. Os passos devem ser curtos (máx 5 palavras).
            2. Devem ser práticos (começar com verbo de ação).
            3. Retorne APENAS um Array JSON de strings. Nada mais.
            
            EXEMPLO DE SAÍDA:
            ["Pesquisar concorrentes", "Comprar domínio", "Desenhar esboço"]
        `;

        console.log(`🪄 Quebrando meta via: ${provider}`);

        // Usamos o modo 'sort' aqui porque queremos um retorno JSON limpo
        if (provider === 'gemini') return await this.callGemini(cleanKey, {
            prompt
        }, 'sort');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, {
            prompt
        }, 'sort');
        if (provider === 'groq') return await this.callGroq(cleanKey, {
            prompt
        }, 'sort');
    },

    // --- 3. CHAT COACH (COM VISÃO MACRO) [ATUALIZADO] ---
    async chat(provider, apiKey, userMessage, context, history) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const historyText = history.map(h =>
            `${h.role === 'user' ? 'USUÁRIO' : 'COACH'}: ${h.content}`
        ).join('\n');

        // Formata as metas para a IA entender o contexto macro
        const metasTexto = (context.metas || []).map(m => {
            const total = m.subtarefas ? m.subtarefas.length : 0;
            const feitas = m.subtarefas ? m.subtarefas.filter(s => s.feita).length : 0;
            const progresso = total === 0 ? 0 : Math.round((feitas / total) * 100);
            return `- Projeto: "${m.texto}" (${progresso}% concluído)`;
        }).join('\n');

        const prompt = `
            JAILBREAK INSTRUCTION: Você é um Agente de Software (Focus Coach).
            
            ESTADO ATUAL:
            - Meta Semanal: "${context.metaSemanal || '(Vazio)'}"
            - Projetos Trimestrais (Visão Macro):
            ${metasTexto || '(Nenhum projeto definido)'}
            - Tarefas do Dia: ${context.tarefas.map(t => t.texto).join(', ')}
            
            HISTÓRICO:
            ${historyText}
            
            USUÁRIO DISSE: "${userMessage}"
            
            SUAS FERRAMENTAS (Use EXATAMENTE este formato para agir):
            1. [SET_GOAL: Texto da Meta] -> Para definir/alterar a meta da semana.
            2. [ADD: Texto da Tarefa] -> Para criar tarefas.
            3. [REMOVE: Texto da Tarefa] -> Para apagar tarefas. Busque pelo texto mais próximo.
            4. [ORGANIZE] -> Se o usuário pedir para organizar a Inbox.
            
            REGRAS DE COMPORTAMENTO:
            - NÃO mencione a "Meta Semanal" na resposta, a menos que o usuário tenha perguntado sobre ela ou alterado ela.
            - Se o usuário mandar remover algo, USE A FERRAMENTA [REMOVE: ...]. Não apenas diga que removeu.
            - Use os "Projetos Trimestrais" para alinhar suas sugestões. Se o usuário estiver perdido, sugira um passo prático para avançar neles.
            - Responda curto e direto.
        `;

        console.log(`💬 Chat via: ${provider}`);

        if (provider === 'gemini') return await this.callGemini(cleanKey, {
            prompt
        }, 'chat');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, {
            prompt
        }, 'chat');
        if (provider === 'groq') return await this.callGroq(cleanKey, {
            prompt
        }, 'chat');
    },

    // --- 4. ANALISTA DE PERFORMANCE ---
    async analisarPerformance(provider, apiKey, dados) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const resumo = `
            XP Total (Minutos): ${dados.xp}
            Tarefas Feitas: ${dados.totalTarefas}
            Foco em Urgências (Q1): ${dados.graficos.q1} min
            Foco em Metas (Q2): ${dados.graficos.q2} min
            Foco em Delegação (Q3): ${dados.graficos.q3} min
            Desperdício (Q4): ${dados.graficos.q4} min
        `;

        const prompt = `
            Você é um Analista de Alta Performance.
            Analise os dados da semana deste usuário:
            ${resumo}

            Dê um feedback de 2 frases.
            1. Um elogio sobre o ponto forte.
            2. Uma correção tática sobre o ponto fraco.
            Seja direto e use emojis.
        `;

        if (provider === 'gemini') return await this.callGemini(cleanKey, {
            prompt
        }, 'chat');
        if (provider === 'openai') return await this.callOpenAI(cleanKey, {
            prompt
        }, 'chat');
        if (provider === 'groq') return await this.callGroq(cleanKey, {
            prompt
        }, 'chat');
    },

    // --- 5. GERADOR DE ROTINA (AI SETUP WIZARD) ---
    async gerarRotina(provider, apiKey, respostas) {
        const cleanKey = apiKey ? apiKey.trim() : "";
        if (!cleanKey) throw new Error("API Key não informada.");

        const prompt = `
            ATUE COMO: Um Coach de Alta Performance especialista em GTD, OKR e Psicologia Positiva.

            O usuário respondeu um questionário de onboarding:
            1. Objetivo de vida: "${respostas.objetivo}"
            2. Maior dificuldade: "${respostas.dificuldade}"
            3. Horas disponíveis por dia: "${respostas.horas}"
            4. Área prioritária: "${respostas.area}"

            SUA MISSÃO: Gerar um plano de partida personalizado.

            REGRAS:
            1. Retorne APENAS um JSON object (sem markdown, sem texto extra).
            2. O JSON deve ter exatamente esta estrutura:
            {
                "habitos": ["Hábito 1 curto", "Hábito 2 curto", "Hábito 3 curto"],
                "metaSemanal": "Uma meta semanal clara e alcançável",
                "metaTrimestral": "Uma meta trimestral ambiciosa mas realista",
                "conselho": "Um conselho personalizado de 1-2 frases com base na dificuldade do usuário."
            }
        `;

        console.log(`🧙 Gerando rotina via: ${provider}`);

        if (provider === 'gemini') return await this.callGeminiObject(cleanKey, prompt);
        if (provider === 'openai') return await this.callOpenAIObject(cleanKey, prompt);
        if (provider === 'groq') return await this.callGroqObject(cleanKey, prompt);
    },

    // --- 6. NEGOCIADOR DE ZUMBIS ---
    async negociarZumbis(provider, apiKey, tarefasZumbis) {
        const lista = tarefasZumbis.map(t => `- "${t.texto}" (Criada há ${t.dias} dias)`).join('\n');
        const prompt = `
            CONTEXTO: O usuário está procrastinando estas tarefas há muito tempo (Tarefas Zumbis):
            ${lista}
            SUA MISSÃO: Seja um coach "Durão mas Justo". 
            Para cada tarefa, sugira uma ação rápida:
            1. DELETAR (se não for essencial).
            2. FAZER AGORA (se levar < 2 min).
            3. QUEBRAR (se for muito grande).
            Seja curto.
        `;

        if (provider === 'gemini') return await this.callGemini(apiKey, {
            prompt
        }, 'chat');
        if (provider === 'openai') return await this.callOpenAI(apiKey, {
            prompt
        }, 'chat');
        if (provider === 'groq') return await this.callGroq(apiKey, {
            prompt
        }, 'chat');
    },

    // --- ADAPTERS (COMUNICAÇÃO COM APIs) ---
    async callGemini(apiKey, data, mode) {
        const model = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        let textToSend = mode === 'sort' ? (this.SYSTEM_PROMPT_SORT + "\nINPUT:\n" + JSON.stringify(data)) : data.prompt;

        // Ajuste para o Gerador de Subtarefas que usa modo 'sort' mas manda prompt direto
        if (mode === 'sort' && data.prompt) {
            textToSend = data.prompt;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: textToSend
                    }]
                }]
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Erro Gemini");
        }
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        return mode === 'sort' ? this.parseJSON(text) : text;
    },

    async callOpenAI(apiKey, data, mode) {
        const url = "https://api.openai.com/v1/chat/completions";
        let messages;
        if (mode === 'sort' && !data.prompt) {
            messages = [{
                role: "system",
                content: this.SYSTEM_PROMPT_SORT
            }, {
                role: "user",
                content: JSON.stringify(data)
            }];
        } else if (mode === 'sort' && data.prompt) {
            messages = [{
                role: "user",
                content: data.prompt
            }];
        } else {
            messages = [{
                role: "user",
                content: data.prompt
            }];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages,
                temperature: 0.3
            })
        });
        if (!response.ok) throw new Error("Erro OpenAI");
        const resData = await response.json();
        return mode === 'sort' ? this.parseJSON(resData.choices[0].message.content) : resData.choices[0].message.content;
    },

    async callGroq(apiKey, data, mode) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        let messages;
        if (mode === 'sort' && !data.prompt) {
            messages = [{
                role: "system",
                content: this.SYSTEM_PROMPT_SORT
            }, {
                role: "user",
                content: JSON.stringify(data)
            }];
        } else if (mode === 'sort' && data.prompt) {
            messages = [{
                role: "user",
                content: data.prompt
            }];
        } else {
            messages = [{
                role: "user",
                content: data.prompt
            }];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages,
                temperature: 0.1
            })
        });
        if (!response.ok) throw new Error("Erro Groq");
        const resData = await response.json();
        return mode === 'sort' ? this.parseJSON(resData.choices[0].message.content) : resData.choices[0].message.content;
    },

    async callGeminiObject(apiKey, prompt) {
        const model = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || "Erro Gemini"); }
        const resData = await response.json();
        return this.parseObject(resData.candidates[0].content.parts[0].text);
    },

    async callOpenAIObject(apiKey, prompt) {
        const url = "https://api.openai.com/v1/chat/completions";
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.5 })
        });
        if (!response.ok) throw new Error("Erro OpenAI");
        const resData = await response.json();
        return this.parseObject(resData.choices[0].message.content);
    },

    async callGroqObject(apiKey, prompt) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.5 })
        });
        if (!response.ok) throw new Error("Erro Groq");
        const resData = await response.json();
        return this.parseObject(resData.choices[0].message.content);
    },

    parseObject(text) {
        try {
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');
            if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
            return JSON.parse(clean);
        } catch (e) {
            throw new Error("Formato inválido da IA.");
        }
    },

    parseJSON(text) {
        try {
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = clean.indexOf('[');
            const end = clean.lastIndexOf(']');
            if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
            return JSON.parse(clean);
        } catch (e) {
            throw new Error("Formato inválido da IA.");
        }
    }
};