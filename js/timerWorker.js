// js/timerWorker.js

let timerId = null;
let tempoRestante = 0;

// O worker fica "escutando" as mensagens enviadas pelo arquivo principal
self.onmessage = function(e) {
    const data = e.data;

    if (data.action === 'start') {
        tempoRestante = data.duration;
        
        // Limpa qualquer timer perdido antes de iniciar um novo
        if (timerId) clearInterval(timerId);
        
        // Inicia a contagem exata de 1 segundo (1000ms)
        timerId = setInterval(() => {
            tempoRestante--;
            
            // Envia o tempo atualizado de volta para a tela (main thread)
            self.postMessage({ status: 'tick', remaining: tempoRestante });
            
            if (tempoRestante <= 0) {
                clearInterval(timerId);
                self.postMessage({ status: 'done' });
            }
        }, 1000);
        
    } else if (data.action === 'pause') {
        // Pausa a contagem, mas guarda o tempo restante
        if (timerId) clearInterval(timerId);
        
    } else if (data.action === 'resume') {
        // Retoma de onde parou
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => {
            tempoRestante--;
            self.postMessage({ status: 'tick', remaining: tempoRestante });
            if (tempoRestante <= 0) {
                clearInterval(timerId);
                self.postMessage({ status: 'done' });
            }
        }, 1000);
        
    } else if (data.action === 'stop') {
        // Zera e para tudo
        if (timerId) clearInterval(timerId);
        tempoRestante = 0;
    }
};