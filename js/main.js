import { Model } from './model.js';
import { View } from './view.js';
import { Controller } from './controller.js';
import { AI_Manager } from './ai.js';

// Cria o objeto Global App acessível pelo Console
const App = {
    Model,
    View,
    Controller,
    AI_Manager
};

// Expõe para o navegador (window)
window.App = App;

// Inicia o sistema quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    Controller.init();
});