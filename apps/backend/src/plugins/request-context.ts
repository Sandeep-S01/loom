import "fastify";

export interface SessionUserContext {
  id: string;
  email: string;
  displayName: string;
}

declare module "fastify" {
  interface FastifyRequest {
    sessionUser: SessionUserContext | null;
  }
}
