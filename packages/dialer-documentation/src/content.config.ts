import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const evidenceSchema = z.object({
  source: z.string(),
  tests: z.array(z.string()).optional(),
  runtime: z.string().optional(),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        status: z.enum(['shipped', 'preview', 'planned', 'unresolved', 'deprecated']).optional(),
        evidence: z.array(evidenceSchema).optional(),
        verifiedAt: z.coerce.date().optional(),
      }),
    }),
  }),
};
