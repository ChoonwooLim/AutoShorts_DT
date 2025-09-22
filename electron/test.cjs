console.log('Node version:', process.version);
console.log('Electron require test...');

try {
  const electron = require('electron');
  console.log('Electron loaded:', !!electron);
  console.log('app:', !!electron.app);
  console.log('BrowserWindow:', !!electron.BrowserWindow);
  
  if (electron.app) {
    console.log('App name:', electron.app.getName());
  }
} catch (error) {
  console.error('Error loading Electron:', error.message);
  console.error('Stack:', error.stack);
}