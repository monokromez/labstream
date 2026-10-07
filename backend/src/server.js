import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app.js";

const app = createApp();
const server = createServer(app);

export const io = new SocketServer(server, {
  cors: { origin: process.env.FRONTEND_ORIGIN },
});

io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    // Connection cleanup can be added as role-specific rooms are implemented.
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});
