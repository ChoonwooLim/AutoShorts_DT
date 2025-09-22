// Electron launcher with CommonJS
const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Launch Electron
const electron = require('electron');
const args = [path.join(__dirname, 'electron', 'main.js')];

console.log('Starting Electron app...');
spawn(electron, args, {
  stdio: 'inherit',
  env: process.env
}).on('close', (code) => {
  process.exit(code);
});