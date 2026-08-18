import crypto from "crypto";

export function hashPassword(pw: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(pw + "|" + salt, "utf8")
    .digest("hex");
}

export function randomSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
