export type ConsueloDesignWorkflow =
  | 'website'
  | 'demo'
  | 'image'
  | 'digital-eguide'
  | 'email'
  | 'motion-frame';

export const CONSUELO_DESIGN_SYSTEM_FILES = [
  'packages/consuelo-website/DESIGN.md',
  'packages/consuelo-website/animations.md',
  'areas/website/AGENTS.md',
  'areas/consuelo-design/AGENTS.md',
] as const;

export const CONSUELO_DESIGN_UPSTREAM_PATH =
  'packages/consuelo-design/upstream/open-design' as const;
