import { Hono } from 'hono';
import { ConversationOrchestratorDO_2026A } from './src/durable/ConversationDO';

const app = new Hono();

app.get('/', (c) => {
  console.log("Root route hit");
  return c.text('Hello World');
});

app.get('/api/tasks', (c) => {
  console.log("Tasks route hit");
  return c.json({ tasks: [] });
});

export default app;
export { ConversationOrchestratorDO_2026A };