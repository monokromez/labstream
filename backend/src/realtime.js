import { verifyAccessToken } from "./auth/accessToken.js";

function readCookie(cookieHeader, name) {
  const entry = String(cookieHeader ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}

export function configureRealtime(io, database) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  io.use(async (socket, next) => {
    if (!database) return next(new Error("DATABASE_NOT_ENABLED"));
    if (socket.handshake.headers.origin !== allowedOrigin) return next(new Error("ORIGIN_NOT_ALLOWED"));
    const token = readCookie(socket.handshake.headers.cookie, "labstream_session");
    const claims = verifyAccessToken(token, process.env.AUTH_TOKEN_SECRET);
    if (!claims) return next(new Error("AUTH_REQUIRED"));
    try {
      const [account] = await database.client.unsafe(
        `select id, clinic_id, role, is_active from public.users where id = $1 and clinic_id = $2`,
        [claims.sub, claims.clinicId],
      );
      if (!account?.is_active || account.role !== claims.role) return next(new Error("ACCOUNT_INACTIVE"));
      socket.data.user = { id: account.id, clinicId: account.clinic_id, role: account.role };
      return next();
    } catch (error) {
      return next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(`clinic:${socket.data.user.clinicId}`);
  });
}

export function publishCatalogChanged(io, clinicId) {
  io?.to(`clinic:${clinicId}`).emit("catalog:changed");
}
