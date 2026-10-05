// One-off VAPID keypair generator + verifier (W3-D-7 / migration 115).
// Run: node scripts/vapidVerify.cjs
// Prints PUBLIC (safe for business_settings.push_config) and PRIVATE (Edge
// Function secret only) and proves the pair signs/verifies before use.
const crypto = require('crypto')

// VAPID keys are base64url WITHOUT '=' padding — both the spec and the web-push
// implementation reject a padded key ("must be a URL safe Base 64 (without
// '=')"). The 65-byte public point therefore encodes to 87 significant chars.
function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pubJwk = publicKey.export({ format: 'jwk' })
const privJwk = privateKey.export({ format: 'jwk' })

// Uncompressed P-256 point: 0x04 || X(32) || Y(32), prefixed with 'B' (VAPID).
const pubRaw = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pubJwk.x, 'base64url'),
  Buffer.from(pubJwk.y, 'base64url'),
])
const VAPID_PUBLIC_KEY = 'B' + b64u(pubRaw)
const VAPID_PRIVATE_KEY = b64u(Buffer.from(privJwk.d, 'base64url'))

// Verify the pair really belongs together before printing anything.
// Signature check uses the generated key objects (the authoritative source);
// the browser string is checked by byte-identical coordinate comparison against
// the same source, which is exactly what the browser will decode.
// Strip ONLY the leading 'B' VAPID marker. `replace` is required over `slice(1)`
// so no base64 character is accidentally consumed along with the marker.
const decoded = Buffer.from(VAPID_PUBLIC_KEY.replace(/^B/, ''), 'base64url')
const samePoint =
  decoded.length === 65 &&
  decoded[0] === 0x04 &&
  decoded.subarray(1, 33).toString('base64url') === pubJwk.x &&
  decoded.subarray(33, 65).toString('base64url') === pubJwk.y

const probe = Buffer.from('bmb-vapid-verify')
const sig = crypto.sign('sha256', probe, { key: privateKey, dsaEncoding: 'ieee-p1363' })
const ok = crypto.verify('sha256', probe, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sig)

// The private scalar must also be exactly 32 bytes and must NOT equal the
// public x/y coordinates (a truncated export would otherwise silently pass).
const privRaw = Buffer.from(VAPID_PRIVATE_KEY, 'base64url')
const privIsDistinct =
  privRaw.length === 32 &&
  privRaw.toString('base64url') !== pubJwk.x &&
  privRaw.toString('base64url') !== pubJwk.y

console.log('SIGN_VERIFY_MATCH =', ok)
console.log('PUBLIC_ROUNDTRIP  =', samePoint)
console.log('PRIV_IS_DISTINCT =', privIsDistinct)
console.log('PUB_DECODED_LEN   =', decoded.length)
console.log('PRIV_DECODED_LEN  =', privRaw.length)
// web-push (and the VAPID spec) reject a padded key — assert it up front so a
// padded pair can never reach the Edge Function again.
console.log('PUB_UNPADDED     =', !VAPID_PUBLIC_KEY.includes('='))
console.log('PRIV_UNPADDED     =', !VAPID_PRIVATE_KEY.includes('='))
console.log('PUB_TOTAL_LEN     =', VAPID_PUBLIC_KEY.length)
console.log('PUBLIC  =', VAPID_PUBLIC_KEY)
console.log('PRIVATE =', VAPID_PRIVATE_KEY)
if (!ok || !samePoint || !privIsDistinct || VAPID_PUBLIC_KEY.includes('=') || VAPID_PRIVATE_KEY.includes('=')) {
  console.error('KEYPAIR INVALID — do not configure')
  process.exit(1)
}