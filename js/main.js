import { Model } from './model.js';
import { View } from './view.js';
import { Controller } from './controller.js';
import { AI_Manager } from './ai.js';

let deferredPrompt; // Variável para guardar o evento de instalação

const App = {
    Model,
    View,
    Controller,
    AI_Manager,

    // Função para instalar PWA
    async installPWA() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                deferredPrompt = null;
                document.getElementById('btn-install-app').classList.add('d-none');
            }
        }
    }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
    Controller.init();

    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registrado! 📡'))
            .catch(err => console.error('Erro SW:', err));
    }

    // 2. Capturar evento de instalação (PWA)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Mostra o botão de instalar
        const btn = document.getElementById('btn-install-app');
        if(btn) btn.classList.remove('d-none');
    });

    // 3. Esconder botão se já instalado
    window.addEventListener('appinstalled', () => {
        const btn = document.getElementById('btn-install-app');
        if(btn) btn.classList.add('d-none');
        deferredPrompt = null;
        console.log('App instalado com sucesso! 🎉');
    });
});