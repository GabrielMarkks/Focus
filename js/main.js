import { Controller } from './controller.js';
import { View } from './view.js';

// Expõe globalmente para o HTML
window.App = {
    Controller: Controller,
    View: View
};

document.addEventListener('DOMContentLoaded', () => {
    Controller.init();
});