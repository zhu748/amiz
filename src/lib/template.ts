const TEMPLATE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(TEMPLATE_RE, (_, key: string) => vars[key] ?? "");
}
