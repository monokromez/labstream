import "dotenv/config";
import argon2 from "argon2";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { client } from "./db/index.js";

const staffRoles = new Set(["cashier", "medical_technologist", "pathologist", "administrator"]);

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can be hidden.");
  }

  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function finish(error) {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const prompts = createInterface({ input: stdin, output: stdout });
  const email = (await prompts.question("Staff email: ")).trim().toLowerCase();
  const role = (await prompts.question("Role (cashier, medical_technologist, pathologist, administrator): ")).trim();
  prompts.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid staff email address.");
  }
  if (!staffRoles.has(role)) throw new Error("Choose one of the listed staff roles.");

  const password = await readHidden("Password (12 characters minimum): ");
  const confirmation = await readHidden("Confirm password: ");
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  if (password !== confirmation) throw new Error("The passwords do not match.");

  const [existing] = await client`SELECT id FROM public.users WHERE lower(email) = ${email} LIMIT 1`;
  if (existing) throw new Error("An account already exists for that email.");

  const passwordHash = await argon2.hash(password);
  const [user] = await client`
    INSERT INTO public.users (email, password_hash, role)
    VALUES (${email}, ${passwordHash}, ${role})
    RETURNING id, email, role
  `;
  stdout.write(`Created ${user.role} account ${user.email} (${user.id}).\n`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
