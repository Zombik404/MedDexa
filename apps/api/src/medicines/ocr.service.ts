import { Injectable, Logger, type OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dirname, join } from 'node:path';
import type { Env } from '../config/env';

type Worker = { recognize(image: Buffer): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> };

/**
 * Reads the printed text on a photo of a medicine box with Tesseract (tesseract.js, bundled
 * English LSTM model — Latin-script product names and strengths read well with it).
 * Images are processed in memory and never stored.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private worker: Promise<Worker> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled() {
    return this.config.get('OCR_ENABLED', { infer: true });
  }

  private getWorker(): Promise<Worker> {
    this.worker ??= (async () => {
      const { createWorker } = await import('tesseract.js');
      const langPath = join(dirname(require.resolve('@tesseract.js-data/eng')), '4.0.0_best_int');
      const worker = await createWorker('eng', 1, { langPath, gzip: true, cacheMethod: 'none' });
      this.logger.log('OCR worker ready');
      return worker as unknown as Worker;
    })().catch((e: unknown) => {
      this.worker = null;
      throw e;
    });
    return this.worker;
  }

  async readLines(image: Buffer): Promise<string[]> {
    if (!this.enabled) throw new ServiceUnavailableException({ message: 'Photo search is disabled', code: 'OCR_DISABLED' });
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    return data.text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length >= 2);
  }

  async onModuleDestroy() {
    if (this.worker) await (await this.worker).terminate().catch(() => undefined);
  }
}
