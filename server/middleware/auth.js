const jwt = require('jsonwebtoken');

function getJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }

    if (process.env.NODE_ENV === 'production') {
        return null;
    }

    return 'dev-only-change-me';
}

function authenticateToken(req, res, next) {
    const secret = getJwtSecret();
    if (!secret) {
        return res.status(500).json({ error: 'JWT secret is not configured' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

module.exports = {
    authenticateToken,
    getJwtSecret
};
