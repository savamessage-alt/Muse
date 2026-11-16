const crypto = require('crypto');

// Exact copy of sign.ts
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

function base64url(bytes, stripPadding = false) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  let b64 = Buffer.from(bin, 'binary').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (stripPadding) b64 = b64.replace(/=+$/, '');
  return b64;
}

const numeric = '42360427';
const timestamp = 1794750881; // Same as browser
const key = 'p93jhgh689SBReK6ghtw62';
const message = numeric + timestamp;

const digest = hmacSha256(key, message);
const sign = base64url(digest, false);
console.log('Node sign:     ', sign);
console.log('Browser sign:  T4I7-9jiZahTVGEI6OALxORf6q2UCHmGJqQuCw1mQEY=');
console.log('Match:', sign === 'T4I7-9jiZahTVGEI6OALxORf6q2UCHmGJqQuCw1mQEY=');