export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/\*/g, '')
    .replace(/∞/g, 'inf')
    .replace(/∪/g, 'u')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/sqrt\(([^()]+)\)/g, 'sqrt$1')
    .replace(/(?<=\d),(?=\d)/g, '.')
    .replace(/пустоемножество|нетрешений|неткорней/g, '∅')
}
