import { createApp } from './app.js';

const PORT = Number(
    process.env.PORT ?? 3000
);

if (!process.env.JWT_SECRET) {
    throw new Error(
        'JWT_SECRET environment variable is required'
    );
}

const app = createApp();

app.listen(PORT, () => {
    console.log(
        `API running at http://localhost:${PORT}`
    );
});
