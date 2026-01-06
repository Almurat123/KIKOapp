/**
 * Dune Farcaster Service
 * Handles fetching quality Farcaster users from Dune Analytics
 * Note: Dune integration is currently disabled. Using local JSON file instead.
 */

import { env } from '../config/env.js';

const DUNE_API_KEY = process.env.DUNE_API_KEY || '';

/**
 * Check if Dune is configured
 */
export function isDuneConfigured(): boolean {
    return Boolean(DUNE_API_KEY && DUNE_API_KEY.length > 0);
}

/**
 * Fetch quality users from Dune Analytics
 * Currently returns empty array as Dune is disabled
 */
export async function fetchQualityUsersFromDune(): Promise<any[]> {
    if (!isDuneConfigured()) {
        console.log('[DuneFarcaster] Dune API not configured, skipping fetch');
        return [];
    }

    // Dune integration disabled - use local JSON file instead
    console.log('[DuneFarcaster] Dune fetch disabled, returning empty array');
    return [];
}

/**
 * Get quality users (stub for compatibility)
 */
export async function getQualityUsers(): Promise<any[]> {
    return [];
}

export default {
    isDuneConfigured,
    fetchQualityUsersFromDune,
    getQualityUsers,
};
