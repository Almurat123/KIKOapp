
import dotenv from 'dotenv';
import path from 'path';

// Load env from kiko-api/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const mockLayers = {
    user_size_layer: {
        user_size_level: 'L1',
        score: 100,
        reasons: ['Small probe amount']
    },
    liquidity_layer: {
        lp_depth_usd: 699077.16,
        slippage_estimate: 0.1,
        reasons: ['Strong liquidity']
    },
    structure_layer: {
        launchpad_type: 'unknown',
        structure_risk_score: 50,
        reasons: ['LP unlocked - rug risk']
    },
    stage_layer: {
        contract_age_minutes: 0,
        stage: 'S0',
        reasons: ['Just created (0 minutes)']
    },
    token_intelligence_layer: {
        risk_tags: ['high caution', 'limited info'],
        token_intelligence_score: 30,
        reasons: ['Project information is limited', 'Credibility questionable']
    }
};

async function run() {
    // Dynamic import to ensure process.env is populated BEFORE the module reads it
    const { generateJudgeRationale } = await import('../src/services/judge/grokTools.js');

    console.log('Testing generateJudgeRationale with ELSA token...');
    console.log('INTERNAL_SERVICE_KEY loaded:', !!process.env.INTERNAL_SERVICE_KEY);

    try {
        const result = await generateJudgeRationale(
            '0x29cc30f9d113b356ce408667aa6433589cecbdca',
            'ELSA',
            'ALLOW',
            mockLayers as any
        );
        console.log('\n✅ AI Summary Result:');
        console.log(result);
    } catch (error) {
        console.error('\n❌ Error:', error);
    }
}

run();
