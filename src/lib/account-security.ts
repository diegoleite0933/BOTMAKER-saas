export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "diegoleite0933@gmail.com").trim().toLowerCase();

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function normalizeCpf(value: unknown): string | null {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^([0-9])\1{10}$/.test(cpf)) return null;

  const digits = cpf.split("").map(Number);
  const calculateDigit = (values: number[], weight: number) => {
    const sum = values.reduce((total, digit, index) => total + digit * (weight - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  if (calculateDigit(digits.slice(0, 9), 10) !== digits[9]) return null;
  if (calculateDigit(digits.slice(0, 10), 11) !== digits[10]) return null;

  return cpf;
}