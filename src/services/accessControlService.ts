import { argon2id } from 'hash-wasm';
import { db } from '../db/db';

const SALT_LENGTH = 16;
const MEMORY_SIZE = 16 * 1024; // 16MB (Light enough for mobile, heavy enough for security)
const ITERATIONS = 20;

// Helper: Generate Random Salt
const generateSalt = (): Uint8Array => {
    return window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
};

// Helper: Convert Uint8Array to Hex
const toHex = (buffer: Uint8Array): string => {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

// Helper: Convert Hex to Uint8Array
const fromHex = (hex: string): Uint8Array => {
    const match = hex.match(/.{1,2}/g);
    return new Uint8Array(match ? match.map(byte => parseInt(byte, 16)) : []);
};

export const accessControlService = {
    // Hashes a password and returns "salt:hash" string
    async hashPassword(password: string): Promise<string> {
        const salt = generateSalt();
        const hash = await argon2id({
            password,
            salt,
            parallelism: 1,
            iterations: ITERATIONS,
            memorySize: MEMORY_SIZE,
            hashLength: 32,
            outputType: 'encoded' // Returns encoded string with params, but we want manual control? 
            // hash-wasm 'encoded' output is actually standard PHC format ($argon2id$...)
            // usage: await argon2id({ ... outputType: 'encoded' }) 
        });
        // hash-wasm encoded format includes salt and params. We can just use that directly!
        return hash;
    },

    // Verifies a password against a stored hash
    async verifyPassword(password: string, storedHash: string): Promise<boolean> {
        if (!storedHash) return false;
        // hash-wasm verify function is not built-in for encoded strings in the way needed?
        // Wait, hash-wasm returns the hash. We need to re-hash.
        // If we use 'encoded' output, it returns a string like $argon2id$v=19$m=...,t=...,p=...$salt$hash
        // But hash-wasm doesn't export a 'verify' function that takes that string and a password.
        // We have to parse the salt and params from the stored string?
        // Actually, simpler approach for manual control:

        // Let's stick to manual salt management for predictability if hash-wasm API is tricky.
        // BUT, argon2id function outputType: 'encoded' is standard.
        // To verify, we just need to re-run the hash with the SAME salt and params.

        // Let's implement manual split to be safe and robust.
        // Stored format: "saltHex:hashHex"

        const parts = storedHash.split(':');
        if (parts.length !== 2) return false; // Legacy or Invalid

        const saltHex = parts[0];
        const originalHashHex = parts[1];
        const salt = fromHex(saltHex);

        const computedHash = await argon2id({
            password,
            salt,
            parallelism: 1,
            iterations: ITERATIONS,
            memorySize: MEMORY_SIZE,
            hashLength: 32,
            outputType: 'hex'
        });

        return computedHash === originalHashHex;
    },

    // --- DB ACTIONS ---

    async setAdminPassword(password: string) {
        const salt = generateSalt();
        const hashHex = await argon2id({
            password,
            salt,
            parallelism: 1,
            iterations: ITERATIONS,
            memorySize: MEMORY_SIZE,
            hashLength: 32,
            outputType: 'hex'
        });
        const storedValue = `${toHex(salt)}:${hashHex}`;
        await db.settings.put({ key: 'auth_admin_hash', value: storedValue });
    },

    async setViewerPassword(password: string) {
        const salt = generateSalt();
        const hashHex = await argon2id({
            password,
            salt,
            parallelism: 1,
            iterations: ITERATIONS,
            memorySize: MEMORY_SIZE,
            hashLength: 32,
            outputType: 'hex'
        });
        const storedValue = `${toHex(salt)}:${hashHex}`;
        await db.settings.put({ key: 'auth_viewer_hash', value: storedValue });
    },

    async setRecovery(questions: { q: string; a: string }[]) {
        // Hash the answers combined. 
        // Strategy: Normalize answers (lowercase, trim) and join them.
        const combined = questions
            .map(item => item.q + '||' + item.a.trim().toLowerCase())
            .join('__');

        // Encrypt/Hash this blob? 
        // Actually, we just need to verify them. Hashing is fine.
        const salt = generateSalt();
        const hashHex = await argon2id({
            password: combined,
            salt,
            parallelism: 1,
            iterations: ITERATIONS,
            memorySize: MEMORY_SIZE,
            hashLength: 32,
            outputType: 'hex'
        });
        const storedValue = `${toHex(salt)}:${hashHex}`;

        // Also store the QUESTIONS (plain text) so we can ask them back.
        // But NOT the answers.
        const questionsOnly = questions.map(q => q.q);

        await db.settings.put({ key: 'auth_recovery_hash', value: storedValue });
        await db.settings.put({ key: 'auth_recovery_questions', value: JSON.stringify(questionsOnly) });
    },

    async verifyAdmin(password: string): Promise<boolean> {
        const setting = await db.settings.get('auth_admin_hash');
        if (!setting) return false;
        return this.verifyPassword(password, setting.value);
    },

    async verifyViewer(password: string): Promise<boolean> {
        const setting = await db.settings.get('auth_viewer_hash');
        if (!setting) return false;
        return this.verifyPassword(password, setting.value);
    },

    async verifyRecovery(answers: string[]): Promise<boolean> {
        const storedHash = await db.settings.get('auth_recovery_hash');
        const storedQs = await db.settings.get('auth_recovery_questions');
        if (!storedHash || !storedQs) return false;

        const questions: string[] = JSON.parse(storedQs.value);
        if (questions.length !== answers.length) return false;

        const combined = questions
            .map((q, i) => q + '||' + answers[i].trim().toLowerCase())
            .join('__');

        return this.verifyPassword(combined, storedHash.value);
    },

    async getRecoveryQuestions(): Promise<string[]> {
        const storedQs = await db.settings.get('auth_recovery_questions');
        if (!storedQs) return [];
        return JSON.parse(storedQs.value);
    },

    async hasAdminPassword(): Promise<boolean> {
        const s = await db.settings.get('auth_admin_hash');
        return !!s;
    },

    async hasViewerPassword(): Promise<boolean> {
        const s = await db.settings.get('auth_viewer_hash');
        return !!s;
    }
};
