import "fastify";

export interface SessionUserContext {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "customer";
}

declare module "fastify" {
  interface FastifyRequest {
    sessionUser: SessionUserContext | null;
  }
}
