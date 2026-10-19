import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, Post, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import mongoose from 'mongoose';
import type { PublicTest, TestResult } from '@prostir/contracts';
import { tests } from './tests.data.js';
import { score } from './scoring.js';

config({ path: resolve(__dirname, '../../../.env') });
const TestModel = mongoose.model('Test', new mongoose.Schema({
  id: { type: String, required: true, unique: true }, title: String, category: String,
  desc: String, label: String, version: Number, questions: [[mongoose.Schema.Types.Mixed]],
}, { timestamps: true }));
function publicTest(test: typeof tests[number]): PublicTest {
  return { ...test, questions: test.questions.map(q => q[0]) };
}
@Controller()
class ApiController {
  @Get('health')
  health() {
    if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
      throw new ServiceUnavailableException('MongoDB недоступна.');
    }
    return { status: 'ok', database: process.env.MONGODB_URI ? 'connected' : 'demo', version: '0.2.1' };
  }
  @Get('tests')
  async catalog() {
    const definitions = process.env.MONGODB_URI ? await TestModel.find().lean() : tests;
    return definitions.map(t => publicTest(t as typeof tests[number]));
  }
  @Post('tests/:id/score')
  async calculate(@Param('id') id: string, @Body() input: unknown): Promise<TestResult> {
    const definition = process.env.MONGODB_URI
      ? await TestModel.findOne({ id }).lean() as typeof tests[number] | null
      : tests.find(t => t.id === id);
    if (!definition) throw new NotFoundException('Опитування не знайдено.');
    if (!input || typeof input !== 'object' || !('version' in input) || input.version !== definition.version) {
      throw new BadRequestException('Версія опитування змінилася. Оновіть сторінку.');
    }
    try {
      const result = score(definition, 'answers' in input ? input.answers : undefined);
      return { id, version: definition.version, ...result, date: new Date().toISOString() };
    } catch (error) { throw new BadRequestException((error as Error).message); }
  }
}
@Module({ controllers: [ApiController] })
class AppModule {}
async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    throw new Error('Для production потрібна MONGODB_URI.');
  }
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    for (const definition of tests) {
      await TestModel.updateOne({ id: definition.id }, { $setOnInsert: definition }, { upsert: true });
    }
  }
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1');
}
bootstrap().catch(error => { console.error(error.message); process.exit(1); });
