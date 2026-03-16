let jsonMode = false;
let buffer: Record<string, any> = {};
let errorEnvelope: { success: false; error: string; message: string } | null = null;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function output(key: string, data: any): void {
  if (!jsonMode) return;
  buffer[key] = data;
}

export function outputError(code: string, message: string): void {
  errorEnvelope = { success: false, error: code, message };
}

export function flush(): void {
  if (errorEnvelope !== null) {
    process.stdout.write(JSON.stringify(errorEnvelope) + '\n');
    return;
  }

  if (Object.keys(buffer).length === 0) {
    return;
  }

  const envelope = { success: true, data: { ...buffer } };
  process.stdout.write(JSON.stringify(envelope) + '\n');
}

export function resetBuffer(): void {
  buffer = {};
  errorEnvelope = null;
  jsonMode = false;
}
