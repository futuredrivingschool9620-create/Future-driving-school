export default async function handler(req: any, res: any) {
  try {
    const app = await import('../server/src/app.js');
    res.status(200).json({ message: 'App loaded successfully', keys: Object.keys(app) });
  } catch (err: any) {
    res.status(500).json({ 
      message: 'App failed to load', 
      error: err.message, 
      stack: err.stack,
      name: err.name
    });
  }
}
