import { Model } from './model.js';
import { View } from './view.js';
import { Controller } from './controller.js';
import { AI_Manager } from './ai.js';

let deferredPrompt;

const App = {
    Model,
    View,
    Controller,
    AI_Manager,

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

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registrado! 📡'))
            .catch(err => console.error('Erro SW:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('btn-install-app');
        if (btn) btn.classList.remove('d-none');
    });

    window.addEventListener('appinstalled', () => {
        const btn = document.getElementById('btn-install-app');
        if (btn) btn.classList.add('d-none');
        deferredPrompt = null;
    });
});