import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { users } from '../data/users.js';

const JWT_ISSUER = 'node-security-demo';
const JWT_AUDIENCE = 'node-security-demo-client';

const ACCESS_TOKEN_TTL_SECONDS = 900;

export async function login(req, res) {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password) {
        return res.status(400).json({
            error: 'Email and password must be non-empty strings'
        });
    }

    const user = users.find(
        candidate => candidate.email === email
    );

    if (!user) {
        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }

    const passwordIsValid = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!passwordIsValid) {
        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }

    const accessToken = jwt.sign(
        {
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            subject: user.id,
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithm: 'HS256'
        }
    );

    return res.json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS
    });
}