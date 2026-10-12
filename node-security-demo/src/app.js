import express from 'express';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import profileRoutes from './routes/profile.routes.js';

export function createApp() {
    const app = express();

    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({
            status: 'ok'
        });
    });

    app.use(
        '/auth',
        authRoutes
    );

    app.use(
        '/api/profile',
        profileRoutes
    );

    app.use(
        '/api/products',
        productRoutes
    );

    app.use((req, res) => {
        res.status(404).json({
            error: 'Route not found'
        });
    });

    // Los errores se gestionan después de las rutas y del handler de 404.
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);

        const status = Number.isInteger(err.status) &&
        err.status >= 400 && err.status < 600 ? err.status : 500;

        return res.status(status).json({
            error: err.type === 'entity.parse.failed'
                ? 'Invalid JSON body'
                : status >= 500 ? 'Internal server error' : 'Invalid request'
        });
    });

    return app;
}
