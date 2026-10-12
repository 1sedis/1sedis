import './fonts.css';
import './style.css';
import { getLang, t } from './i18n';
import { App } from './ui/app';

document.documentElement.lang = getLang();
document.title = t('Пиксельный гамбит');

const root = document.getElementById('app');
if (root) new App(root).start();
