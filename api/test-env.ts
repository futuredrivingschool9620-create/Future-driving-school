import { env } from '../server/src/config/env.js';

export default function handler(req: any, res: any) {
  res.status(200).json({ message: 'Env works', nodeEnv: env.NODE_ENV });
}
