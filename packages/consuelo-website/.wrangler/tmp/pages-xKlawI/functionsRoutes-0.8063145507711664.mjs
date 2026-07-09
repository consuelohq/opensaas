import { onRequestGet as __t__action__ts_onRequestGet } from "/Users/kokayi/Dev/opensaas/packages/consuelo-website/functions/t/[action].ts"

export const routes = [
    {
      routePath: "/t/:action",
      mountPath: "/t",
      method: "GET",
      middlewares: [],
      modules: [__t__action__ts_onRequestGet],
    },
  ]