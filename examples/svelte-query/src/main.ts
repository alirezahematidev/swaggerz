import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('root');
if (target === null) throw new Error('Missing #root element.');
mount(App, { target });
