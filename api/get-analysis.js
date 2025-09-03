import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'ID is required.' });
    }

    try {
        const analysisData = await kv.get(id);

        if (analysisData) {
            return res.status(200).json(analysisData);
        } else {
            return res.status(404).json({ error: 'Analysis not found.' });
        }
    } catch (error) {
        console.error('KV Error:', error);
        return res.status(500).json({ error: 'Failed to retrieve data from storage.' });
    }
}
