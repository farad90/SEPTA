// DI token for the shared ioredis client — injected via
// `@Inject(REDIS_CLIENT) private readonly redis: Redis`.
export const REDIS_CLIENT = Symbol("REDIS_CLIENT");
