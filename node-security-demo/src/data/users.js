import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const demoAccounts = [
    {
        id: 'user-1',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
    },
    {
        id: 'user-2',
        email: 'student@example.com',
        password: 'student123',
        role: 'user'
    }
];

export const users = await Promise.all(
    demoAccounts.map(async ({ password, ...user }) => {
        const passwordHash = await bcrypt.hash(
            password,
            SALT_ROUNDS
        );

        return {
            ...user,
            passwordHash
        };
    })
);