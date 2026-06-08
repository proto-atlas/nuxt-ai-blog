import app from '../.output/server/index.mjs';
import { DurableObject } from 'cloudflare:workers';
import {
  GlobalSummaryQuotaDO as GlobalSummaryQuotaLogic,
  SummaryCacheDO as SummaryCacheLogic,
} from '../server/utils/summary-durable-objects.ts';

export class SummaryCacheDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.logic = new SummaryCacheLogic(ctx);
  }

  inspect(input) {
    return this.logic.inspect(input);
  }

  claim(input) {
    return this.logic.claim(input);
  }

  wait(input) {
    return this.logic.wait(input);
  }

  store(input) {
    return this.logic.store(input);
  }

  release(input) {
    return this.logic.release(input);
  }
}

export class GlobalSummaryQuotaDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.logic = new GlobalSummaryQuotaLogic(ctx);
  }

  reserveDailyGeneration(input) {
    return this.logic.reserveDailyGeneration(input);
  }

  markGenerationSucceeded(input) {
    return this.logic.markGenerationSucceeded(input);
  }

  markGenerationFailedAfterUpstreamCall(input) {
    return this.logic.markGenerationFailedAfterUpstreamCall(input);
  }
}

export default app;
