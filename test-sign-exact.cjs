const crypto = require('crypto');

// Exact copy of sign.ts implementation
function base64url(bytes, stripPadding = false) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  let b64 = Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (stripPadding) b64 = b64.replace(/=+$/, '');
  return b64;
}

function hmacSha256(key, message) {
  const blockSize = 64;
  let keyBytes = Buffer.from(key, 'utf8');
  if (keyBytes.length > blockSize) {
    keyBytes = crypto.createHash('sha256').update(keyBytes).digest();
  }
  const keyFull = Buffer.alloc(blockSize);
  keyBytes.copy(keyFull);
  const oKey = Buffer.alloc(blockSize);
  const iKey = Buffer.alloc(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = keyFull[i] ^ 0x5c;
    iKey[i] = keyFull[i] ^ 0x36;
  }
  const inner = Buffer.concat([iKey, Buffer.from(message, 'utf8')]);
  const innerHash = crypto.createHash('sha256').update(inner).digest();
  const outer = Buffer.concat([oKey, innerHash]);
  return crypto.createHash('sha256').update(outer).digest();
}

function signRequest(trackId) {
  const numeric = String(trackId).split(':')[0];
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = hmacSha256('p93jhgh689SBReK6ghtw62', numeric + timestamp);
  return { timestamp, value: base64url(digest) };
}

const numeric = '153570351';
const sign = signRequest(numeric);
console.log('timestamp:', sign.timestamp);
console.log('sign:', sign.value);
console.log('url:', '/api/tracks/' + numeric + '/lyrics?format=TEXT&timeStamp=' + sign.timestamp + '&sign=' + sign.value);

// Also test with native crypto hmac
const hmac = crypto.createHmac('sha256', 'p93jhgh689SBReK6ghtw62');
hmac.update(numeric + sign.timestamp);
const sig2 = hmac.digest();
const b64url2 = sig2.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log('--- native crypto ---');
console.log('timestamp:', sign.timestamp);
console.log('sign:', b64url2);
console.log('url:', '/api/tracks/' + numeric + '/lyrics?format=TEXT&timeStamp=' + sign.timestamp + '&sign=' + b64url2);