const AI_Manager = {
    // A "Personalidade" do Assistente
    SYSTEM_PROMPT: `
        Você é um especialista em produtividade focado na Matriz de Eisenhower.
        Sua missão é analisar uma lista de tarefas e classificá-las.
        
        Regras de Saída (RIGOROSAS):
        1. Retorne APENAS um Array JSON válido.
        2. NÃO use Markdown (sem \`\`\`json).
        3. NÃO escreva introduções ou explicações.
        
        Formato de cada objeto no Array:
        {
            "id": "mantenha_o_id_exato_como_string",
            "importante": true/false,
            "urgente": true/false,
            "tipo": "manutencao" (para rotinas/obrigações) ou "crescimento" (para metas/estudos)
        }
    `,

    // Roteador de Provedores
    async classificar(provider, apiKey, tarefas) {
        // Limpeza de segurança da chave
        const cleanKey = apiKey ? apiKey.trim() : "";
        
        if (!cleanKey) throw new Error("API Key não informada. Configure nos Ajustes.");
        
        // Converte IDs para String para garantir integridade na volta
        const payload = {
            tarefas: tarefas.map(t => ({ id: String(t.id), texto: t.texto }))
        };

        console.log(`🤖 IA Iniciada via: ${provider.toUpperCase()}`);

        switch (provider) {
            case 'gemini':
                return await this.callGemini(cleanKey, payload);
            case 'openai':
                return await this.callOpenAI(cleanKey, payload);
            case 'groq':
                return await this.callGroq(cleanKey, payload);
            default:
                throw new Error("Provedor de IA desconhecido.");
        }
    },

    // --- ADAPTER: GOOGLE GEMINI (Flash 1.5 - Rápido/Grátis) ---
    async callGemini(apiKey, payload) {
        const model = "gemini-1.5-flash"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const body = {
            contents: [{
                parts: [{ text: this.SYSTEM_PROMPT + "\nLista para analisar:\n" + JSON.stringify(payload) }]
            }]
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        
        if (!response.ok) {
            const err = await response.json();
            console.error("Erro Gemini:", err);
            throw new Error(err.error?.message || "Erro de conexão com Google Gemini.");
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error("A IA não retornou conteúdo. Tente novamente.");
        }
        
        const text = data.candidates[0].content.parts[0].text;
        return this.parseResponse(text);
    },

    // --- ADAPTER: OPENAI (GPT-4o Mini - Custo Eficiente) ---
    async callOpenAI(apiKey, payload) {
        const url = "https://api.openai.com/v1/chat/completions";
        
        const body = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: this.SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(payload) }
            ],
            temperature: 0.1
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro OpenAI: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return this.parseResponse(data.choices[0].message.content);
    },

    // --- ADAPTER: GROQ (Llama 3.3 - Ultra Rápido) ---
    async callGroq(apiKey, payload) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        
        const body = {
            model: "llama-3.3-70b-versatile", // Modelo Atualizado
            messages: [
                { role: "system", content: this.SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(payload) }
            ],
            temperature: 0.1
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Erro Groq:", err);
            throw new Error(`Erro Groq: ${err.error?.message || "Chave inválida ou modelo indisponível."}`);
        }

        const data = await response.json();
        return this.parseResponse(data.choices[0].message.content);
    },

    // --- UTILITÁRIO: Limpeza e Extração de JSON ---
    parseResponse(text) {
        try {
            console.log("Resposta Bruta IA:", text);
            
            // Remove blocos de código Markdown se a IA teimosamente enviar
            let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Busca o início [ e fim ] do array para ignorar textos extras
            const start = clean.indexOf('[');
            const end = clean.lastIndexOf(']');
            
            if (start !== -1 && end !== -1) {
                clean = clean.substring(start, end + 1);
            }
            
            return JSON.parse(clean);
        } catch (e) {
            console.error("Falha no Parse JSON:", e);
            throw new Error("A IA respondeu, mas o formato não é válido. Tente de novo.");
        }
    }
};