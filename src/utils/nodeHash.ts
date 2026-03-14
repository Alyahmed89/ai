// Node Hash Utility
// Provides deterministic content hashing for nodes
// Uses Web Crypto API for Cloudflare Workers compatibility

/**
 * Interface for node data used in hash computation
 */
export interface NodeHashData {
  title: string;
  content: string | null;
  metadata: string | null;
}

/**
 * Creates a canonical string from node data for hashing
 * Format: JSON.stringify({title, content, metadata})
 * 
 * @param data Node data for hash computation
 * @returns Canonical JSON string
 */
export function createCanonicalString(data: NodeHashData): string {
  // Ensure consistent ordering and formatting
  const canonicalData = {
    title: data.title || '',
    content: data.content || null,
    metadata: data.metadata || null
  };
  
  return JSON.stringify(canonicalData);
}

/**
 * Computes SHA-256 hash of node data using Web Crypto API
 * 
 * @param data Node data for hash computation
 * @returns Promise resolving to SHA-256 hash as hex string
 */
export async function computeNodeHash(data: NodeHashData): Promise<string> {
  const canonicalString = createCanonicalString(data);
  
  // Encode the string as UTF-8
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(canonicalString);
  
  // Compute SHA-256 hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Validates if a node's hash matches its content
 * 
 * @param node Node data including hash
 * @returns Promise resolving to true if hash is valid, false otherwise
 */
export async function validateNodeHash(node: NodeHashData & { hash?: string | null }): Promise<boolean> {
  if (!node.hash) {
    return false; // No hash to validate against
  }
  
  const computedHash = await computeNodeHash(node);
  return computedHash === node.hash;
}

/**
 * Extracts hash data from a node object
 * 
 * @param node Node object
 * @returns NodeHashData for hash computation
 */
export function extractHashData(node: any): NodeHashData {
  return {
    title: node.title || '',
    content: node.content || null,
    metadata: node.metadata || null
  };
}