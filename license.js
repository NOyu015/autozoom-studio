// License gating. Key + last verification result are cached in localStorage.
const LS_KEY = 'az.license';

import { LICENSE_API } from './config.js';

/**
 * Verify a license key through our serverless proxy (/api/license -> Creem).
 * First call activates the key and returns an instance_id; later calls validate that instance.
 * @returns {Promise<{valid:boolean, plan?:string, reason?:string, instance_id?:string}>}
 */
export async function verifyLicense(key, instanceId) {
  key = (key || '').trim();
  if (!key) return { valid: false, reason: 'empty' };
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (isLocal && /^AZPRO-[A-Z0-9-]{4,}$/i.test(key)) return { valid: true, plan: 'pro' }; // local dev key
  try {
    const r = await fetch(LICENSE_API, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, instance_id: instanceId || undefined }),
    });
    const j = await r.json();
    return j && typeof j.valid === 'boolean' ? j : { valid: false, reason: 'bad_response' };
  } catch {
    return { valid: false, reason: 'network', offline: true };
  }
}

export function getStored() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; }
}
export function isPro() { const s = getStored(); return !!(s && s.valid); }

export async function activate(key) {
  const res = await verifyLicense(key);
  if (res.valid) localStorage.setItem(LS_KEY, JSON.stringify({ key: key.trim(), ...res, checkedAt: Date.now() }));
  return res;
}
export function deactivate() { localStorage.removeItem(LS_KEY); }

/** Re-check the cached key on startup (drops it if no longer valid). */
export async function recheck() {
  const s = getStored();
  if (!s) return false;
  const res = await verifyLicense(s.key, s.instance_id);
  if (res.offline) return true; // keep Pro when offline; re-check next time
  if (!res.valid) deactivate();
  return res.valid;
}
