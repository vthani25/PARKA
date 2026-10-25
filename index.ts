// Define the notification action task first, so "I'm awake" works even when the app is closed.
import './src/services/backgroundTask';

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
