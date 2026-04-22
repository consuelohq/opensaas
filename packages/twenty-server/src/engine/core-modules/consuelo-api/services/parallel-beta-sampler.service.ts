import { Injectable } from '@nestjs/common';

import type { BetaSampler } from '@consuelo/dialer';

@Injectable()
export class ParallelBetaSamplerService implements BetaSampler {
  sample(alpha: number, beta: number): number {
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);

    if (x <= 0 && y <= 0) {
      return 0.5;
    }

    return x / (x + y);
  }

  private sampleGamma(shape: number): number {
    if (shape <= 0) {
      return 0;
    }

    if (shape < 1) {
      const uniform = Math.random();

      return this.sampleGamma(shape + 1) * Math.pow(uniform, 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      const normal = this.sampleStandardNormal();
      const x = 1 + c * normal;

      if (x <= 0) {
        continue;
      }

      const v = x * x * x;
      const uniform = Math.random();

      if (uniform < 1 - 0.0331 * normal * normal * normal * normal) {
        return d * v;
      }

      if (Math.log(uniform) < 0.5 * normal * normal + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  private sampleStandardNormal(): number {
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();

    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
