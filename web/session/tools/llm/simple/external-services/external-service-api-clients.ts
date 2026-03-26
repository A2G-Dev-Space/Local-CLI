/**
 * External Service API Clients
 *
 * No-op for local-web: no ONCE/FREE services available.
 * Function signatures preserved for callers (once-tools.ts, background-sync.ts, index.ts).
 *
 * CLI parity: electron/main/tools/llm/simple/external-services/external-service-api-clients.ts
 */

/**
 * Get current user info (returns null — no Dashboard auth in local-web)
 */
export async function getCurrentUserInfo(): Promise<{ email: string; displayName: string } | null> {
  return null;
}

// =============================================================================
// ONCE API Functions (no-op)
// =============================================================================

export async function onceNoteAdd(_content: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return { success: false, error: 'ONCE service not available in local-web' };
}

export async function onceSearch(_query: string): Promise<{ success: boolean; result?: string; error?: string }> {
  return { success: false, error: 'ONCE service not available in local-web' };
}

// =============================================================================
// FREE API Functions (no-op)
// =============================================================================

export async function freeWorkList(_params?: {
  date?: string;
}): Promise<{ success: boolean; items?: Array<{ id: string; title: string; content: string; date: string }>; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeWorkUpdate(_params: {
  itemId: string;
  title?: string;
  content?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeWorkAdd(_items: Array<{
  title: string;
  content?: string;
  date?: string;
}>): Promise<{ success: boolean; message?: string; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeTodoList(_params?: {
  completed?: boolean;
}): Promise<{ success: boolean; todos?: Array<{ id: string; title: string; content: string; endDate: string | null; completed: boolean }>; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeTodoAdd(_params: {
  title: string;
  content?: string;
  endDate?: string;
}): Promise<{ success: boolean; todo?: { id: string; title: string }; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeTodoUpdate(_params: {
  todoId: string;
  title?: string;
  content?: string;
  completed?: boolean;
  endDate?: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}

export async function freeTodoDelete(_params: {
  todoId: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'FREE service not available in local-web' };
}
