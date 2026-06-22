import { RESERVED_HANDLE_SET } from './reservedHandles'
import {
  fetchOperatorHandle,
  registerOperatorRemote,
} from './supabase/api'
import { isSupabaseConfigured } from './supabase/client'
import { isValidOperatorName, sanitizeOperatorName } from './operatorName'

const REGISTRY_STORAGE_KEY = 'yami-operator-registry'
const HANDLE_CACHE_KEY = 'yami-operator-handle-cache'

interface OperatorRegistry {
  byWallet: Record<string, string>
  byName: Record<string, string>
}

export type RegisterOperatorCode =
  | 'INVALID'
  | 'TAKEN'
  | 'RESERVED'
  | 'WALLET_BOUND'
  | 'NETWORK'

export type RegisterOperatorResult =
  | { success: true; name: string }
  | { success: false; code: RegisterOperatorCode; message: string }

function loadRegistry(): OperatorRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY)
    if (!raw) return { byWallet: {}, byName: {} }
    const parsed = JSON.parse(raw) as OperatorRegistry
    return {
      byWallet: parsed.byWallet ?? {},
      byName: parsed.byName ?? {},
    }
  } catch {
    return { byWallet: {}, byName: {} }
  }
}

function saveRegistry(registry: OperatorRegistry): void {
  localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry))
}

function loadHandleCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HANDLE_CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function cacheHandleForWallet(walletPublicKey: string, handle: string): void {
  const cache = loadHandleCache()
  cache[walletPublicKey] = handle
  localStorage.setItem(HANDLE_CACHE_KEY, JSON.stringify(cache))
}

function registerOperatorLocal(
  name: string,
  walletPublicKey: string,
): RegisterOperatorResult {
  const registry = loadRegistry()
  const existingForWallet = registry.byWallet[walletPublicKey]
  const existingOwner = registry.byName[name]

  if (existingForWallet) {
    if (existingForWallet === name) {
      return { success: true, name: existingForWallet }
    }
    return {
      success: false,
      code: 'WALLET_BOUND',
      message: `This burner node is locked to ${existingForWallet}.`,
    }
  }

  if (existingOwner && existingOwner !== walletPublicKey) {
    return {
      success: false,
      code: 'TAKEN',
      message: 'Handle already claimed by another operator.',
    }
  }

  registry.byWallet[walletPublicKey] = name
  registry.byName[name] = walletPublicKey
  saveRegistry(registry)
  cacheHandleForWallet(walletPublicKey, name)

  return { success: true, name }
}

function validateHandle(rawName: string): RegisterOperatorResult | { ok: true; name: string } {
  const name = sanitizeOperatorName(rawName)

  if (!isValidOperatorName(name)) {
    return {
      success: false,
      code: 'INVALID',
      message: 'Handle must be 3–16 chars (A–Z, 0–9, _).',
    }
  }

  if (RESERVED_HANDLE_SET.has(name)) {
    return {
      success: false,
      code: 'RESERVED',
      message: 'Handle reserved by syndicate network.',
    }
  }

  return { ok: true, name }
}

export function getRegisteredNameForWallet(
  walletPublicKey: string | null,
): string | null {
  if (!walletPublicKey) return null

  const cache = loadHandleCache()
  if (cache[walletPublicKey]) return cache[walletPublicKey]

  const registry = loadRegistry()
  return registry.byWallet[walletPublicKey] ?? null
}

export async function ensureOperatorSyncedToRemote(
  walletPublicKey: string,
): Promise<RegisterOperatorResult | null> {
  if (!isSupabaseConfigured()) return null

  const localName = getRegisteredNameForWallet(walletPublicKey)
  if (!localName) return null

  const remote = await fetchOperatorHandle(walletPublicKey)
  if (remote) {
    if (remote !== localName) {
      registerOperatorLocal(remote, walletPublicKey)
    }
    return { success: true, name: remote }
  }

  const result = await registerOperatorRemote(localName, walletPublicKey)
  if (result.success) {
    registerOperatorLocal(result.name, walletPublicKey)
    return result
  }

  return result
}

export async function resolveRegisteredNameForWallet(
  walletPublicKey: string | null,
): Promise<string | null> {
  if (!walletPublicKey) return null

  if (isSupabaseConfigured()) {
    const remote = await fetchOperatorHandle(walletPublicKey)
    if (remote) {
      registerOperatorLocal(remote, walletPublicKey)
      return remote
    }

    const local = getRegisteredNameForWallet(walletPublicKey)
    if (local) {
      const sync = await ensureOperatorSyncedToRemote(walletPublicKey)
      if (sync?.success) return sync.name
      if (sync && !sync.success) {
        console.warn('[registry] local handle not on syndicate network:', sync.message)
      }
      return local
    }

    return null
  }

  return getRegisteredNameForWallet(walletPublicKey)
}

export async function registerOperatorAccount(
  rawName: string,
  walletPublicKey: string,
): Promise<RegisterOperatorResult> {
  const validated = validateHandle(rawName)
  if (!('ok' in validated)) return validated

  const { name } = validated

  if (isSupabaseConfigured()) {
    const remote = await registerOperatorRemote(name, walletPublicKey)
    if (remote.success) {
      registerOperatorLocal(remote.name, walletPublicKey)
      return remote
    }
    if (remote.code !== 'NETWORK') return remote
  }

  const existingLocal = getRegisteredNameForWallet(walletPublicKey)
  if (existingLocal) {
    if (existingLocal === name) {
      return { success: true, name: existingLocal }
    }
    return {
      success: false,
      code: 'WALLET_BOUND',
      message: `This burner node is locked to ${existingLocal}.`,
    }
  }

  return registerOperatorLocal(name, walletPublicKey)
}
