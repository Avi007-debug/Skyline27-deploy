import { env } from './config/env';
import app from './app';

if (require.main === module) {
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server cleanly listening on port ${env.port}`);
  });
}

export default app;
export { app };
