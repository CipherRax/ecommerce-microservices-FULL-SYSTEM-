import axios from 'axios';
import https from 'https';

export class MpesaService {
    private consumerKey: string;
    private consumerSecret: string;
    private shortCode: string;
    private passKey: string;
    private callbackUrl: string;

    constructor() {
        // Trim whitespace from credentials
        this.consumerKey = process.env.MPESA_CONSUMER_KEY!.trim();
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET!.trim();
        this.shortCode = process.env.MPESA_SHORTCODE!.trim();
        this.passKey = process.env.MPESA_PASSKEY!.trim();
        this.callbackUrl = process.env.PAYMENT_CALLBACK_URL!.trim();
    }

    // Custom axios instance for Daraja
    private darajaAxios = axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
        }),
        timeout: 30000,
    });

    async getAccessToken(): Promise<string> {
        try {
            console.log('Getting token with key:', this.consumerKey.substring(0, 10) + '...');

            const response = await this.darajaAxios.get(
                'https://sandbox.safaricom.co.ke/oauth/v1/generate',
                {
                    params: {
                        grant_type: 'client_credentials'
                    },
                    auth: {
                        username: this.consumerKey,
                        password: this.consumerSecret
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                }
            );

            if (!response.data.access_token) {
                throw new Error('No access token in response');
            }

            return response.data.access_token;
        } catch (error: any) {
            console.error('Token Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    auth: error.config?.auth ? 'Present' : 'Missing'
                }
            });
            throw error;
        }
    }

    async initiateSTKPush(phone: string, amount: number, orderId: string): Promise<any> {
        try {
            // Get access token
            const accessToken = await this.getAccessToken();
            console.log('Access token received:', accessToken.substring(0, 20) + '...');

            // Generate timestamp (YYYYMMDDHHmmss)
            const now = new Date();
            const timestamp =
                now.getFullYear().toString() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0') +
                now.getHours().toString().padStart(2, '0') +
                now.getMinutes().toString().padStart(2, '0') +
                now.getSeconds().toString().padStart(2, '0');

            // Generate password
            const password = Buffer.from(
                this.shortCode + this.passKey + timestamp
            ).toString('base64');

            // Prepare payload
            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.floor(amount),
                PartyA: phone,
                PartyB: this.shortCode,
                PhoneNumber: phone,
                CallBackURL: `${this.callbackUrl}/mpesa/callback`,
                AccountReference: orderId.substring(0, 12),
                TransactionDesc: 'Order Payment'
            };

            console.log('STK Push payload:', {
                ...payload,
                Password: '***hidden***',
                Timestamp: timestamp
            });

            // Send STK Push request
            const response = await this.darajaAxios.post(
                'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            console.error('STK Push Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }
}