import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // CORS_ORIGIN می‌تونه چند origin با کاما باشه؛ خارج از production هر پورت localhost هم مجازه
  // (Vite در dev ممکنه پورت آزاد بعدی رو برداره — بدون این، هر تغییر پورت نیاز به ویرایش .env داشت)
  const allowedOrigins = (config.get<string>("CORS_ORIGIN") ?? "").split(",").map((o) => o.trim());
  const isProduction = process.env.NODE_ENV === "production";
  app.enableCors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && /^http:\/\/localhost:\d+$/.test(origin));
      callback(null, allowed);
    },
    credentials: true,
  });

  const port = config.get<number>("PORT") ?? 3000;
  await app.listen(port);
}

bootstrap();
