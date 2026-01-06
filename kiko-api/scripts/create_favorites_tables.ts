
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgresql://almurat@localhost:5432/kiko_db',
});

const sql = `
CREATE TABLE IF NOT EXISTS favorite_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, chain, address)
);

CREATE TABLE IF NOT EXISTS token_rules (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    condition_value NUMERIC NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_user ON token_rules(user_id);
`;

async function run() {
    try {
        console.log("Creating tables...");
        await pool.query(sql);
        console.log("Tables created successfully.");
    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await pool.end();
    }
}

run();
