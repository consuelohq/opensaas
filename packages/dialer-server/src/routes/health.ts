import { Hono } from 'hono';

export const createHealthRoutes = () => {
  const routes = new Hono();
  routes.get('/health', (context) =>
    context.json({ service: 'dialer-server', status: 'ok' }),
  );
  return routes;
};
