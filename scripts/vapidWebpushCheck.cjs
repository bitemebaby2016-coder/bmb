// Proves the keypair against the REAL web-push implementation (not just Node's
// Buffer). Edge-runtime 500/503 errors point at web-push's own validator, so the
// acceptance test must be web-push's validator too.
//   node scripts/vapidWebpushCheck.cjs
const crypto = require('crypto')

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pubJwk = publicKey.export({ format: 'jwk' })
const privJwk = privateKey.export({ format: 'jwk' })

const pubRaw = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pubJwk.x, 'base64url'),
  Buffer.from(pubJwk.y, 'base64url'),
])
// web-push's urlsafe-base64-helper validates with /^[A-Za-z0-9\-_]+$/ — so the
// server-side key MUST be the bare base64url body. The 'B' marker is only part
// of the browser-facing ApplicationServerKey convention and web-push rejects it.
const PUBLIC_KEY = b64u(pubRaw)
const PUBLIC_KEY_BROWSER = 'B' + PUBLIC_KEY
const PRIVATE_KEY = b64u(Buffer.from(privJwk.d, 'base64url'))

async function main() {
  let webpush
  try {
    webpush = require('web-push')
  } catch {
    console.log('SKIP: web-push is not installed locally (Edge runtime only).')
    console.log('PUBLIC  =', PUBLIC_KEY)
    console.log('PRIVATE =', PRIVATE_KEY)
    return
  }

  try {
    // The real acceptance gate: web-push must ACCEPT the pair and be able to
    // actually sign a JWT with it. (getVapidHeaders is deliberately not used
    // here — it additionally requires a live audience endpoint.)
    webpush.setVapidDetails('mailto:admin@biteme-baby.com', PUBLIC_KEY, PRIVATE_KEY)
    // Signature order is (subscription, payload, options) — passing a request
// object first throws "You must pass in a subscription with at least an endpoint".
// web-push validates the SUBSCRIPTION keys too (p256dh must be a real point on
// the P-256 curve), so reuse a genuinely generated keypair for the dummy
// subscription. The assertion is on the VAPID Authorization header, not delivery.
    const subKeys = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const subPub = subKeys.publicKey.export({ format: 'jwk' })
    const details = webpush.generateRequestDetails(
      {
        endpoint: 'https://push.example.test/subscription',
        keys: {
          p256dh: b64u(Buffer.concat([
            Buffer.from([0x04]),
            Buffer.from(subPub.x, 'base64url'),
            Buffer.from(subPub.y, 'base64url'),
          ])),
          auth: b64u(crypto.randomBytes(16)),
        },
      },
      Buffer.from(JSON.stringify({ hello: 'world' })),
      { TTL: 3600, urgency: 'high' },
    )
    console.log('WEBPUSH_ACCEPT = true')
    console.log('VAPID_AUTHORIZATION_SIGNED =', !!(details.headers && details.headers.Authorization))
  } catch (e) {
    console.log('WEBPUSH_ACCEPT = false')
    console.log('REASON:', e.message)
    process.exitCode = 1
  }
  console.log('PUBLIC  =', PUBLIC_KEY)
  console.log('PUBLIC_BROWSER (with B marker) =', PUBLIC_KEY_BROWSER)
  console.log('PRIVATE =', PRIVATE_KEY)
}

main()