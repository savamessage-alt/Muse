const crypto = require('crypto');
const numeric = '153570351';
const timestamp = Math.floor(Date.now() / 1000);
const key = 'p93jhgh689SBReK6ghtw62';
const message = numeric + timestamp;

const hmac = crypto.createHmac('sha256', key);
hmac.update(message);
const signature = hmac.digest();

// Convert to base64url
const base64url = signature.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log('timestamp:', timestamp);
console.log('sign:', base64url);
console.log('url:', '/api/tracks/' + numeric + '/lyrics?format=TEXT&timeStamp=' + timestamp + '&sign=' + base64url);