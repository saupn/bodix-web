/**
 * Replace {variable_name} placeholders in a template string.
 * Missing variables are left as-is (e.g. "{name}" stays "{name}").
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = variables[key]
    return value !== undefined && value !== null ? String(value) : match
  })
}
