import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import * as compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';

function resolveAdminDir(): string {
  const candidates = [
    join(__dirname, 'public', 'admin'),
    join(__dirname, '..', 'public', 'admin'),
    join(process.cwd(), 'public', 'admin'),
    join(process.cwd(), '..', 'admin'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) {
      return dir;
    }
  }
  return candidates[0];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const adminDir = resolveAdminDir();
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(compression());
  expressApp.use(express.json({ limit: '256kb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '256kb' }));

  expressApp.use('/admin', express.static(adminDir));
  expressApp.get(['/admin', '/admin/'], (_req, res) => {
    res.sendFile(join(adminDir, 'index.html'));
  });

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`SeaFishing API listening on http://localhost:${port}/api`);
  console.log(`Admin panel: http://localhost:${port}/admin/index.html`);
  console.log(`Admin static dir: ${adminDir}`);
}

bootstrap();
