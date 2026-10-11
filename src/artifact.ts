// Entry for the single-file claude.ai artifact build (fonts come from Google Fonts).
import './style.css';
import { App } from './ui/app';

const root = document.getElementById('app');
if (root) new App(root).start();
