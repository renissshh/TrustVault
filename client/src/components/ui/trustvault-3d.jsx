import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * TrustVault 3D — the document journey as one machine you can spin.
 *
 * A specimen document rides a ring conveyor through six stations: the three-step
 * sign-in gate, Upload (type read from bytes, SHA-256 taken), the AES-256-GCM Vault,
 * automatic Checks, the human Verifier and the QR Proof kiosk. In the middle stands the
 * Ledger: blocks chained by SHA-256 hashes. "Tamper test" edits one block and the chain
 * visibly breaks from that point up, then heals.
 *
 * Modes: Assembled, X-ray, Exploded, One document. Cameras: Overview, Side, Top,
 * Station, Orbit. Hover a station for a tooltip, click it to fly to it.
 * Procedural three.js only: no models, no images. All documents are specimens.
 *
 * Fills its box: give it a height (default '100vh'). Dependencies: react, three.
 * embed: for a landing-page hero. The wheel and a vertical swipe scroll the page (a sideways drag
 * still turns the machine), the decorative panels are hidden but the mode bar, the journey and
 * the chain status stay, and on frames wider than 900 px the machine sits on the right and
 * leaves the left side free for a headline.
 * Control it from code with window.__trustvault:
 *   setMode('assembled' | 'xray' | 'exploded' | 'document')
 *   setCamera('overview' | 'side' | 'top' | 'station' | 'orbit')
 *   focusStation('gate' | 'upload' | 'vault' | 'checks' | 'verifier' | 'ledger' | 'proof')
 *   tamper(), play(), pause()
 *
 * @param {{
 *   height?: number | string,
 *   className?: string,
 *   embed?: boolean,
 *   onStation?: (id: string) => void,
 *   onReady?: () => void,
 * }} props
 */
export default function TrustVault3D({
  height = '100vh',
  className,
  embed = false,
  onStation,
  onReady,
}) {
  const rootRef = useRef(null)
  const handlers = useRef({ onStation, onReady })
  useEffect(() => {
    handlers.current = { onStation, onReady }
  }, [onStation, onReady])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let dispose
    let cancelled = false
    // Text on the in-scene screens is painted on canvases, so wait for the web fonts.
    document.fonts.ready.then(() => {
      if (cancelled) return
      dispose = createVaultScene(root, {
        embedded: embed,
        onStation: (id) => handlers.current.onStation?.(id),
        onReady: () => handlers.current.onReady?.(),
      })
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [embed])

  return (
    <div
      ref={rootRef}
      className={['tv3d', embed && 'tv3d-embed', className].filter(Boolean).join(' ')}
      style={{ height }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        data-tv="scene"
        className="tv-scene"
        role="img"
        aria-label="Interactive 3D model of TrustVault: a document passes a three-step sign-in gate, upload, the encrypted vault, automatic checks, a human verifier and a QR proof kiosk, around a ledger of hash-chained blocks. Drag to rotate, scroll or pinch to zoom, hover or tap a station for details."
      />
      <div className="tv-vignette" />

      <header className="tv-top">
        <div className="tv-id">
          <div className="tv-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.6 13.2 3.5v4.1c0 3.2-2.2 5.6-5.2 6.8-3-1.2-5.2-3.6-5.2-6.8V3.5L8 1.6Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="m5.6 8.1 1.7 1.7 3.2-3.4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <strong>TrustVault</strong>
            <small>Interactive vault</small>
          </div>
        </div>
        <div className="tv-status" data-tv="status">
          <i />
          <span data-tv="status-text">Chain intact</span>
          <span data-tv="status-meta">BLOCK #0006</span>
        </div>
      </header>

      <div className="tv-heading">
        From upload to proof <span className="tv-index">7 STATIONS / 1 CHAIN</span>
      </div>
      <div className="tv-side">SPECIMEN DATA ONLY — NO REAL DOCUMENTS</div>

      <div data-tv="journey" className="tv-journey">
        <div className="tv-journey-icon">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 1.8h5.5L12.5 5v9.2H4V1.8Zm5.3 0V5h3.2M6.2 8.2h4M6.2 10.8h4"
              stroke="currentColor"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <strong data-tv="journey-title">Signing in</strong>
          <small data-tv="journey-detail">Gate · password, email code, Authenticator</small>
        </div>
        <div className="tv-track">
          <i data-tv="journey-bar" />
        </div>
      </div>

      <div data-tv="labels" className="tv-labels" />
      <div data-tv="tip" className="tv-tip" role="tooltip">
        <strong />
        <p />
      </div>

      <div className="tv-controls">
        <nav className="tv-modes" aria-label="View mode">
          <button type="button" data-mode="assembled" aria-pressed="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.6 14 5v6l-6 3.4L2 11V5l6-3.4ZM2 5l6 3.4L14 5M8 8.4v6"
                stroke="currentColor"
                strokeLinejoin="round"
              />
            </svg>
            Assembled
          </button>
          <button type="button" data-mode="xray" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeDasharray="2 1.6" />
              <path d="M5.5 8h5M8 5.5v5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            X-ray
          </button>
          <button type="button" data-mode="exploded" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z"
                stroke="currentColor"
                strokeLinejoin="round"
              />
            </svg>
            Exploded
          </button>
          <button type="button" data-mode="document" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M5 2.5 13 8l-8 5.5v-11Z" stroke="currentColor" strokeLinejoin="round" />
            </svg>
            One document
          </button>
        </nav>
        <nav className="tv-cams" aria-label="Camera">
          <span className="tv-caption">VIEW</span>
          <button type="button" data-camera="overview" aria-pressed="true">
            Overview
          </button>
          <button type="button" data-camera="side" aria-pressed="false">
            Side
          </button>
          <button type="button" data-camera="top" aria-pressed="false">
            Top
          </button>
          <button type="button" data-camera="station" aria-pressed="false">
            Station
          </button>
          <button type="button" data-camera="orbit" aria-pressed="false">
            Orbit
          </button>
          <span className="tv-divider" />
          <button type="button" data-tv="tamper" className="tv-tamper">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M6.2 9.8 4.6 11.4a2.3 2.3 0 0 1-3.2-3.2L3 6.6m6.8 2.8 1.6-1.6a2.3 2.3 0 0 0-3.2-3.2L6.6 6.2M10 1.5l-.6 2M14.5 6l-2 .6M6 14.5l.6-2M1.5 10l2-.6"
                stroke="currentColor"
                strokeLinecap="round"
              />
            </svg>
            Tamper test
          </button>
          <button type="button" data-tv="play" className="tv-play" aria-label="Pause the animation" aria-pressed="false">
            <svg className="tv-icon-pause" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="2.6" height="10" rx=".6" />
              <rect x="7.4" y="1" width="2.6" height="10" rx=".6" />
            </svg>
            <svg className="tv-icon-play" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.2 10.6 6 3 10.8V1.2Z" />
            </svg>
          </button>
        </nav>
      </div>

      <footer className="tv-foot">
        <a className="tv-wordmark" href="https://trustvault-5lgg.onrender.com" target="_blank" rel="noopener noreferrer">
          TrustVault · <span>proof anyone can check</span>
        </a>
        <span className="tv-foot-mid">AES-256-GCM · SHA-256 CHAIN · QR PROOF</span>
        <span className="tv-hint">
          <svg width="12" height="15" viewBox="0 0 13 16" fill="none">
            <rect x="2" y="1" width="9" height="14" rx="4.5" stroke="currentColor" />
            <path d="M6.5 4v3" stroke="currentColor" strokeLinecap="round" />
          </svg>
          Drag to rotate · scroll to zoom
        </span>
      </footer>

      <div data-tv="loading" className="tv-loading">
        <i />
        <span>Opening the vault</span>
      </div>
      <div data-tv="error" className="tv-error" role="alert">
        <strong>Could not start the 3D scene</strong>
        <p>Turn on WebGL (hardware acceleration) in your browser settings and reload.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The scene. Everything below is plain three.js; React only mounts and disposes it.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const COLORS = {
  accent: 0x19e6ff, // TrustVault --primary (dark theme)
  ok: 0x39ff9c, // --success
  alert: 0xff4d6d, // --destructive
  violet: 0xb56bff,
}
const CSS = { accent: '#19e6ff', ok: '#39ff9c', alert: '#ff4d6d', ink: '#e9ecf4', dim: '#7d8599' }
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

// Ring conveyor: an ellipse on the plate. Stations sit just outside it.
const RX = 3.7
const RZ = 2.2
const BELT_TOP = 0.81
const CYCLE = 30 // seconds for one document to travel the whole route
const DOCS = 6
const ROUTE_START = 140 // degrees: documents appear just before the gate...
const ROUTE_SPAN = 256 // ...and leave just after the proof kiosk (140 + 256 = 396 = 36)

const MODES = ['assembled', 'xray', 'exploded', 'document']
const CAMERAS = ['overview', 'side', 'top', 'station', 'orbit']

// theta: place on the ring (degrees); grow: distance outside the belt; face: the point the station
// turns toward; cam: direction the Station camera looks from; short: the callout line in Exploded mode.
/** @type {Array<{id:string,name:string,num:string,short:string,theta?:number,grow?:number,face?:[number,number],cam?:[number,number,number],desc:string}>} */
const STATION_DEFS = [
  {
    id: 'gate',
    name: 'Sign-in gate',
    num: '01',
    short: 'Password · email code · TOTP',
    theta: 150,
    grow: 0,
    cam: [0.55, 0.75, 1],
    desc: 'Three steps before anything opens: password, a 6-digit email code, then Google Authenticator (TOTP).',
  },
  {
    id: 'upload',
    name: 'Upload',
    num: '02',
    short: 'Type from bytes · SHA-256',
    theta: 198,
    grow: 1.3,
    face: [-3, 8],
    cam: [-0.35, 0.95, 1],
    desc: 'The real file type is read from its bytes, not its name, and a SHA-256 fingerprint is taken.',
  },
  {
    id: 'vault',
    name: 'Vault',
    num: '03',
    short: 'AES-256-GCM · 3 sections',
    theta: 246,
    grow: 1.35,
    cam: [0.1, 1.05, 1],
    desc: 'Encrypted with AES-256-GCM before it is stored, and filed under Identity, Academic or Other.',
  },
  {
    id: 'checks',
    name: 'Checks',
    num: '04',
    short: 'PAN · Verhoeff · OCR · score',
    theta: 294,
    grow: 1.35,
    cam: [0.3, 1.05, 1],
    desc: 'PAN format, Aadhaar Verhoeff checksum, driving licence checks and OCR give a score out of 100. An originality check looks for edits.',
  },
  {
    id: 'verifier',
    name: 'Verifier',
    num: '05',
    short: 'A person approves or rejects',
    theta: 342,
    grow: 1.3,
    face: [14, 6],
    cam: [0.8, 0.85, 0.6],
    desc: 'A human verifier reads the report and approves or rejects. A rejection reason is emailed to the student.',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    num: '06',
    short: 'SHA-256 hash chain',
    cam: [0.53, 0.58, 1],
    desc: 'Uploads, approvals and rejections are chained by SHA-256 hashes. Change one record and the chain breaks.',
  },
  {
    id: 'proof',
    name: 'QR proof',
    num: '07',
    short: 'Public QR · no login',
    theta: 30,
    grow: 1.3,
    face: [6, 12],
    cam: [0.35, 0.6, 1],
    desc: 'Verified documents get a QR code. Scanning it opens a public "Verified" page, no login needed.',
  },
]

const JOURNEY = [
  ['Signing in', 'Gate · password, email code, Authenticator'],
  ['Uploading', 'Upload · type read from bytes, SHA-256 taken'],
  ['Encrypting', 'Vault · AES-256-GCM, filed by section'],
  ['Checking', 'Checks · PAN, Verhoeff, licence, OCR, originality'],
  ['Verifying', 'Verifier · a person approves or rejects'],
  ['Proof issued', 'QR proof · anyone can scan it, no login'],
]

// Small deterministic random source, so hashes and the decorative QR look the same on every load.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hexString(seed, length) {
  const r = seeded(seed)
  let s = ''
  for (let i = 0; i < length; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]
  return s
}
const pad4 = (n) => String(n).padStart(4, '0')
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (x) => {
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
function wrapDeg(d) {
  return ((d % 360) + 360) % 360
}

function createVaultScene(root, options) {
  const cleanups = []
  const $ = (name) => {
    const el = root.querySelector(`[data-tv="${name}"]`)
    if (!el) throw new Error(`TrustVault3D: missing [data-tv="${name}"]`)
    return el
  }
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts)
    cleanups.push(() => target.removeEventListener(type, fn, opts))
  }
  const showError = (message) => {
    $('loading').classList.add('done')
    $('error').style.display = 'block'
    if (message) $('error').querySelector('p').textContent = message
  }
  const dispose = () => {
    for (const fn of cleanups.splice(0).reverse()) {
      try {
        fn()
      } catch {
        /* keep disposing */
      }
    }
  }

  try {
    const embedded = options.embedded
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SANS = getComputedStyle(root).fontFamily || 'system-ui, sans-serif'
    const frameW = () => root.clientWidth
    const frameH = () => root.clientHeight

    // ---------- renderer, camera, light ----------
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, Math.max(1, frameW()) / Math.max(1, frameH()), 0.1, 160)
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch (e) {
      showError('WebGL is not available. Turn on hardware acceleration in your browser settings and reload the page.')
      throw e
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, frameW() < 900 ? 1.5 : 1.75))
    renderer.setSize(Math.max(1, frameW()), Math.max(1, frameH()))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.localClippingEnabled = true
    $('scene').appendChild(renderer.domElement)
    cleanups.push(() => renderer.domElement.remove())

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 6
    controls.maxDistance = 60
    controls.minPolarAngle = 0.1
    controls.maxPolarAngle = Math.PI * 0.47
    controls.rotateSpeed = 0.5
    controls.zoomSpeed = 0.7
    if (embedded) {
      // In a landing page the wheel and a vertical swipe scroll the page; a sideways drag still turns the machine.
      controls.enableZoom = false
      renderer.domElement.style.touchAction = 'pan-y pinch-zoom'
    }

    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const envRT = pmrem.fromScene(room, 0.04)
    scene.environment = envRT.texture
    scene.environmentIntensity = 0.5
    room.dispose()
    pmrem.dispose()

    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x15121e, 1.6))
    const sun = new THREE.DirectionalLight(0xf2f6ff, 3.6)
    sun.position.set(-5, 13, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 0.5, far: 40 })
    sun.shadow.normalBias = 0.03
    sun.shadow.bias = -0.0002
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x9fdcff, 2.4)
    rim.position.set(6, 6, -9)
    scene.add(rim)
    const cyanFill = new THREE.PointLight(COLORS.accent, 16, 14, 2)
    cyanFill.position.set(0, 4.5, 0)
    scene.add(cyanFill)
    const violetFill = new THREE.PointLight(COLORS.violet, 10, 16, 2)
    violetFill.position.set(-6, 3, 4)
    scene.add(violetFill)

    // ---------- materials and helpers ----------
    const std = (color, metalness = 0.2, roughness = 0.45, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })
    const glow = (color, intensity = 1.4) =>
      std(color, 0.1, 0.3, { emissive: color, emissiveIntensity: intensity })
    const M = {
      plate: std(0x12151d, 0.8, 0.34),
      plateTop: std(0x1a1e29, 0.7, 0.3),
      edge: std(0x5b6578, 0.85, 0.24),
      body: std(0x1d2230, 0.7, 0.3),
      porcelain: std(0xdfe3ec, 0.35, 0.28),
      chrome: std(0xc6cfdb, 0.95, 0.15),
      dark: std(0x0a0c12, 0.4, 0.42),
      rubber: std(0x06070a, 0.1, 0.65),
      glass: std(0x9fc3d6, 0.3, 0.06, { transparent: true, opacity: 0.18, depthWrite: false }),
      accent: glow(COLORS.accent, 1.6),
      accentSoft: glow(COLORS.accent, 0.55),
      ok: glow(COLORS.ok, 1.4),
      alert: glow(COLORS.alert, 1.6),
      violet: glow(COLORS.violet, 0.9),
      paper: std(0xf1f3f8, 0, 0.85),
    }

    const geometries = new Map()
    const roundBox = (w, h, d, r = 0.04) => {
      const key = `b${w},${h},${d},${r}`
      if (!geometries.has(key)) {
        const rr = Math.min(r, w / 3, h / 3, d / 3)
        geometries.set(key, rr > 0.001 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d))
      }
      return geometries.get(key)
    }
    const add = (parent, mesh, x, y, z, cast = true) => {
      mesh.position.set(x, y, z)
      mesh.castShadow = cast
      mesh.receiveShadow = true
      parent.add(mesh)
      return mesh
    }
    const box = (parent, w, h, d, x, y, z, mat = M.body, r = 0.04) =>
      add(parent, new THREE.Mesh(roundBox(w, h, d, r), mat), x, y, z)
    const cyl = (parent, r, h, x, y, z, mat = M.chrome, r2 = r, seg = 28) => {
      const key = `c${r},${r2},${h},${seg}`
      if (!geometries.has(key)) geometries.set(key, new THREE.CylinderGeometry(r, r2, h, seg))
      return add(parent, new THREE.Mesh(geometries.get(key), mat), x, y, z)
    }
    const torus = (parent, r, tube, x, y, z, mat = M.chrome) => {
      const key = `t${r},${tube}`
      if (!geometries.has(key)) geometries.set(key, new THREE.TorusGeometry(r, tube, 10, 28))
      return add(parent, new THREE.Mesh(geometries.get(key), mat), x, y, z)
    }
    const sphere = (parent, r, mat) => {
      const key = `s${r}`
      if (!geometries.has(key)) geometries.set(key, new THREE.SphereGeometry(r, 14, 10))
      const m = new THREE.Mesh(geometries.get(key), mat)
      parent.add(m)
      return m
    }

    const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    function canvasTexture(w, h, draw) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = maxAniso
      const painted = { canvas, ctx, texture, w, h }
      painted.redraw = (fn = draw) => {
        if (!fn) return
        ctx.clearRect(0, 0, w, h)
        fn(ctx, w, h)
        texture.needsUpdate = true
      }
      painted.redraw()
      return painted
    }
    function text(ctx, s, x, y, size = 20, color = CSS.ink, weight = 500, family = SANS, align = 'left') {
      ctx.fillStyle = color
      ctx.font = `${weight} ${size}px ${family}`
      ctx.textAlign = align
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(s, x, y)
    }
    function rrect(ctx, x, y, w, h, r, fill) {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, r)
      ctx.fill()
    }
    function tick(ctx, x, y, s, color) {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, s / 6)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + s * 0.35, y + s * 0.35)
      ctx.lineTo(x + s, y - s * 0.4)
      ctx.stroke()
    }
    // A flat screen showing a canvas texture. Faces +z unless flipped.
    function screen(parent, w, h, x, y, z, painted, flip = false) {
      const mat = new THREE.MeshBasicMaterial({ map: painted.texture, toneMapped: false, transparent: true })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      m.position.set(x, y, z)
      if (flip) m.rotation.y = Math.PI
      parent.add(m)
      return m
    }

    // Shell materials fade to glass in X-ray mode, with a blueprint outline.
    const shellMaterials = []
    const outlineMaterial = new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0 })
    function shell(base) {
      const m = base.clone()
      m.transparent = true
      shellMaterials.push(m)
      return m
    }
    const S = { porcelain: shell(M.porcelain), body: shell(M.body) }
    function outline(mesh) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), outlineMaterial)
      lines.position.copy(mesh.position)
      lines.rotation.copy(mesh.rotation)
      lines.scale.copy(mesh.scale)
      lines.raycast = () => {}
      mesh.parent.add(lines)
      return lines
    }
    const shellBox = (parent, w, h, d, x, y, z, mat = S.porcelain, r = 0.08) => {
      const m = box(parent, w, h, d, x, y, z, mat, r)
      outline(m)
      return m
    }

    // ---------- the plate ----------
    const machine = new THREE.Group()
    scene.add(machine)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.28 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.42
    floor.receiveShadow = true
    scene.add(floor)
    const halo = canvasTexture(256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(25,230,255,0.16)')
      g.addColorStop(0.45, 'rgba(25,230,255,0.05)')
      g.addColorStop(1, 'rgba(25,230,255,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    })
    const haloMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      new THREE.MeshBasicMaterial({ map: halo.texture, transparent: true, depthWrite: false, toneMapped: false })
    )
    haloMesh.rotation.x = -Math.PI / 2
    haloMesh.position.y = -0.41
    scene.add(haloMesh)

    box(machine, 13.4, 0.4, 9, 0, -0.08, 0, M.plate, 0.2)
    box(machine, 13.2, 0.05, 8.8, 0, 0.14, 0, M.edge, 0.12)
    box(machine, 13.05, 0.1, 8.66, 0, 0.21, 0, M.plateTop, 0.1)
    box(machine, 12.2, 0.024, 0.03, 0, -0.16, 4.505, M.accent, 0.01)
    for (const x of [-6, 6])
      for (const z of [-3.8, 3.8]) {
        cyl(machine, 0.36, 0.24, x, -0.3, z, M.rubber)
        cyl(machine, 0.12, 0.03, x, 0.275, z, M.chrome, 0.12, 16)
      }
    // Fine engraved grid on the plate top: a technical drawing under the machine.
    {
      const pts = []
      for (let x = -6.25; x <= 6.26; x += 0.5) pts.push(new THREE.Vector3(x, 0.262, -4.15), new THREE.Vector3(x, 0.262, 4.15))
      for (let z = -4; z <= 4.01; z += 0.5) pts.push(new THREE.Vector3(-6.3, 0.262, z), new THREE.Vector3(6.3, 0.262, z))
      const grid = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x2c3446, transparent: true, opacity: 0.55 })
      )
      grid.raycast = () => {}
      machine.add(grid)
    }
    const engraving = canvasTexture(1536, 150, (c, w, h) => {
      c.fillStyle = '#141824'
      c.fillRect(0, 0, w, h)
      c.strokeStyle = '#323a4d'
      c.lineWidth = 2
      c.strokeRect(2, 2, w - 4, h - 4)
      text(c, 'TRUSTVAULT', 44, 72, 42, '#e3e7f0', 700)
      text(c, 'encrypted vault  ·  three-step sign-in  ·  QR proof anyone can check', 330, 70, 30, '#a7afc2', 450)
      text(c, 'DOCUMENT VERIFICATION    /    SPECIMEN DATA ONLY', 46, 118, 18, '#5f6a80', 500, MONO)
      text(c, 'No. 001', 1490, 118, 20, CSS.accent, 500, MONO, 'right')
    })
    const plaque = screen(machine, 6.6, 0.645, 0, 0.267, 3.95, engraving)
    plaque.rotation.x = -Math.PI / 2

    // ---------- ring conveyor ----------
    const ringPoint = (deg, out = new THREE.Vector3(), grow = 0) =>
      out.set((RX + grow) * Math.cos(deg * DEG), BELT_TOP, (RZ + grow) * Math.sin(deg * DEG))
    const ringTangent = (deg, out = new THREE.Vector3()) =>
      out.set(-RX * Math.sin(deg * DEG), 0, RZ * Math.cos(deg * DEG)).normalize()
    const belt = new THREE.Group()
    machine.add(belt)
    {
      const outer = new THREE.Shape()
      outer.absellipse(0, 0, RX + 0.46, RZ + 0.46, 0, TAU, false, 0)
      const hole = new THREE.Path()
      hole.absellipse(0, 0, RX - 0.46, RZ - 0.46, 0, TAU, true, 0)
      outer.holes.push(hole)
      const bedGeo = new THREE.ExtrudeGeometry(outer, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 120,
      })
      bedGeo.rotateX(-Math.PI / 2)
      const bed = add(belt, new THREE.Mesh(bedGeo, M.dark), 0, 0.6, 0)
      bed.receiveShadow = true
      // Rails on both edges of the bed.
      for (const off of [-0.44, 0.44]) {
        const pts = []
        for (let i = 0; i < 128; i++) {
          const a = (i / 128) * TAU
          pts.push(new THREE.Vector3((RX + off) * Math.cos(a), 0.86, (RZ + off) * Math.sin(a)))
        }
        const curve = new THREE.CatmullRomCurve3(pts, true)
        add(belt, new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.026, 6, true), M.chrome), 0, 0, 0)
      }
      // Light strip on the inner edge: the conveyor's "power on" line.
      {
        const pts = []
        for (let i = 0; i < 128; i++) {
          const a = (i / 128) * TAU
          pts.push(new THREE.Vector3((RX - 0.49) * Math.cos(a), 0.66, (RZ - 0.49) * Math.sin(a)))
        }
        add(belt, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.012, 5, true), M.accentSoft), 0, 0, 0, false)
      }
      for (let i = 0; i < 18; i++) {
        const p = ringPoint((i / 18) * 360 + 10)
        cyl(belt, 0.05, 0.36, p.x, 0.44, p.z, M.chrome)
      }
    }
    const SLATS = 132
    const slats = new THREE.InstancedMesh(roundBox(0.11, 0.045, 0.78, 0.012), M.body, SLATS)
    slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    slats.receiveShadow = true
    belt.add(slats)
    const dummy = new THREE.Object3D()
    const tmpV = new THREE.Vector3()
    const tmpT = new THREE.Vector3()
    function updateSlats(t) {
      for (let i = 0; i < SLATS; i++) {
        const deg = wrapDeg((i / SLATS) * 360 + t * (ROUTE_SPAN / CYCLE))
        ringPoint(deg, tmpV)
        ringTangent(deg, tmpT)
        dummy.position.set(tmpV.x, BELT_TOP - 0.03, tmpV.z)
        dummy.rotation.set(0, -Math.atan2(tmpT.z, tmpT.x), 0)
        dummy.updateMatrix()
        slats.setMatrixAt(i, dummy.matrix)
      }
      slats.instanceMatrix.needsUpdate = true
    }
    updateSlats(0)

    // ---------- stations ----------
    const stations = []
    const labelsEl = $('labels')
    function makeStation(def) {
      const group = new THREE.Group()
      machine.add(group)
      let base
      if (def.id === 'ledger') base = new THREE.Vector3(0, 0, 0)
      else base = ringPoint(def.theta, new THREE.Vector3(), def.grow).setY(0)
      group.position.copy(base)
      if (def.id === 'gate') {
        // Local x across the belt, local z along the direction of travel.
        const n = new THREE.Vector3(Math.cos(def.theta * DEG) / RX, 0, Math.sin(def.theta * DEG) / RZ).normalize()
        group.rotation.y = Math.atan2(-n.z, n.x)
      } else if (def.id !== 'ledger') {
        const [fx, fz] = def.face ?? [1.5, 6]
        group.rotation.y = Math.atan2(fx - base.x, fz - base.z)
      }
      const led = M.accent.clone()
      led.emissiveIntensity = 0.6
      const label = document.createElement('div')
      label.className = 'tv-label'
      label.innerHTML = `<div class="tv-stem"></div><div class="tv-card"><div class="tv-card-title"><span>${def.num}</span>${def.name}</div><div class="tv-card-meta">${def.short}</div></div>`
      labelsEl.appendChild(label)
      cleanups.push(() => label.remove())
      const station = { ...def, group, base, led, label, trigger: -99, anchorY: 2.6 }
      stations.push(station)
      return station
    }
    const byId = {}
    for (const def of STATION_DEFS) byId[def.id] = makeStation(def)

    // A station foot: dark pad, LED edge and a number plaque.
    function foot(st, w = 2, d = 1.6) {
      const g = st.group
      box(g, w, 0.12, d, 0, 0.32, 0, M.dark, 0.08)
      box(g, w - 0.08, 0.026, 0.026, 0, 0.32, d / 2 + 0.002, st.led, 0.01)
      box(g, w - 0.04, 0.12, d - 0.04, 0, 0.44, 0, M.body, 0.06)
      const p = canvasTexture(512, 112, (c, w2, h2) => {
        c.fillStyle = '#0d1018'
        c.fillRect(0, 0, w2, h2)
        text(c, st.num, 24, 74, 40, CSS.accent, 600, MONO)
        text(c, st.name.toUpperCase(), 112, 72, 34, '#d5dae6', 600)
      })
      screen(g, Math.min(1.5, w - 0.3), 0.33, 0, 0.44, d / 2 - 0.01, p)
    }

    // 01 · Sign-in gate: an arch over the belt with three lamps.
    const gate = byId.gate
    const gateLamps = []
    {
      const g = gate.group
      for (const x of [-0.66, 0.66]) {
        box(g, 0.26, 0.12, 0.42, x, 0.33, 0, M.dark, 0.04)
        shellBox(g, 0.2, 1.95, 0.3, x, 1.35, 0, S.porcelain, 0.06)
        box(g, 0.025, 1.6, 0.025, x + (x < 0 ? 0.11 : -0.11), 1.35, -0.16, gate.led, 0.01)
      }
      shellBox(g, 1.62, 0.3, 0.36, 0, 2.38, 0, S.body, 0.07)
      const names = ['PASSWORD', 'EMAIL CODE', 'AUTHENTICATOR']
      for (let k = 0; k < 3; k++) {
        const mat = M.accent.clone()
        mat.emissiveIntensity = 0.25
        // Lamp 1 sits on the viewer's left when seen from the approach side (local -z).
        const x = 0.48 - k * 0.48
        box(g, 0.34, 0.13, 0.1, x, 2.62, -0.02, mat, 0.04)
        gateLamps.push(mat)
        const lp = canvasTexture(256, 64, (c, w, h) => {
          text(c, `${k + 1}`, 14, 44, 30, CSS.accent, 600, MONO)
          text(c, names[k], 44, 42, k === 2 ? 21 : 24, '#e3e7f0', 600)
        })
        screen(g, 0.44, 0.11, x, 2.38, -0.185, lp, true)
      }
      // Authenticator code panel on the outer pillar.
      gate.totp = canvasTexture(256, 320, () => {})
      box(g, 0.44, 0.56, 0.06, -0.66, 1.42, -0.2, M.dark, 0.04)
      screen(g, 0.4, 0.5, -0.66, 1.42, -0.235, gate.totp, true)
      gate.anchorY = 3
    }
    function drawTotp(t) {
      const slot = Math.floor(t / 6)
      const left = 1 - (t / 6 - slot)
      gate.totp.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 18, '#0b1220')
        text(c, 'AUTHENTICATOR', w / 2, 52, 21, '#9aa4ba', 600, SANS, 'center')
        const code = String(Math.floor(seeded(slot + 11)() * 1e6)).padStart(6, '0')
        text(c, `${code.slice(0, 3)} ${code.slice(3)}`, w / 2, 150, 54, CSS.accent, 600, MONO, 'center')
        c.strokeStyle = '#1f2a40'
        c.lineWidth = 10
        c.beginPath()
        c.arc(w / 2, 232, 34, 0, TAU)
        c.stroke()
        c.strokeStyle = CSS.accent
        c.beginPath()
        c.arc(w / 2, 232, 34, -Math.PI / 2, -Math.PI / 2 + TAU * left)
        c.stroke()
        text(c, 'DEMO CODE', w / 2, 300, 16, '#5d6780', 500, MONO, 'center')
      })
    }

    // 02 · Upload: a terminal with a hopper; it reads the type from bytes and hashes the file.
    const upload = byId.upload
    let hopperCard
    const uploadGears = []
    {
      const g = upload.group
      foot(upload)
      shellBox(g, 1.5, 0.78, 1.1, 0, 0.89, -0.05, S.porcelain, 0.12)
      // Console face, tilted toward the viewer.
      const consoleG = new THREE.Group()
      consoleG.position.set(0, 1.46, 0.2)
      consoleG.rotation.x = 0.5
      g.add(consoleG)
      box(consoleG, 1.3, 0.06, 0.74, 0, 0, 0, M.dark, 0.03)
      upload.screen = canvasTexture(512, 290, () => {})
      const scr = screen(consoleG, 1.18, 0.668, 0, 0.034, 0, upload.screen)
      scr.rotation.x = -Math.PI / 2
      // Hopper at the back.
      const hopper = cyl(g, 0.28, 0.42, 0.42, 1.48, -0.44, S.body, 0.16, 32)
      outline(hopper)
      cyl(g, 0.29, 0.03, 0.42, 1.7, -0.44, M.accent, 0.29, 32)
      hopperCard = new THREE.Group()
      g.add(hopperCard)
      box(hopperCard, 0.3, 0.4, 0.02, 0, 0, 0, M.paper, 0.015)
      // Inside (visible in X-ray): the hashing gears and a chip.
      for (const [x, r] of [
        [-0.35, 0.2],
        [0.0, 0.15],
      ]) {
        const gg = new THREE.Group()
        gg.position.set(x, 0.78, -0.1)
        g.add(gg)
        cyl(gg, r, 0.07, 0, 0, 0, M.violet)
        cyl(gg, r * 0.35, 0.1, 0, 0, 0, M.chrome)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU
          const tooth = box(gg, r * 0.28, 0.06, r * 0.22, Math.cos(a) * r, 0, Math.sin(a) * r, M.violet, 0.008)
          tooth.rotation.y = -a
        }
        uploadGears.push(gg)
      }
      box(g, 0.36, 0.06, 0.36, 0.42, 0.66, -0.1, M.dark, 0.02)
      box(g, 0.2, 0.02, 0.2, 0.42, 0.7, -0.1, M.accent, 0.01)
      upload.anchorY = 2.3
    }
    function drawUpload(progress, t) {
      const hash = hexString(7, 64)
      const idle = progress < 0
      const pr = Math.max(0, progress)
      upload.screen.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 10, '#0b1220')
        text(c, 'UPLOAD', 24, 40, 22, '#e3e7f0', 700)
        text(c, 'SPECIMEN', w - 24, 40, 15, CSS.accent, 600, MONO, 'right')
        rrect(c, 22, 58, w - 44, 68, 10, '#131c2e')
        rrect(c, 38, 70, 32, 44, 4, idle ? '#3a4560' : '#e3e7f0')
        text(c, idle ? 'Waiting for a file' : 'specimen-id.pdf', 86, 90, 20, idle ? '#7d8599' : '#e3e7f0', 600)
        text(c, idle ? 'Drop a document to begin' : pr > 0.18 ? 'Type: PDF · read from its bytes' : 'Reading the first bytes…', 86, 114, 15, '#8f9ab0', 500)
        rrect(c, 22, 142, w - 44, 8, 4, '#1c2740')
        if (!idle) rrect(c, 22, 142, Math.max(8, (w - 44) * pr), 8, 4, CSS.accent)
        text(c, 'SHA-256', 24, 184, 15, '#8f9ab0', 600, MONO)
        const shown = idle ? 0 : Math.floor(clamp01((pr - 0.25) / 0.7) * 64)
        const cursor = !idle && shown < 64 && Math.floor(t * 4) % 2 === 0 ? '▍' : ''
        text(c, hash.slice(0, Math.min(shown, 32)) + (shown < 32 ? cursor : ''), 24, 214, 17, CSS.accent, 500, MONO)
        text(c, shown > 32 ? hash.slice(32, shown) + cursor : '', 24, 240, 17, CSS.accent, 500, MONO)
        if (pr >= 1) text(c, '✓ fingerprint stored', w - 24, 274, 15, CSS.ok, 600, MONO, 'right')
      })
    }

    // 03 · Vault: a round door with a spoked wheel and locking bolts; three shelves inside.
    const vault = byId.vault
    const bolts = []
    let vaultWheel, vaultDial
    {
      const g = vault.group
      foot(vault, 2.2, 1.7)
      shellBox(g, 2.0, 1.74, 1.36, 0, 1.37, -0.06, S.body, 0.14)
      box(g, 2.06, 0.1, 1.42, 0, 2.27, -0.06, M.edge, 0.04)
      const doorG = new THREE.Group()
      doorG.position.set(0, 1.37, 0.63)
      g.add(doorG)
      const door = cyl(doorG, 0.66, 0.12, 0, 0, 0, M.chrome, 0.66, 48)
      door.rotation.x = Math.PI / 2
      const rimT = torus(doorG, 0.7, 0.035, 0, 0, 0.02, M.edge)
      rimT.rotation.set(0, 0, 0)
      const inner = cyl(doorG, 0.5, 0.04, 0, 0, 0.065, M.body, 0.5, 48)
      inner.rotation.x = Math.PI / 2
      // Locking bolts around the rim.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8
        const b = cyl(doorG, 0.045, 0.22, Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.0, M.chrome, 0.045, 12)
        b.rotation.z = a - Math.PI / 2
        b.userData.keep = true
        bolts.push({ mesh: b, a })
      }
      vaultWheel = new THREE.Group()
      vaultWheel.position.set(0, 0, 0.16)
      doorG.add(vaultWheel)
      const hub = cyl(vaultWheel, 0.1, 0.1, 0, 0, 0, M.accent, 0.1, 24)
      hub.rotation.x = Math.PI / 2
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU
        const spoke = cyl(vaultWheel, 0.03, 0.62, Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0, M.chrome, 0.03, 10)
        spoke.rotation.z = a - Math.PI / 2
        const knob = sphere(vaultWheel, 0.055, M.chrome)
        knob.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0)
      }
      const dialTex = canvasTexture(256, 256, (c, w, h) => {
        c.translate(w / 2, h / 2)
        c.fillStyle = '#0d1220'
        c.beginPath()
        c.arc(0, 0, 124, 0, TAU)
        c.fill()
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * TAU
          c.strokeStyle = i % 5 ? '#4a5570' : CSS.accent
          c.lineWidth = i % 5 ? 2 : 4
          c.beginPath()
          c.moveTo(Math.cos(a) * 104, Math.sin(a) * 104)
          c.lineTo(Math.cos(a) * (i % 5 ? 116 : 122), Math.sin(a) * (i % 5 ? 116 : 122))
          c.stroke()
        }
      })
      vaultDial = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 48),
        new THREE.MeshBasicMaterial({ map: dialTex.texture, toneMapped: false })
      )
      vaultDial.position.set(0, 0, 0.09)
      doorG.add(vaultDial)
      // Status screen above the door.
      vault.screen = canvasTexture(512, 112, () => {})
      box(g, 1.3, 0.3, 0.05, 0, 2.48, 0.3, M.dark, 0.03)
      screen(g, 1.24, 0.26, 0, 2.48, 0.33, vault.screen)
      // Inside: three shelves named after TrustVault's sections, each with a stack of sealed files.
      const shelves = ['IDENTITY', 'ACADEMIC', 'OTHER']
      shelves.forEach((name, i) => {
        const y = 0.82 + i * 0.5
        box(g, 1.7, 0.035, 1.0, 0, y, -0.12, M.edge, 0.01)
        for (let j = 0; j < 4 - i; j++) box(g, 0.32, 0.03, 0.42, -0.5 + j * 0.06, y + 0.04 + j * 0.035, -0.2, j % 2 ? M.violet : M.accentSoft, 0.01)
        const lt = canvasTexture(256, 48, (c) => text(c, name, 6, 34, 26, '#cfd6e6', 700, MONO))
        screen(g, 0.6, 0.11, 0.35, y + 0.12, 0.25, lt)
      })
      vault.anchorY = 3.1
    }
    function drawVault(open) {
      vault.screen.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 8, '#0b1220')
        text(c, 'AES-256-GCM', 22, 70, 30, '#e3e7f0', 700, MONO)
        rrect(c, w - 168, 30, 146, 52, 26, open ? '#123b2c' : '#0f2c3a')
        text(c, open ? 'FILING' : 'SEALED', w - 95, 66, 22, open ? CSS.ok : CSS.accent, 700, MONO, 'center')
      })
    }

    // 04 · Checks: a flatbed scanner with a moving light bar and a results screen.
    const checks = byId.checks
    let scanBar
    {
      const g = checks.group
      foot(checks, 2.1, 1.6)
      shellBox(g, 1.8, 0.4, 1.2, 0, 0.7, 0.05, S.porcelain, 0.1)
      box(g, 1.62, 0.02, 1.02, 0, 0.91, 0.05, M.glass, 0.01)
      const docUnder = canvasTexture(256, 352, (c, w, h) => {
        c.fillStyle = '#f1f3f8'
        c.fillRect(0, 0, w, h)
        rrect(c, 20, 26, 80, 96, 6, '#c9cfdb')
        for (let i = 0; i < 7; i++) rrect(c, 118, 34 + i * 16, 110 - (i % 3) * 20, 7, 3, '#b7bfcd')
        text(c, 'SPECIMEN', w / 2, 220, 34, '#c43d5a', 800, SANS, 'center')
        for (let i = 0; i < 5; i++) rrect(c, 20, 256 + i * 16, 210 - (i % 2) * 50, 7, 3, '#cbd1dd')
      })
      const paper = screen(g, 0.62, 0.86, -0.15, 0.905, 0.05, docUnder)
      paper.rotation.x = -Math.PI / 2
      paper.rotation.z = Math.PI / 2
      scanBar = new THREE.Group()
      g.add(scanBar)
      box(scanBar, 0.07, 0.07, 1.1, 0, 0.97, 0.05, M.dark, 0.02)
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 1.02),
        new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false })
      )
      beam.rotation.x = -Math.PI / 2
      beam.position.set(0, 0.925, 0.05)
      scanBar.add(beam)
      // Results screen behind the bed.
      box(g, 0.08, 1.0, 0.08, 0, 1.36, -0.62, M.chrome, 0.02)
      box(g, 1.62, 1.12, 0.08, 0, 1.98, -0.6, M.dark, 0.05)
      checks.screen = canvasTexture(512, 360, () => {})
      screen(g, 1.54, 1.06, 0, 1.98, -0.555, checks.screen)
      // Inside the bed (X-ray): rails and the scanner board.
      box(g, 1.5, 0.03, 0.8, 0, 0.58, 0.05, M.violet, 0.01)
      for (const z of [-0.4, 0.5]) box(g, 1.6, 0.03, 0.03, 0, 0.85, z, M.chrome, 0.01)
      checks.anchorY = 2.9
    }
    const CHECK_ITEMS = ['PAN format', 'Aadhaar Verhoeff checksum', 'Driving licence', 'OCR · number, name, keywords', 'Originality · editing traces']
    function drawChecks(progress) {
      checks.screen.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 10, '#0b1220')
        text(c, 'AUTOMATIC CHECKS', 24, 44, 22, '#e3e7f0', 700)
        text(c, 'SPECIMEN', w - 24, 44, 15, CSS.accent, 600, MONO, 'right')
        CHECK_ITEMS.forEach((item, i) => {
          const y = 86 + i * 46
          const done = progress > (i + 1) / 6
          rrect(c, 22, y - 26, w - 44, 38, 8, done ? '#10261f' : '#121a2b')
          if (done) tick(c, 36, y - 8, 18, CSS.ok)
          else {
            c.strokeStyle = '#3a4560'
            c.lineWidth = 2
            c.beginPath()
            c.arc(45, y - 7, 8, 0, TAU)
            c.stroke()
          }
          text(c, item, 72, y, 18, done ? '#e3e7f0' : '#7d8599', 500)
        })
        text(c, 'SCORE / 100', 24, 334, 15, '#8f9ab0', 600, MONO)
        rrect(c, 150, 323, w - 174, 12, 6, '#1c2740')
        rrect(c, 150, 323, Math.max(12, (w - 174) * clamp01(progress)), 12, 6, progress >= 1 ? CSS.ok : CSS.accent)
      })
    }

    // 05 · Verifier: a desk, a review screen and a stamp press that marks the paper approved.
    const verifier = byId.verifier
    let stampHead, stampApproved, stampPending
    {
      const g = verifier.group
      foot(verifier, 2.1, 1.6)
      shellBox(g, 1.9, 0.08, 1.2, 0, 1.12, 0, S.porcelain, 0.03)
      shellBox(g, 0.62, 0.58, 1.06, -0.58, 0.79, 0, S.body, 0.05)
      for (const x of [0.82]) for (const z of [-0.5, 0.5]) box(g, 0.06, 0.58, 0.06, x, 0.79, z, M.chrome, 0.02)
      // Hanging files inside the pedestal (X-ray).
      for (let i = 0; i < 6; i++) box(g, 0.5, 0.36, 0.02, -0.58, 0.82, -0.36 + i * 0.14, i % 2 ? M.paper : M.accentSoft, 0.005)
      // Monitor.
      box(g, 0.08, 0.5, 0.08, -0.25, 1.42, -0.42, M.chrome, 0.02)
      box(g, 1.25, 0.78, 0.06, -0.25, 1.95, -0.42, M.dark, 0.04)
      verifier.screen = canvasTexture(512, 320, () => {})
      screen(g, 1.18, 0.72, -0.25, 1.95, -0.385, verifier.screen)
      // Stamp press.
      box(g, 0.5, 0.04, 0.4, 0.55, 1.18, 0.2, M.dark, 0.02)
      const pending = canvasTexture(256, 200, (c, w, h) => {
        c.fillStyle = '#f1f3f8'
        c.fillRect(0, 0, w, h)
        for (let i = 0; i < 6; i++) rrect(c, 18, 22 + i * 18, 200 - (i % 3) * 40, 7, 3, '#c3cad8')
        text(c, 'SPECIMEN', 18, 182, 22, '#9aa3b5', 700)
      })
      const approved = canvasTexture(256, 200, (c, w, h) => {
        c.fillStyle = '#f1f3f8'
        c.fillRect(0, 0, w, h)
        for (let i = 0; i < 6; i++) rrect(c, 18, 22 + i * 18, 200 - (i % 3) * 40, 7, 3, '#c3cad8')
        c.save()
        c.translate(w / 2, 120)
        c.rotate(-0.16)
        c.strokeStyle = '#13a86b'
        c.lineWidth = 6
        c.strokeRect(-104, -30, 208, 60)
        text(c, 'APPROVED', 0, 14, 36, '#13a86b', 800, SANS, 'center')
        c.restore()
      })
      stampPending = screen(g, 0.4, 0.31, 0.55, 1.205, 0.2, pending)
      stampPending.rotation.x = -Math.PI / 2
      stampApproved = screen(g, 0.4, 0.31, 0.55, 1.206, 0.2, approved)
      stampApproved.rotation.x = -Math.PI / 2
      stampApproved.visible = false
      box(g, 0.1, 1.0, 0.1, 0.55, 1.66, -0.2, M.chrome, 0.03)
      box(g, 0.14, 0.12, 0.5, 0.55, 2.12, 0.0, M.body, 0.04)
      stampHead = new THREE.Group()
      stampHead.position.set(0.55, 1.75, 0.2)
      g.add(stampHead)
      cyl(stampHead, 0.035, 1.0, 0, 0.45, 0, M.chrome)
      cyl(stampHead, 0.14, 0.12, 0, -0.08, 0, M.ok)
      cyl(stampHead, 0.1, 0.12, 0, 0.04, 0, M.body)
      verifier.anchorY = 2.8
    }
    function drawVerifier(flash) {
      verifier.screen.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 10, '#0b1220')
        text(c, 'REVIEW QUEUE', 24, 44, 22, '#e3e7f0', 700)
        text(c, 'VERIFIER', w - 24, 44, 15, CSS.accent, 600, MONO, 'right')
        const rows = [
          ['Specimen ID card', flash ? 'APPROVED' : 'REPORT READY'],
          ['Specimen marksheet', 'PENDING'],
          ['Specimen licence', 'PENDING'],
        ]
        rows.forEach(([name, state], i) => {
          const y = 70 + i * 62
          rrect(c, 22, y, w - 44, 50, 8, i === 0 ? (flash ? '#10261f' : '#14223a') : '#121a2b')
          rrect(c, 36, y + 11, 22, 28, 3, '#cfd6e6')
          text(c, name, 72, y + 32, 19, '#e3e7f0', 500)
          text(c, state, w - 38, y + 32, 14, i === 0 ? (flash ? CSS.ok : CSS.accent) : '#7d8599', 700, MONO, 'right')
        })
        rrect(c, 22, 266, 150, 38, 8, flash ? CSS.ok : '#1c3a2e')
        text(c, 'Approve', 97, 291, 18, flash ? '#04140c' : CSS.ok, 700, SANS, 'center')
        rrect(c, 184, 266, 150, 38, 8, '#3a1620')
        text(c, 'Reject', 259, 291, 18, CSS.alert, 700, SANS, 'center')
      })
    }

    // 06 · Ledger: hash-chained blocks in the middle of the ring.
    const ledger = byId.ledger
    const ledgerClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.64)
    const BLOCKS = 7
    const Y0 = 0.86
    const SP = 0.46
    const ledgerBlocks = []
    const ledgerLinks = []
    let ledgerBase = 1 // number of the block in slot 0
    {
      const g = ledger.group
      cyl(g, 1.05, 0.22, 0, 0.37, 0, M.body, 1.12, 56)
      cyl(g, 0.86, 0.12, 0, 0.53, 0, M.edge, 0.9, 56)
      const ring = torus(g, 0.9, 0.018, 0, 0.6, 0, M.accent)
      ring.rotation.x = Math.PI / 2
      for (let j = 0; j < BLOCKS; j++) {
        const body = std(0x1a2030, 0.7, 0.3, { emissive: COLORS.accent, emissiveIntensity: 0, clippingPlanes: [ledgerClip] })
        const strip = M.accent.clone()
        strip.clippingPlanes = [ledgerClip]
        const grp = new THREE.Group()
        g.add(grp)
        box(grp, 1.08, 0.3, 0.74, 0, 0, 0, body, 0.06)
        for (const x of [-0.56, 0.56]) box(grp, 0.03, 0.22, 0.6, x, 0, 0, strip, 0.01)
        const label = canvasTexture(320, 96, () => {})
        const lm = screen(grp, 0.96, 0.27, 0, 0, 0.375, label)
        lm.material.clippingPlanes = [ledgerClip]
        const back = screen(grp, 0.96, 0.27, 0, 0, -0.375, label, true)
        back.material.clippingPlanes = [ledgerClip]
        ledgerBlocks.push({ grp, body, strip, label, edited: false })
      }
      for (let j = 0; j < BLOCKS - 1; j++) {
        const linkMat = M.chrome.clone()
        linkMat.clippingPlanes = [ledgerClip]
        linkMat.emissive = new THREE.Color(COLORS.alert)
        linkMat.emissiveIntensity = 0
        const pair = []
        for (const x of [-0.3, 0.3]) {
          const lower = torus(g, 0.075, 0.02, x, 0, 0, linkMat)
          const upper = torus(g, 0.075, 0.02, x, 0, 0, linkMat)
          upper.rotation.y = Math.PI / 2
          lower.userData.keep = upper.userData.keep = true
          pair.push({ lower, upper, x })
        }
        ledgerLinks.push({ pair, mat: linkMat })
      }
      ledger.anchorY = 4.1
    }
    function drawBlock(slot) {
      const b = ledgerBlocks[slot]
      const num = ledgerBase + slot
      const edited = b.edited
      b.label.redraw((c, w, h) => {
        rrect(c, 0, 0, w, h, 8, edited ? '#2a0f18' : '#0b1220')
        text(c, `#${pad4(num)}`, 16, 40, 28, edited ? CSS.alert : CSS.accent, 700, MONO)
        text(c, edited ? 'EDITED' : 'SHA-256', w - 16, 38, 16, edited ? CSS.alert : '#7d8599', 700, MONO, 'right')
        const hsh = hexString(edited ? num * 977 + 5 : num * 131 + 3, 16)
        const prev = hexString((num - 1) * 131 + 3, 8)
        text(c, `hash ${hsh.slice(0, 8)}…${hsh.slice(-4)}`, 16, 66, 17, edited ? '#ffb3c0' : '#cfd6e6', 500, MONO)
        text(c, `prev ${prev}…`, 16, 88, 15, '#6d7890', 500, MONO)
      })
    }
    for (let j = 0; j < BLOCKS; j++) drawBlock(j)

    // 07 · QR proof: a kiosk with a QR panel and a phone that scans it.
    const proof = byId.proof
    let phone, phoneScreens
    {
      const g = proof.group
      foot(proof, 1.6, 1.2)
      shellBox(g, 1.3, 0.7, 0.8, 0, 0.83, -0.1, S.porcelain, 0.1)
      box(g, 0.12, 0.7, 0.12, 0, 1.5, -0.3, M.chrome, 0.03)
      box(g, 1.36, 1.56, 0.08, 0, 2.5, -0.3, M.dark, 0.05)
      const qr = canvasTexture(512, 600, (c, w, h) => {
        rrect(c, 0, 0, w, h, 18, '#f1f3f8')
        // Decorative only: this pattern is not a real, scannable QR code.
        const n = 25
        const cell = 16
        const ox = (w - n * cell) / 2
        const oy = 40
        const rnd = seeded(2024)
        const finder = (x, y) =>
          (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            if (finder(x, y)) continue
            if (rnd() > 0.52) {
              c.fillStyle = '#0a0f1c'
              c.fillRect(ox + x * cell, oy + y * cell, cell, cell)
            }
          }
        for (const [fx, fy] of [
          [0, 0],
          [n - 7, 0],
          [0, n - 7],
        ]) {
          c.fillStyle = '#0a0f1c'
          c.fillRect(ox + fx * cell, oy + fy * cell, 7 * cell, 7 * cell)
          c.fillStyle = '#f1f3f8'
          c.fillRect(ox + (fx + 1) * cell, oy + (fy + 1) * cell, 5 * cell, 5 * cell)
          c.fillStyle = '#0a8fa6'
          c.fillRect(ox + (fx + 2) * cell, oy + (fy + 2) * cell, 3 * cell, 3 * cell)
        }
        text(c, 'SCAN TO VERIFY', w / 2, 520, 34, '#0a0f1c', 800, SANS, 'center')
        text(c, 'no login needed', w / 2, 562, 22, '#5b6680', 500, MONO, 'center')
      })
      screen(g, 1.26, 1.48, 0, 2.5, -0.255, qr)
      phone = new THREE.Group()
      g.add(phone)
      box(phone, 0.42, 0.82, 0.05, 0, 0, 0, M.dark, 0.06)
      const scanning = canvasTexture(192, 384, (c, w, h) => {
        rrect(c, 0, 0, w, h, 22, '#0b1220')
        c.strokeStyle = CSS.accent
        c.lineWidth = 6
        for (const [x, y, dx, dy] of [
          [36, 110, 1, 1],
          [156, 110, -1, 1],
          [36, 250, 1, -1],
          [156, 250, -1, -1],
        ]) {
          c.beginPath()
          c.moveTo(x, y + dy * 26)
          c.lineTo(x, y)
          c.lineTo(x + dx * 26, y)
          c.stroke()
        }
        text(c, 'Scanning…', w / 2, 320, 22, '#cfd6e6', 600, SANS, 'center')
      })
      const verified = canvasTexture(192, 384, (c, w, h) => {
        rrect(c, 0, 0, w, h, 22, '#0b1220')
        c.fillStyle = '#0f2c22'
        c.beginPath()
        c.arc(w / 2, 150, 54, 0, TAU)
        c.fill()
        tick(c, w / 2 - 26, 152, 52, CSS.ok)
        text(c, 'Verified', w / 2, 252, 32, CSS.ok, 800, SANS, 'center')
        text(c, 'SHA-256 match', w / 2, 290, 16, '#9aa4ba', 600, MONO, 'center')
        text(c, 'no login needed', w / 2, 318, 15, '#6d7890', 500, MONO, 'center')
      })
      phoneScreens = [screen(phone, 0.37, 0.74, 0, 0, 0.027, scanning), screen(phone, 0.37, 0.74, 0, 0, 0.028, verified)]
      phoneScreens[1].visible = false
      proof.anchorY = 3.5
    }

    // Data lines from each station to the ledger, with pulses when something is recorded.
    const pulseMat = M.accent
    const spokes = []
    for (const st of stations) {
      if (st.id === 'ledger' || st.id === 'gate') continue
      const a = new THREE.Vector3(st.base.x, 0.275, st.base.z)
      const dir = a.clone().setY(0).normalize()
      const b = dir.clone().multiplyScalar(1.12).setY(0.275)
      const start = a.clone().addScaledVector(dir, -0.85)
      const len = start.distanceTo(b)
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, len), M.accentSoft)
      line.position.copy(start).lerp(b, 0.5)
      line.lookAt(b)
      line.raycast = () => {}
      machine.add(line)
      const dot = sphere(machine, 0.07, pulseMat)
      dot.userData.keep = true
      dot.visible = false
      spokes.push({ st, from: start, to: b, dot })
    }

    // ---------- documents on the belt ----------
    function docFace(stage) {
      return canvasTexture(256, 352, (c, w, h) => {
        c.fillStyle = '#f1f3f8'
        c.fillRect(0, 0, w, h)
        rrect(c, 16, 18, 84, 100, 8, '#c6cede')
        c.fillStyle = '#9aa4b8'
        c.beginPath()
        c.arc(58, 56, 18, 0, TAU)
        c.fill()
        rrect(c, 32, 80, 52, 30, 14, '#9aa4b8')
        for (let i = 0; i < 6; i++) rrect(c, 114, 26 + i * 16, 118 - (i % 3) * 24, 7, 3, '#b4bccb')
        text(c, 'SPECIMEN', w / 2, 154, 28, '#c43d5a', 800, SANS, 'center')
        text(c, 'XXXX XXXX 4821', w / 2, 184, 18, '#5b6680', 600, MONO, 'center')
        if (stage === 0) {
          for (let i = 0; i < 5; i++) rrect(c, 18, 212 + i * 18, 214 - (i % 2) * 60, 7, 3, '#cbd1dd')
        }
        if (stage >= 1) {
          rrect(c, 14, 204, w - 28, 42, 6, '#0b1220')
          text(c, 'SHA-256', 24, 230, 13, '#8f9ab0', 700, MONO)
          text(c, hexString(7, 10) + '…', 92, 231, 14, CSS.accent, 500, MONO)
        }
        if (stage === 2) {
          rrect(c, 14, 256, w - 28, 80, 6, '#14112a')
          const r = seeded(99)
          for (let row = 0; row < 3; row++) {
            let s = ''
            for (let i = 0; i < 18; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]
            text(c, s, 24, 280 + row * 20, 15, '#b98cff', 500, MONO)
          }
        }
        if (stage === 3) {
          ;['PAN', 'Verhoeff', 'OCR'].forEach((s, i) => {
            tick(c, 22, 270 + i * 26, 14, '#13a86b')
            text(c, s, 46, 276 + i * 26, 16, '#3a4256', 600)
          })
          rrect(c, 150, 262, 86, 70, 8, '#10261f')
          text(c, '/100', 193, 305, 18, '#13a86b', 700, MONO, 'center')
        }
        if (stage === 4) {
          c.save()
          c.translate(w / 2, 292)
          c.rotate(-0.12)
          c.strokeStyle = '#13a86b'
          c.lineWidth = 5
          c.strokeRect(-100, -26, 200, 52)
          text(c, 'VERIFIED', 0, 12, 30, '#13a86b', 800, SANS, 'center')
          c.restore()
        }
        if (stage >= 2) {
          // Lock badge: the file stays encrypted at rest from here on.
          rrect(c, w - 52, 16, 38, 38, 10, '#0b1220')
          c.strokeStyle = CSS.accent
          c.lineWidth = 3
          c.beginPath()
          c.arc(w - 33, 34, 7, Math.PI, 0)
          c.stroke()
          rrect(c, w - 44, 33, 22, 15, 3, CSS.accent)
        }
      })
    }
    const faces = [0, 1, 2, 3, 4].map(docFace)
    const docs = []
    for (let i = 0; i < DOCS; i++) {
      const grp = new THREE.Group()
      machine.add(grp)
      box(grp, 0.54, 0.72, 0.03, 0, 0, 0, M.paper, 0.02)
      const planes = faces.map((f) => {
        const s = screen(grp, 0.5, 0.687, 0, 0, 0.0165, f)
        s.material.transparent = false
        s.visible = false
        return s
      })
      const backs = faces.map((f) => {
        const s = screen(grp, 0.5, 0.687, 0, 0, -0.0165, f, true)
        s.material.transparent = false
        s.visible = false
        return s
      })
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.44, 48),
        new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = -0.37
      grp.add(ring)
      ring.visible = false
      docs.push({ grp, planes, backs, ring, stage: -1, deg: 0, prevDeg: null, p: 0 })
    }

    // ---------- state, modes, cameras ----------
    let mode = 'assembled'
    let cameraMode = 'overview'
    let playing = !reduceMotion
    let sim = 0
    let ledgerClock = 0
    let orbitClock = 0
    let docShift = 0
    let spread = 0
    let xray = 0
    let selected = 'vault'
    let hovered = null
    let tamperT = -1
    const TAMPER_SLOT = 2
    const TAMPER_LEN = 4.8
    let width = Math.max(1, frameW())
    let height = Math.max(1, frameH())
    let mobile = width <= 900
    let lastInteraction = performance.now()
    let dragging = false
    let cameraAnimating = true
    let visible = true
    let contextLost = false
    let sized = false
    let readySent = false
    let baseDistance = 26
    const desiredPos = new THREE.Vector3()
    const desiredTarget = new THREE.Vector3(0, 1.2, 0)
    const viewDir = new THREE.Vector3(8.5, 9.2, 16).normalize()

    function layoutCamera() {
      if (!frameW() || !frameH()) return
      const first = !sized
      sized = true
      width = frameW()
      height = frameH()
      mobile = width <= 900
      renderer.setSize(width, height)
      camera.aspect = width / height
      // In a wide embed the frustum is shifted so the machine sits in the right 58 % of the frame.
      camera.setViewOffset(width, height, mobile || !embedded ? 0 : -width * 0.2, mobile || embedded ? 0 : height * 0.03, width, height)
      const share = mobile ? 0.94 : embedded ? 0.56 : 0.68
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const fitW = 15 / (2 * tanV * camera.aspect * share)
      const fitH = 11 / (2 * tanV * (embedded ? 0.88 : 0.66))
      baseDistance = Math.max(fitW, fitH)
      controls.maxDistance = Math.max(60, baseDistance * 1.7)
      camera.updateProjectionMatrix()
      setCameraGoal()
      cameraAnimating = true
      if (first) {
        camera.position.copy(desiredPos)
        controls.target.copy(desiredTarget)
        controls.update()
        cameraAnimating = false
      }
    }
    function setCameraGoal() {
      const expand = mode === 'exploded' ? 1.18 : 1
      if (cameraMode === 'station') {
        const st = stations.find((s) => s.id === selected)
        desiredTarget.copy(st.group.position).setY(st.id === 'ledger' ? 1.9 : 1.35)
        const dir = new THREE.Vector3(...st.cam).normalize()
        desiredPos.copy(desiredTarget).addScaledVector(dir, (mobile ? 10 : 8.6) * (st.id === 'ledger' ? 1.15 : 1))
      } else {
        desiredTarget.set(0, 1.2, 0)
        const d = baseDistance * expand
        if (cameraMode === 'side') desiredPos.set(15, 4.6, 7).normalize().multiplyScalar(d).add(desiredTarget)
        else if (cameraMode === 'top') desiredPos.set(0.01, d * 0.96, 1.2).add(desiredTarget)
        else desiredPos.copy(viewDir).multiplyScalar(d).add(desiredTarget)
      }
    }
    const pressed = (sel, attr, value) =>
      root.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)))
    function syncButtons() {
      pressed('[data-mode]', 'mode', mode)
      pressed('[data-camera]', 'camera', cameraMode)
      $('journey').classList.toggle('visible', mode === 'document')
    }
    function setMode(name) {
      const next = String(name).toLowerCase().replace(/[\s-]+/g, '')
      const resolved = next === 'onedocument' ? 'document' : next === 'cutaway' ? 'xray' : next
      if (!MODES.includes(resolved)) return false
      mode = resolved
      lastInteraction = performance.now()
      if (mode === 'document') {
        docShift = -sim // start the followed document at the gate
        docs.forEach((d) => (d.prevDeg = null))
        cameraMode = 'overview'
        play()
      } else if (cameraMode === 'station') cameraMode = 'overview'
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function setCamera(name) {
      const next = String(name).toLowerCase()
      if (!CAMERAS.includes(next)) return false
      cameraMode = next
      if (mode === 'document') mode = 'assembled'
      lastInteraction = performance.now()
      orbitClock = 0
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function focusStation(id) {
      const st = stations.find((s) => s.id === String(id).toLowerCase())
      if (!st) return false
      selected = st.id
      if (mode === 'document') mode = 'assembled'
      cameraMode = 'station'
      lastInteraction = performance.now()
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function syncPlayback() {
      const b = $('play')
      b.setAttribute('aria-label', playing ? 'Pause the animation' : 'Resume the animation')
      b.setAttribute('aria-pressed', String(!playing))
      b.classList.toggle('paused', !playing)
      $('status').classList.toggle('paused', !playing)
    }
    function play() {
      playing = true
      syncPlayback()
      return true
    }
    function pause() {
      playing = false
      syncPlayback()
      return true
    }
    function setStatus(broken) {
      $('status').classList.toggle('broken', broken)
      $('status-text').textContent = broken ? `Chain broken at #${pad4(ledgerBase + TAMPER_SLOT)}` : 'Chain intact'
    }
    function tamper() {
      if (tamperT >= 0) return false
      tamperT = 0
      if (!playing) play()
      $('tamper').disabled = true
      lastInteraction = performance.now()
      return true
    }
    const api = { setMode, setCamera, focusStation, tamper, play, pause }
    window.__trustvault = api
    cleanups.push(() => {
      if (window.__trustvault === api) delete window.__trustvault
    })

    root.querySelectorAll('[data-mode]').forEach((b) => listen(b, 'click', () => setMode(b.dataset.mode)))
    root.querySelectorAll('[data-camera]').forEach((b) => listen(b, 'click', () => setCamera(b.dataset.camera)))
    listen($('play'), 'click', () => (playing ? pause() : play()))
    listen($('tamper'), 'click', () => tamper())
    syncPlayback()
    layoutCamera()
    const resizeObserver = new ResizeObserver(() => layoutCamera())
    resizeObserver.observe(root)
    cleanups.push(() => resizeObserver.disconnect())
    controls.addEventListener('start', () => {
      dragging = true
      cameraAnimating = false
      lastInteraction = performance.now()
    })
    controls.addEventListener('end', () => {
      dragging = false
      lastInteraction = performance.now()
    })

    // ---------- fewer draw calls: merge static parts that share a material ----------
    function mergeStatic(group) {
      for (const child of [...group.children]) if (child.isGroup) mergeStatic(child)
      const buckets = new Map()
      for (const o of group.children) {
        if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material)) continue
        if (o.material.isMeshBasicMaterial) continue
        if (!buckets.has(o.material.uuid)) buckets.set(o.material.uuid, [])
        buckets.get(o.material.uuid).push(o)
      }
      for (const list of buckets.values()) {
        if (list.length < 2) continue
        const parts = list.map((m) => {
          m.updateMatrix()
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
          for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
          g.clearGroups()
          return g.applyMatrix4(m.matrix)
        })
        const merged = mergeGeometries(parts, false)
        parts.forEach((g) => g.dispose())
        if (!merged) continue
        const mesh = new THREE.Mesh(merged, list[0].material)
        mesh.castShadow = list.some((m) => m.castShadow)
        mesh.receiveShadow = true
        list.forEach((m) => group.remove(m))
        group.add(mesh)
      }
    }
    mergeStatic(machine)

    // ---------- hover and click ----------
    stations.forEach((st) =>
      st.group.traverse((o) => {
        o.userData.station = st.id
      })
    )
    const pickables = stations.map((s) => s.group)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const tip = $('tip')
    let downX = 0
    let downY = 0
    let moved = false
    const local = (e) => {
      const r = root.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    function hitStation(x, y) {
      pointer.set((x / width) * 2 - 1, (-y / height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(pickables, true)
      return hits.length ? stations.find((s) => s.id === hits[0].object.userData.station) ?? null : null
    }
    listen(renderer.domElement, 'pointermove', (e) => {
      const [x, y] = local(e)
      if (Math.hypot(x - downX, y - downY) > 5) moved = true
      if (dragging || e.pointerType === 'touch') return
      const st = hitStation(x, y)
      hovered = st ? st.id : null
      renderer.domElement.style.cursor = st ? 'pointer' : 'grab'
      tip.classList.toggle('visible', !!st)
      if (st) {
        tip.querySelector('strong').innerHTML = `<span>${st.num}</span>${st.name}`
        tip.querySelector('p').textContent = st.desc
        tip.style.left = `${Math.min(width - 270, Math.max(10, x + 16))}px`
        tip.style.top = `${Math.max(10, Math.min(height - 120, y - 70))}px`
      }
    })
    listen(renderer.domElement, 'pointerleave', () => {
      hovered = null
      tip.classList.remove('visible')
    })
    listen(renderer.domElement, 'pointerdown', (e) => {
      ;[downX, downY] = local(e)
      moved = false
      tip.classList.remove('visible')
    })
    listen(renderer.domElement, 'pointerup', (e) => {
      if (moved) return
      const [x, y] = local(e)
      const st = hitStation(x, y)
      if (!st) return
      focusStation(st.id)
      options.onStation?.(st.id)
    })
    listen(document, 'visibilitychange', () => {
      visible = !document.hidden
      lastFrame = performance.now()
    })
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting && !document.hidden
        lastFrame = performance.now()
      },
      { threshold: 0.01 }
    )
    io.observe(renderer.domElement)
    cleanups.push(() => io.disconnect())
    listen(renderer.domElement, 'webglcontextlost', (e) => {
      e.preventDefault()
      contextLost = true
      showError('The graphics context was interrupted. The scene comes back on its own once WebGL is available again.')
    })
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false
      $('error').style.display = 'none'
      lastFrame = performance.now()
    })

    // ---------- animation ----------
    const anchor = new THREE.Vector3()
    let lastFrame = performance.now()
    let lastPaint = -1
    let lastTotpPaint = -1
    let paintedVerifierFlash = null
    let paintedVaultOpen = null
    let prevJourney = -1
    let frames = 0
    let measured = 0
    let pixelRatio = renderer.getPixelRatio()
    let raf = 0
    let tamperBroken = false
    let boltOut = 1
    const docPos = new THREE.Vector3()

    function stageFor(deg) {
      const d = deg < ROUTE_START - 1 ? deg + 360 : deg
      if (d < 205) return 0
      if (d < 252) return 1
      if (d < 300) return 2
      if (d < 348) return 3
      return 4
    }
    function journeyFor(deg) {
      if (deg < 190) return 0
      if (deg < 240) return 1
      if (deg < 288) return 2
      if (deg < 336) return 3
      if (deg < 378) return 4
      return 5
    }
    // The document nearest to a station, as progress 0..1 across a window of degrees.
    function progressNear(fromDeg, toDeg) {
      let best = -1
      for (const d of docs) {
        if (!d.grp.visible) continue
        const p = (d.deg - fromDeg) / (toDeg - fromDeg)
        if (p >= 0 && p <= 1.15) best = Math.max(best, Math.min(1, p))
      }
      return best
    }

    function animate(now) {
      raf = requestAnimationFrame(animate)
      const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.05))
      lastFrame = now
      if (!visible || contextLost) return
      if (playing) {
        sim += dt
        orbitClock += dt
        if (tamperT < 0) ledgerClock += dt
      }
      if (tamperT >= 0 && playing) {
        tamperT += dt
        if (tamperT > TAMPER_LEN) {
          tamperT = -1
          ledgerBlocks[TAMPER_SLOT].edited = false
          drawBlock(TAMPER_SLOT)
          $('tamper').disabled = false
        }
      }
      const t = sim
      const k = 1 - Math.exp(-dt * 5)
      spread += ((mode === 'exploded' ? 1 : 0) - spread) * k
      xray += ((mode === 'xray' ? 1 : 0) - xray) * k

      // X-ray: shells turn to glass, outlines appear.
      for (const m of shellMaterials) {
        m.opacity = 1 - xray * 0.88
        m.depthWrite = xray < 0.5
      }
      outlineMaterial.opacity = xray * 0.75

      // Exploded: stations move out and up, the belt widens.
      for (const st of stations) {
        st.group.position.copy(st.base)
        if (st.id !== 'ledger') {
          st.group.position.x *= 1 + spread * 0.22
          st.group.position.z *= 1 + spread * 0.32
          st.group.position.y += spread * (st.id === 'gate' ? 0.9 : 0.55)
        }
        const since = t - st.trigger
        const pulse = since >= 0 && since < 1.2 ? 1 - since / 1.2 : 0
        const focus = hovered === st.id || (cameraMode === 'station' && selected === st.id)
        st.led.emissiveIntensity += ((focus ? 3.2 : 0.55 + pulse * 2.2) - st.led.emissiveIntensity) * k
      }
      belt.scale.set(1 + spread * 0.08, 1, 1 + spread * 0.1)

      // Documents.
      const followOnly = mode === 'document'
      for (let i = 0; i < DOCS; i++) {
        const d = docs[i]
        const p = (((t + docShift) / CYCLE + i / DOCS) % 1 + 1) % 1
        d.p = p
        const deg = ROUTE_START + ROUTE_SPAN * p
        d.deg = deg
        ringPoint(wrapDeg(deg), docPos)
        docPos.x *= 1 + spread * 0.08
        docPos.z *= 1 + spread * 0.1
        d.grp.position.set(docPos.x, BELT_TOP + 0.4 + Math.sin(t * 2 + i) * 0.015, docPos.z)
        d.grp.rotation.set(-0.08, 0.36, 0)
        const show = !followOnly || i === 0
        d.grp.visible = show
        const fadeIn = clamp01(p / 0.035)
        const fadeOut = clamp01((1 - p) / 0.035)
        d.grp.scale.setScalar(Math.max(0.001, Math.min(fadeIn, fadeOut)) * (followOnly ? 1.3 : 1))
        d.ring.visible = followOnly && i === 0
        const stage = stageFor(deg)
        if (stage !== d.stage) {
          d.planes.forEach((pl, j) => (pl.visible = j === stage))
          d.backs.forEach((pl, j) => (pl.visible = j === stage))
          d.stage = stage
        }
        // Light up a station's LED and send a pulse to the ledger when a document passes it.
        if (d.prevDeg !== null && show)
          for (const st of stations) {
            if (st.theta === undefined) continue
            const sd = st.theta < ROUTE_START ? st.theta + 360 : st.theta
            if (d.prevDeg < sd && deg >= sd) st.trigger = t
          }
        d.prevDeg = deg
      }

      // Gate lamps: one, two, three as the document walks through.
      const gp = progressNear(141, 162)
      gateLamps.forEach((m, j) => {
        const on = gp >= 0 && gp > (j + 0.6) / 3.6
        const target = on ? 2.4 : 0.28
        m.emissiveIntensity += (target - m.emissiveIntensity) * k * 1.6
        m.emissive.setHex(on ? COLORS.ok : COLORS.accent)
        m.color.setHex(on ? COLORS.ok : COLORS.accent)
      })

      // Upload: gears spin while a file is read; a card drops into the hopper.
      const up = progressNear(176, 206)
      uploadGears.forEach((g, j) => (g.rotation.y = t * (j ? -1.6 : 1.2) * (up >= 0 && up < 1 ? 3 : 1)))
      const drop = (t % 5) / 5
      hopperCard.position.set(0.42, 2.6 - easeOut(drop / 0.6) * 0.92, -0.44)
      hopperCard.rotation.set(0, 0.4, Math.sin(drop * TAU) * 0.08)
      hopperCard.scale.setScalar(drop < 0.62 ? 1 : 0.001)

      // Vault: bolts pull back while a file is filed, then lock; the wheel spins hard.
      const vp = progressNear(236, 258)
      const open = vp >= 0 && vp < 1
      boltOut += ((open ? 0 : 1) - boltOut) * Math.min(1, k * 2)
      const boltR = 0.6 + 0.12 * boltOut
      bolts.forEach((b) => {
        b.mesh.position.x = Math.cos(b.a) * boltR
        b.mesh.position.y = Math.sin(b.a) * boltR
      })
      vaultWheel.rotation.z = -t * (open ? 2.4 : 0.35)
      vaultDial.rotation.z = Math.sin(t * 0.6) * 0.8 + (open ? t * 3 : 0)

      // Checks: the scan bar sweeps.
      scanBar.position.x = Math.sin(t * 1.5) * 0.7
      const cp = progressNear(282, 318)

      // Verifier: the stamp comes down when a document reaches the desk.
      const vs = t - verifier.trigger
      let stampY = 1.75 + Math.sin(t * 2) * 0.01
      if (vs >= 0 && vs < 0.9) {
        if (vs < 0.3) stampY = 1.75 - easeOut(vs / 0.3) * 0.42
        else if (vs < 0.45) stampY = 1.33
        else stampY = 1.33 + easeOut((vs - 0.45) / 0.45) * 0.42
      }
      stampHead.position.y = stampY
      const approvedNow = vs > 0.3 && vs < 3.6
      stampApproved.visible = approvedNow
      stampPending.visible = !approvedNow

      // Proof: the phone moves to the QR, scans, shows "Verified", moves back.
      const pc = (t % 6) / 6
      const reach = pc < 0.25 ? easeOut(pc / 0.25) : pc < 0.75 ? 1 : 1 - easeOut((pc - 0.75) / 0.25)
      phone.position.set(0.72 - reach * 0.55, 1.55 + reach * 0.75, 0.75 - reach * 0.28)
      phone.rotation.set(-0.1, -0.35 + reach * 0.35, 0.06 - reach * 0.06)
      const showVerified = pc > 0.4 && pc < 0.82
      phoneScreens[0].visible = !showVerified
      phoneScreens[1].visible = showVerified

      // Ledger: every 7 s a new block drops onto the chain and the stack steps down.
      const lc = (ledgerClock % 7) / 7
      const wraps = Math.floor(ledgerClock / 7)
      if (wraps + 1 !== ledgerBase) {
        ledgerBase = wraps + 1
        for (let j = 0; j < BLOCKS; j++) drawBlock(j)
        $('status-meta').textContent = `BLOCK #${pad4(ledgerBase + BLOCKS - 2)}`
      }
      const step = smooth((lc - 0.78) / 0.22)
      const spacing = SP * (1 + spread * 0.5)
      const brk = tamperT >= 0 ? smooth((tamperT - 0.35) / 0.5) * (1 - smooth((tamperT - 3.7) / 0.9)) : 0
      if (tamperT >= 0 && tamperT > 0.12 && !ledgerBlocks[TAMPER_SLOT].edited && tamperT < 3.7) {
        ledgerBlocks[TAMPER_SLOT].edited = true
        drawBlock(TAMPER_SLOT)
      }
      if (tamperT >= 3.7 && ledgerBlocks[TAMPER_SLOT].edited) {
        ledgerBlocks[TAMPER_SLOT].edited = false
        drawBlock(TAMPER_SLOT)
      }
      const broken = brk > 0.2
      if (broken !== tamperBroken) {
        tamperBroken = broken
        setStatus(broken)
      }
      const blockY = []
      for (let j = 0; j < BLOCKS; j++) {
        const b = ledgerBlocks[j]
        let y = Y0 + (j - step) * spacing
        let scale = 1
        if (j === BLOCKS - 1) {
          const arrive = smooth((lc - 0.62) / 0.12)
          scale = arrive
          y += (1 - step) * 0.75
        }
        if (j >= TAMPER_SLOT) y += brk * 0.24
        blockY[j] = y
        b.grp.position.set(0, y, 0)
        b.grp.scale.setScalar(Math.max(0.001, scale))
        b.grp.rotation.y = j >= TAMPER_SLOT ? brk * 0.06 * (j % 2 ? 1 : -1) : 0
        const red = tamperT >= 0 && j >= TAMPER_SLOT ? smooth((tamperT - 0.35 - (j - TAMPER_SLOT) * 0.16) / 0.3) * (1 - smooth((tamperT - 3.7) / 0.9)) : 0
        b.body.emissive.setHex(red > 0.01 ? COLORS.alert : COLORS.accent)
        b.body.emissiveIntensity = red > 0.01 ? red * 0.55 : j === BLOCKS - 1 ? (1 - step) * 0.3 * scale : 0
        b.strip.emissive.setHex(red > 0.5 ? COLORS.alert : COLORS.accent)
        b.strip.color.setHex(red > 0.5 ? COLORS.alert : COLORS.accent)
      }
      ledgerLinks.forEach((lnk, j) => {
        const lowY = blockY[j] + 0.15
        const highY = blockY[j + 1] - 0.15
        const mid = (lowY + highY) / 2
        const vis = j === BLOCKS - 2 ? smooth((step - 0.55) / 0.35) : 1
        const splitHere = j === TAMPER_SLOT - 1 ? brk : 0
        lnk.pair.forEach(({ lower, upper, x }) => {
          lower.position.set(x, mid - 0.055 - splitHere * 0.05, 0)
          upper.position.set(x, mid + 0.055 + splitHere * 0.12, 0)
          lower.scale.setScalar(Math.max(0.001, vis))
          upper.scale.setScalar(Math.max(0.001, vis))
        })
        lnk.mat.emissiveIntensity = j >= TAMPER_SLOT - 1 ? brk * 1.4 : 0
      })

      // Pulses travel from a station to the ledger right after it records something.
      spokes.forEach((s) => {
        const since = t - s.st.trigger
        const on = since >= 0 && since < 1
        s.dot.visible = on
        if (on) {
          s.dot.position.copy(s.from).lerp(s.to, easeOut(since))
          s.dot.position.y = 0.32
        }
      })

      // Screens are repainted at a modest rate.
      if (t - lastPaint > 1 / 12 || lastPaint < 0) {
        drawUpload(up, t)
        drawChecks(Math.max(0, cp))
        lastPaint = t
      }
      if (t - lastTotpPaint > 0.2 || lastTotpPaint < 0) {
        drawTotp(t)
        lastTotpPaint = t
      }
      const flash = approvedNow
      if (flash !== paintedVerifierFlash) {
        drawVerifier(flash)
        paintedVerifierFlash = flash
      }
      if (open !== paintedVaultOpen) {
        drawVault(open)
        paintedVaultOpen = open
      }
      updateSlats(t)

      // Follow one document.
      if (mode === 'document') {
        const d = docs[0]
        const jStep = journeyFor(d.deg)
        if (jStep !== prevJourney) {
          $('journey-title').textContent = JOURNEY[jStep][0]
          $('journey-detail').textContent = JOURNEY[jStep][1]
          prevJourney = jStep
        }
        $('journey-bar').style.width = `${(d.p * 100).toFixed(1)}%`
        if (!dragging && playing) {
          desiredTarget.copy(d.grp.position)
          desiredPos.copy(desiredTarget).addScaledVector(viewDir, mobile ? 11 : 9.5)
          cameraAnimating = true
        }
      } else if (cameraMode === 'orbit' && playing && !dragging) {
        const a = orbitClock * 0.14
        const dist = baseDistance * (mode === 'exploded' ? 1.18 : 1)
        desiredTarget.set(0, 1.2, 0)
        desiredPos.set(Math.sin(a + 0.5) * dist * 0.84, dist * (0.46 + Math.sin(a * 0.7) * 0.08), Math.cos(a + 0.5) * dist * 0.84).add(desiredTarget)
        cameraAnimating = true
      } else if (cameraMode === 'station' && cameraAnimating) setCameraGoal()
      if (cameraAnimating && !dragging) {
        const speed = 1 - Math.exp(-dt * (mode === 'document' ? 2.4 : 3))
        camera.position.lerp(desiredPos, speed)
        controls.target.lerp(desiredTarget, speed)
        if (
          cameraMode !== 'orbit' &&
          mode !== 'document' &&
          camera.position.distanceTo(desiredPos) < 0.015 &&
          controls.target.distanceTo(desiredTarget) < 0.015
        )
          cameraAnimating = false
      }
      controls.autoRotate =
        playing && !reduceMotion && !dragging && !cameraAnimating && mode !== 'document' && cameraMode === 'overview' && now - lastInteraction > 7000
      controls.autoRotateSpeed = 0.22
      controls.update(dt)

      // Station callouts in Exploded mode: two columns, left and right of the machine,
      // each callout level with its station and pushed apart so none overlap.
      const showLabels = mode === 'exploded' && cameraMode !== 'station'
      stations.forEach((st) => st.label.classList.toggle('visible', showLabels))
      if (showLabels) {
        anchor.set(0, 1, 0).project(camera)
        const cx = (anchor.x * 0.5 + 0.5) * width
        const cardW = mobile ? 122 : 184
        const cardH = mobile ? 40 : 56
        const gap = mobile ? 6 : 10
        const top = mobile ? 108 : 124
        const bottom = height - (mobile ? 196 : 214)
        const placed = stations.map((st) => {
          anchor.copy(st.group.position).setY(st.group.position.y + st.anchorY * 0.6).project(camera)
          const sx = (anchor.x * 0.5 + 0.5) * width
          const sy = (-anchor.y * 0.5 + 0.5) * height
          return { st, sx, sy, side: st.id === 'ledger' ? 'top' : sx < cx ? 'left' : 'right', y: sy - cardH / 2 }
        })
        for (const side of ['left', 'right']) {
          const col = placed.filter((q) => q.side === side).sort((a, b) => a.y - b.y)
          for (let i = 0; i < col.length; i++) {
            col[i].y = Math.max(col[i].y, top, i ? col[i - 1].y + cardH + gap : -Infinity)
          }
          const overflow = col.length ? col[col.length - 1].y - bottom : 0
          if (overflow > 0) for (const q of col) q.y = Math.max(top, q.y - overflow)
          for (const q of col) {
            const reach = mobile ? 46 : Math.max(90, Math.min(220, width * 0.12))
            q.x = side === 'left' ? Math.min(q.sx - reach - cardW, cx - cardW - 40) : Math.max(q.sx + reach, cx + 40)
          }
        }
        for (const q of placed) {
          if (q.side === 'top') {
            q.x = q.sx - cardW / 2
            q.y = Math.max(top, q.sy - (mobile ? 150 : 240))
          }
          const minX = mobile || !embedded ? 8 : width * 0.42
          const x = THREE.MathUtils.clamp(q.x, minX, width - cardW - 8)
          q.st.label.style.transform = `translate(${x.toFixed(1)}px, ${q.y.toFixed(1)}px)`
          q.st.label.dataset.side = q.side
        }
      }

      renderer.render(scene, camera)
      if (!readySent && sized) {
        readySent = true
        $('loading').classList.add('done')
        options.onReady?.()
      }
      // On slow devices lower only the pixel ratio; timing and geometry stay the same.
      if (playing) {
        frames++
        measured += dt
        if (measured > 4) {
          if (frames / measured < 42 && pixelRatio > 1) {
            pixelRatio = Math.max(1, pixelRatio - 0.25)
            renderer.setPixelRatio(pixelRatio)
          }
          frames = 0
          measured = 0
        }
      }
    }
    setStatus(false)
    raf = requestAnimationFrame(animate)

    cleanups.push(() => {
      cancelAnimationFrame(raf)
      controls.dispose()
      const textures = new Set()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const list = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        for (const m of list) {
          for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v)
          m.dispose()
        }
      })
      geometries.forEach((g) => g.dispose())
      textures.forEach((tx) => tx.dispose())
      envRT.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    })
    renderer.compile(scene, camera)
    $('error').style.display = 'none'

    // For integration tests and automated browser checks; no UI uses it.
    window.__trustvaultDebug = {
      getState: () => ({
        mode,
        camera: cameraMode,
        playing,
        time: sim,
        spread,
        xray,
        tampering: tamperT >= 0,
        chainBroken: tamperBroken,
        latestBlock: ledgerBase + BLOCKS - 2,
        width,
        height,
        embedded,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      }),
      // Snap the camera and mode transitions to their end state (screenshot tests).
      settle: () => {
        spread = mode === 'exploded' ? 1 : 0
        xray = mode === 'xray' ? 1 : 0
        camera.position.copy(desiredPos)
        controls.target.copy(desiredTarget)
        controls.update()
        cameraAnimating = mode === 'document' || cameraMode === 'orbit'
        return true
      },
      // Jump the animation clock forward (tests on slow software renderers).
      advance: (seconds) => {
        const v = Math.max(0, Number(seconds) || 0)
        sim += v
        orbitClock += v
        if (tamperT >= 0) tamperT += v
        else ledgerClock += v
        return sim
      },
    }
    cleanups.push(() => {
      delete window.__trustvaultDebug
    })
  } catch (error) {
    console.error('TrustVault3D: failed to start', error)
    showError()
  }
  return dispose
}

// ---------------------------------------------------------------------------
// Styles, scoped to .tv3d (TrustVault's dark "Aurora" palette).
// ---------------------------------------------------------------------------

const STYLES = String.raw`
.tv3d {
  --tv-bg: #000000;
  --tv-ink: #f5f5f7;
  --tv-accent: #19e6ff;
  --tv-ok: #39ff9c;
  --tv-alert: #ff4d6d;
  --tv-muted: #8a91a6;
  --tv-line: rgba(245, 245, 247, 0.1);
  --tv-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  position: relative;
  width: 100%;
  overflow: hidden;
  contain: layout;
  color-scheme: dark;
  background:
    radial-gradient(ellipse 70% 55% at 50% 42%, rgba(25, 230, 255, 0.07), transparent 70%),
    radial-gradient(ellipse 50% 40% at 15% 85%, rgba(181, 107, 255, 0.06), transparent 70%),
    var(--tv-bg);
  color: var(--tv-ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}
.tv3d *, .tv3d *::before, .tv3d *::after { box-sizing: border-box; }
.tv3d button, .tv3d a { -webkit-tap-highlight-color: transparent; }
.tv3d button { font: inherit; color: inherit; cursor: pointer; }
.tv3d button:focus-visible, .tv3d a:focus-visible { outline: 2px solid var(--tv-accent); outline-offset: 4px; }
.tv3d svg { display: block; flex-shrink: 0; }
.tv3d .tv-scene { position: absolute; inset: 0; touch-action: none; }
.tv3d .tv-scene canvas { display: block; width: 100%; height: 100%; }
.tv3d .tv-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 48%, transparent 34%, rgba(0, 0, 0, 0.18) 66%, rgba(0, 0, 0, 0.72) 100%);
}
.tv3d .tv-top {
  position: absolute; inset: 26px 30px auto; display: flex; align-items: center;
  justify-content: space-between; pointer-events: none;
}
.tv3d .tv-id { display: flex; align-items: center; gap: 12px; }
.tv3d .tv-mark {
  width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px;
  color: var(--tv-accent); border: 1px solid rgba(25, 230, 255, 0.28);
  background: linear-gradient(180deg, rgba(25, 230, 255, 0.12), rgba(25, 230, 255, 0.02));
  box-shadow: 0 0 24px -8px rgba(25, 230, 255, 0.6);
}
.tv3d .tv-id strong { display: block; font-size: 14px; font-weight: 650; letter-spacing: -0.2px; }
.tv3d .tv-id small {
  display: block; margin-top: 4px; font: 500 9px var(--tv-mono); letter-spacing: 1.6px;
  text-transform: uppercase; color: #6c7389;
}
.tv3d .tv-status {
  display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px;
  border: 1px solid var(--tv-line); background: rgba(12, 14, 22, 0.7); backdrop-filter: blur(10px);
  font-size: 11px; color: #c4c9d6; transition: border-color 0.3s, color 0.3s;
}
.tv3d .tv-status i {
  width: 6px; height: 6px; border-radius: 50%; background: var(--tv-ok);
  box-shadow: 0 0 10px rgba(57, 255, 156, 0.7);
}
.tv3d .tv-status span:last-child { font: 500 10px var(--tv-mono); color: #5f667b; margin-left: 6px; }
.tv3d .tv-status.paused i { background: #6b7184; box-shadow: none; }
.tv3d .tv-status.broken { border-color: rgba(255, 77, 109, 0.55); color: #ffd1da; }
.tv3d .tv-status.broken i { background: var(--tv-alert); box-shadow: 0 0 12px rgba(255, 77, 109, 0.9); }
.tv3d .tv-heading {
  position: absolute; top: 104px; left: 25%; right: 25%; display: flex; align-items: center; gap: 12px;
  pointer-events: none; font: 500 9.5px var(--tv-mono); letter-spacing: 1.8px; text-transform: uppercase; color: #9aa1b4;
}
.tv3d .tv-heading::before { content: ""; width: 22px; height: 1px; background: var(--tv-accent); }
.tv3d .tv-heading .tv-index { margin-left: auto; color: #4d5468; letter-spacing: 1px; }
.tv3d .tv-side {
  position: absolute; top: 150px; right: 32px; writing-mode: vertical-rl; pointer-events: none;
  font: 500 9px var(--tv-mono); letter-spacing: 1.6px; color: #4a5164;
}
.tv3d .tv-controls {
  position: absolute; left: 24px; right: 24px; bottom: 74px; z-index: 5;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.tv3d .tv-modes {
  display: flex; gap: 3px; padding: 5px; border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(14, 16, 24, 0.82);
  backdrop-filter: blur(16px); box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.8), 0 0 40px -24px rgba(25, 230, 255, 0.5);
}
.tv3d .tv-modes button {
  display: flex; align-items: center; gap: 8px; padding: 10px 15px; border: 0; border-radius: 10px;
  background: none; color: #a3a9b9; font-size: 11.5px; font-weight: 550; white-space: nowrap;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.tv3d .tv-modes button svg { width: 14px; height: 14px; }
.tv3d .tv-modes button:hover { background: rgba(255, 255, 255, 0.05); color: var(--tv-ink); }
.tv3d .tv-modes button[aria-pressed="true"] {
  background: var(--tv-accent); color: #00131a; box-shadow: 0 4px 18px -4px rgba(25, 230, 255, 0.6);
}
.tv3d .tv-cams { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
.tv3d .tv-caption { font: 500 9px var(--tv-mono); letter-spacing: 1.4px; color: #4f566a; margin-right: 8px; }
.tv3d .tv-cams button[data-camera] {
  border: 0; background: none; padding: 5px 9px; font-size: 10.5px; color: #6f768a; transition: color 0.2s;
}
.tv3d .tv-cams button[data-camera]:hover, .tv3d .tv-cams button[data-camera][aria-pressed="true"] { color: var(--tv-ink); }
.tv3d .tv-cams button[data-camera][aria-pressed="true"]::after {
  content: ""; display: block; width: 4px; height: 4px; margin: 4px auto -8px; border-radius: 50%; background: var(--tv-accent);
}
.tv3d .tv-divider { width: 1px; height: 14px; margin: 0 8px; background: var(--tv-line); }
.tv3d .tv-tamper {
  display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px;
  border: 1px solid rgba(255, 77, 109, 0.35); background: rgba(255, 77, 109, 0.08);
  color: #ff9db0; font-size: 10.5px; font-weight: 550; transition: background 0.2s, opacity 0.2s;
}
.tv3d .tv-tamper:hover { background: rgba(255, 77, 109, 0.16); }
.tv3d .tv-tamper:disabled { opacity: 0.45; cursor: default; }
.tv3d .tv-play {
  width: 26px; height: 26px; margin-left: 4px; display: grid; place-items: center;
  border: 1px solid var(--tv-line); border-radius: 8px; background: none; color: #a3a9b9;
}
.tv3d .tv-play .tv-icon-play, .tv3d .tv-play.paused .tv-icon-pause { display: none; }
.tv3d .tv-play.paused .tv-icon-play { display: block; }
.tv3d .tv-foot {
  position: absolute; left: 30px; right: 30px; bottom: 24px; display: flex; align-items: center;
  justify-content: space-between; gap: 12px; pointer-events: none;
}
.tv3d .tv-wordmark { pointer-events: auto; text-decoration: none; font-size: 11px; color: #6c7389; }
.tv3d .tv-wordmark span { color: #b4bacb; }
.tv3d .tv-foot-mid {
  position: absolute; left: 50%; transform: translateX(-50%);
  font: 500 9px var(--tv-mono); letter-spacing: 1.5px; color: #3f4659; white-space: nowrap;
}
.tv3d .tv-hint { display: flex; align-items: center; gap: 7px; font-size: 10px; color: #646b80; }
.tv3d .tv-labels { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.tv3d .tv-label {
  position: absolute; left: 0; top: 0; width: 184px; opacity: 0;
  transition: opacity 0.3s; will-change: transform; pointer-events: none;
}
.tv3d .tv-label.visible { opacity: 1; }
.tv3d .tv-stem { display: none; }
.tv3d .tv-label[data-side="left"] .tv-card { border-right: 2px solid var(--tv-accent); }
.tv3d .tv-label[data-side="right"] .tv-card { border-left: 2px solid var(--tv-accent); }
.tv3d .tv-label[data-side="top"] .tv-card { border-bottom: 2px solid var(--tv-accent); }
.tv3d .tv-card {
  padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(25, 230, 255, 0.25);
  background: rgba(10, 12, 20, 0.88); backdrop-filter: blur(10px); box-shadow: 0 8px 26px -10px rgba(0, 0, 0, 0.9);
}
.tv3d .tv-card-title { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.tv3d .tv-card-title span { font: 600 9.5px var(--tv-mono); color: var(--tv-accent); }
.tv3d .tv-card-meta { margin-top: 5px; font-size: 10px; line-height: 1.45; color: #8d94a8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tv3d .tv-tip {
  position: absolute; z-index: 10; max-width: 260px; padding: 11px 14px; border-radius: 10px; opacity: 0;
  pointer-events: none; transition: opacity 0.15s; border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(14, 16, 24, 0.94); backdrop-filter: blur(12px); box-shadow: 0 12px 34px -10px rgba(0, 0, 0, 0.9);
}
.tv3d .tv-tip.visible { opacity: 1; }
.tv3d .tv-tip strong { font-size: 12.5px; font-weight: 600; }
.tv3d .tv-tip strong span { margin-right: 8px; font: 600 10px var(--tv-mono); color: var(--tv-accent); }
.tv3d .tv-tip p { margin: 6px 0 0; font-size: 11px; line-height: 1.5; color: #9da3b5; }
.tv3d .tv-journey {
  position: absolute; top: 140px; left: 25%; right: 25%; display: flex; align-items: center; gap: 12px;
  opacity: 0; transform: translateY(-6px); transition: opacity 0.4s, transform 0.4s; pointer-events: none;
}
.tv3d .tv-journey.visible { opacity: 1; transform: none; }
.tv3d .tv-journey-icon {
  width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%;
  border: 1px solid rgba(25, 230, 255, 0.35); color: var(--tv-accent);
}
.tv3d .tv-journey strong { font-size: 12px; font-weight: 600; }
.tv3d .tv-journey small { display: block; margin-top: 3px; font-size: 10px; color: #858ca0; }
.tv3d .tv-track { flex: 1; height: 2px; margin-left: 8px; background: rgba(255, 255, 255, 0.07); }
.tv3d .tv-track i { display: block; width: 0; height: 100%; background: linear-gradient(90deg, var(--tv-accent), var(--tv-ok)); }
.tv3d .tv-loading {
  position: absolute; left: 50%; top: 48%; transform: translate(-50%, -50%); z-index: 20;
  display: flex; align-items: center; gap: 12px; font-size: 11px; color: #8a91a6; transition: opacity 0.4s;
}
.tv3d .tv-loading i {
  width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid rgba(25, 230, 255, 0.18);
  border-top-color: var(--tv-accent); animation: tv3d-spin 0.9s linear infinite;
}
.tv3d .tv-loading.done { opacity: 0; pointer-events: none; }
@keyframes tv3d-spin { to { transform: rotate(360deg); } }
.tv3d .tv-error {
  position: absolute; left: 27%; right: 27%; top: 38%; z-index: 21; display: none; padding: 24px;
  border-radius: 14px; border: 1px solid rgba(255, 77, 109, 0.3); background: #0e0f16; line-height: 1.6;
}
.tv3d .tv-error strong { color: var(--tv-alert); font-weight: 600; }
.tv3d .tv-error p { margin: 8px 0 0; color: #9da3b5; }
.tv3d .tv-error button { margin-top: 14px; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.14); background: #1a1d27; }
.tv3d.tv3d-embed :is(.tv-id, .tv-heading, .tv-side, .tv-foot) { display: none !important; }
.tv3d.tv3d-embed { background: transparent; }
.tv3d.tv3d-embed .tv-scene { touch-action: pan-y pinch-zoom; }
.tv3d.tv3d-embed .tv-top { justify-content: flex-end; }
.tv3d.tv3d-embed .tv-controls { bottom: 28px; }
.tv3d.tv3d-embed .tv-vignette { background: radial-gradient(ellipse at 70% 50%, transparent 35%, rgba(0, 0, 0, 0.5) 100%); }
@media (min-width: 901px) {
  .tv3d.tv3d-embed .tv-loading { left: 70%; }
  .tv3d.tv3d-embed .tv-error { left: 48%; right: 7%; }
  .tv3d.tv3d-embed .tv-controls { left: 42%; }
  .tv3d.tv3d-embed .tv-journey { top: 84px; left: 48%; right: 5%; }
}
@media (min-width: 1600px) {
  .tv3d .tv-top { inset: 36px 44px auto; }
  .tv3d .tv-heading { top: 136px; }
  .tv3d .tv-journey { top: 176px; }
  .tv3d .tv-controls { bottom: 96px; gap: 18px; }
  .tv3d .tv-modes button { padding: 12px 19px; font-size: 12.5px; }
  .tv3d .tv-cams button[data-camera] { font-size: 11.5px; padding: 5px 12px; }
  .tv3d .tv-foot { left: 44px; right: 44px; bottom: 34px; }
}
@media (max-width: 900px) {
  .tv3d .tv-top { inset: 20px 18px auto; }
  .tv3d .tv-status span:last-child { display: none; }
  .tv3d .tv-heading { left: 18px; right: 18px; top: 86px; font-size: 8.5px; letter-spacing: 1.2px; }
  .tv3d .tv-side, .tv3d .tv-foot-mid { display: none; }
  .tv3d .tv-journey { left: 18px; right: 18px; top: 116px; }
  .tv3d .tv-controls { left: 10px; right: 10px; bottom: 70px; gap: 12px; }
  .tv3d .tv-modes { gap: 1px; padding: 4px; border-radius: 12px; }
  .tv3d .tv-modes button { padding: 10px 9px; font-size: 10.5px; gap: 6px; }
  .tv3d .tv-modes button svg { width: 12px; height: 12px; }
  .tv3d .tv-cams { gap: 0; }
  .tv3d .tv-cams button[data-camera] { padding: 5px 7px; font-size: 9.5px; }
  .tv3d .tv-caption { display: none; }
  .tv3d .tv-foot { left: 18px; right: 18px; bottom: 22px; align-items: flex-end; }
  .tv3d .tv-hint { max-width: 150px; line-height: 1.5; font-size: 9px; }
  .tv3d .tv-label { width: 122px; }
  .tv3d .tv-card { padding: 7px 9px; }
  .tv3d .tv-card-meta { display: none; }
  .tv3d .tv-error { left: 6%; right: 6%; }
}
@media (max-width: 380px) {
  .tv3d .tv-modes button svg { display: none; }
  .tv3d .tv-modes button { padding: 9px 7px; }
  .tv3d .tv-status { display: none; }
}
@media (max-height: 580px) {
  .tv3d .tv-top { top: 14px; }
  .tv3d .tv-heading { top: 64px; }
  .tv3d .tv-journey { top: 88px; }
  .tv3d .tv-controls { bottom: 46px; gap: 8px; }
  .tv3d .tv-modes button { padding-top: 7px; padding-bottom: 7px; }
  .tv3d .tv-foot { bottom: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .tv3d, .tv3d * { transition: none !important; }
  .tv3d .tv-loading i { animation: none; }
}
`
