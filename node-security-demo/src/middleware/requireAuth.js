import jwt from 'jsonwebtoken';

const JWT_ISSUER = 'node-security-demo';
const JWT_AUDIENCE = 'node-security-demo-client';

export function requireAuth(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        res.set('WWW-Authenticate', 'Bearer');

        return res.status(401).json({
            error: 'Authorization header required'
        });
    }

    const match = /^Bearer +([^\s]+)$/i.exec(authorization);

    if (!match) {
        res.set('WWW-Authenticate', 'Bearer');

        return res.status(401).json({
            error: 'Invalid authorization header'
        });
    }

    const token = match[1];

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ['HS256'],
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            }
        );

        if (!payload || typeof payload !== 'object' ||
            typeof payload.sub !== 'string' || !payload.sub ||
            !['user', 'admin'].includes(payload.role) ||
            !Number.isInteger(payload.exp)) {
            throw new Error('Required token claims are missing or invalid');
        }

        req.user = {
            id: payload.sub,
            role: payload.role
        };

        next();
    } catch {
        res.set('WWW-Authenticate', 'Bearer');

        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
}