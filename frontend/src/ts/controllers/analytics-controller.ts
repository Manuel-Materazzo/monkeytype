export async function log(
  _eventName: string,
  _params?: Record<string, string>,
): Promise<void> {
  // no-op: analytics disabled
}

export function activateAnalytics(): void {
  // no-op: analytics disabled
}
