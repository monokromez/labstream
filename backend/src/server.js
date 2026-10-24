import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app.js";
import { createDatabase } from "./db/index.js";
import { configureRealtime } from "./realtime.js";

// Database use is intentionally opt-in. A DATABASE_URL in .env is not enough
// to connect; explicitly set DATABASE_ENABLED=true when ready to enable it.
const databaseEnabled = process.env.DATABASE_ENABLED === "true";
if (databaseEnabled && (!process.env.AUTH_TOKEN_SECRET || Buffer.byteLength(process.env.AUTH_TOKEN_SECRET) < 32)) {
  throw new Error("Set AUTH_TOKEN_SECRET to a random value of at least 32 bytes before enabling the database.");
}
const database = databaseEnabled
  ? createDatabase({ connectionString: process.env.DATABASE_URL })
  : null;

let io;
const app = createApp({
  database,
  publishCatalogChanged: (clinicId) => io?.to(`clinic:${clinicId}`).emit("catalog:changed"),
  publishClinicChanged: (clinicId) => io?.to(`clinic:${clinicId}`).emit("clinic:changed"),
});
const server = createServer(app);
io = new SocketServer(server, {
  cors: { origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173", credentials: true },
});
configureRealtime(io, database);

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}; database ${database ? "enabled" : "disabled"}`);
});

async function shutdown() {
  server.close();
  if (database) await database.close();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
