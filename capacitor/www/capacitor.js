import { Capacitor } from '@capacitor/core';

// Capacitorが利用可能かチェック
window.isNative = Capacitor.isNativePlatform();
window.platform = Capacitor.getPlatform();

console.log('Capacitor initialized');
console.log('Platform:', window.platform);
console.log('Is Native:', window.isNative);
