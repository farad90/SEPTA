import { Global, Module } from "@nestjs/common";
import { AtomicCounterService } from "./atomic-counter.service";

// Global, same convention as PrismaModule/RedisModule — the six number
// services across five different feature modules all need this without
// each of those modules having to import it individually.
@Global()
@Module({
  providers: [AtomicCounterService],
  exports: [AtomicCounterService],
})
export class AtomicCounterModule {}
