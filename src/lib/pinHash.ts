async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSalt(): string {
  return crypto.getRandomValues(new Uint8Array(16)).reduce(
    (acc, b) => acc + b.toString(16).padStart(2, "0"),
    ""
  );
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256(pin + salt);
}