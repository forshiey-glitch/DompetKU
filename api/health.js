export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    zaiConfigured: Boolean(process.env.ZAI_API_KEY && process.env.ZAI_API_KEY !== 'your_z_ai_api_key_here'),
    openrouterConfigured: Boolean(
      process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here'
    ),
    geminiFallbackConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
}
