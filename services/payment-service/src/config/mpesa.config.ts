export interface MpesaConfig {
    environment: 'sandbox' | 'production';
    consumerKey: string;
    consumerSecret: string;
    shortCode: string;
    passKey: string;
    initiatorName: string;
    initiatorPassword: string;
    callbackUrl: string;
}

export const getMpesaConfig = (): MpesaConfig => {
    const environment = process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production';

    if (!environment || !['sandbox', 'production'].includes(environment)) {
        throw new Error('MPESA_ENVIRONMENT must be either "sandbox" or "production"');
    }

    return {
        environment,
        consumerKey: process.env.MPESA_CONSUMER_KEY!.trim(),
        consumerSecret: process.env.MPESA_CONSUMER_SECRET!.trim(),
        shortCode: process.env.MPESA_SHORTCODE!.trim(),
        passKey: process.env.MPESA_PASSKEY!.trim(),
        initiatorName: process.env.MPESA_INITIATOR_NAME!.trim(),
        initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD!.trim(),
        callbackUrl: process.env.PAYMENT_CALLBACK_URL!.trim(),
    };
};

export const getMpesaApiBaseUrl = (environment: 'sandbox' | 'production'): string => {
    return environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke'
        : 'https://api.safaricom.co.ke';
};

// Validation function
export const validateMpesaConfig = (config: MpesaConfig): void => {
    const required = [
        'consumerKey',
        'consumerSecret',
        'shortCode',
        'passKey',
        'initiatorName',
        'initiatorPassword',
        'callbackUrl'
    ];

    const missing = required.filter(field => !config[field as keyof MpesaConfig]);

    if (missing.length > 0) {
        throw new Error(`Missing M-Pesa config: ${missing.join(', ')}`);
    }
};