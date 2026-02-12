import axios from 'axios';
import https from 'https';
import {
    getMpesaConfig,
    getMpesaApiBaseUrl,
    validateMpesaConfig,
    type MpesaConfig
} from '../config/mpesa.config';
import { TransactionRepository } from '../repositories/transaction.repository';

export interface STKPushRequest {
    phone: string;
    amount: number;
    orderId: string;
    description?: string;
    accountReference?: string;
}

export interface STKPushResponse {
    merchantRequestId: string;
    checkoutRequestId: string;
    responseCode: string;
    responseDescription: string;
    customerMessage: string;
}

export interface TransactionQueryResponse {
    resultCode: string;
    resultDesc: string;
    merchantRequestId: string;
    checkoutRequestId: string;
    amount?: number;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    phoneNumber?: string;
}

export class MpesaService {
    private config: MpesaConfig;
    private baseUrl: string;
    private transactionRepo: TransactionRepository;

    private axiosInstance = axios.create({
        httpsAgent: new https.Agent({
            rejectUnauthorized: process.env.NODE_ENV === 'production',
        }),
        timeout: 30000,
    });

    constructor() {
        this.config = getMpesaConfig();
        validateMpesaConfig(this.config);
        this.baseUrl = getMpesaApiBaseUrl(this.config.environment);
        this.transactionRepo = new TransactionRepository();

        console.log(`💰 M-Pesa Service initialized in ${this.config.environment} mode`);
    }

    // ========== AUTHENTICATION ==========
    private async getAccessToken(): Promise<string> {
        try {
            const response = await this.axiosInstance.get(
                `${this.baseUrl}/oauth/v1/generate`,
                {
                    params: { grant_type: 'client_credentials' },
                    auth: {
                        username: this.config.consumerKey,
                        password: this.config.consumerSecret
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                }
            );

            if (!response.data.access_token) {
                throw new Error('No access token received');
            }

            return response.data.access_token;
        } catch (error: any) {
            console.error('M-Pesa Authentication Error:', {
                environment: this.config.environment,
                error: error.response?.data || error.message
            });
            throw new Error(`Failed to authenticate with M-Pesa: ${error.message}`);
        }
    }

    // ========== STK PUSH ==========
    async initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse> {
        try {
            // Validate phone number
            const phone = this.validateAndFormatPhone(request.phone);

            // Validate amount
            const amount = this.validateAmount(request.amount);

            // Get access token
            const accessToken = await this.getAccessToken();

            // Generate timestamp and password
            const timestamp = this.generateTimestamp();
            const password = this.generatePassword(timestamp);

            // Prepare payload
            const payload = {
                BusinessShortCode: this.config.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: phone,
                PartyB: this.config.shortCode,
                PhoneNumber: phone,
                CallBackURL: `${this.config.callbackUrl}/api/payments/mpesa/callback`,
                AccountReference: request.accountReference || request.orderId.substring(0, 12),
                TransactionDesc: request.description || `Payment for order ${request.orderId}`
            };

            console.log(`📱 Initiating STK Push:`, {
                orderId: request.orderId,
                amount,
                phone: phone.substring(0, 6) + '****',
                environment: this.config.environment
            });

            // Send request
            const response = await this.axiosInstance.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result: STKPushResponse = {
                merchantRequestId: response.data.MerchantRequestID,
                checkoutRequestId: response.data.CheckoutRequestID,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription,
                customerMessage: response.data.CustomerMessage
            };

            // Store transaction in database
            await this.transactionRepo.createTransaction({
                orderId: request.orderId,
                merchantRequestId: result.merchantRequestId,
                checkoutRequestId: result.checkoutRequestId,
                phone: phone,
                amount: amount,
                status: 'initiated',
                responseCode: result.responseCode,
                responseDescription: result.responseDescription,
                environment: this.config.environment
            });

            console.log(`✅ STK Push initiated: ${result.checkoutRequestId}`);
            return result;

        } catch (error: any) {
            console.error('STK Push Error:', {
                orderId: request.orderId,
                error: error.response?.data || error.message
            });

            // Log failed transaction
            await this.transactionRepo.createTransaction({
                orderId: request.orderId,
                phone: request.phone,
                amount: request.amount,
                status: 'failed',
                errorMessage: error.response?.data?.errorMessage || error.message,
                environment: this.config.environment
            });

            throw new Error(`STK Push failed: ${error.response?.data?.errorMessage || error.message}`);
        }
    }

    // ========== TRANSACTION QUERY ==========
    async queryTransaction(checkoutRequestId: string): Promise<TransactionQueryResponse> {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = this.generateTimestamp();
            const password = this.generatePassword(timestamp);

            const response = await this.axiosInstance.post(
                `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: this.config.shortCode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result: TransactionQueryResponse = {
                resultCode: response.data.ResultCode,
                resultDesc: response.data.ResultDesc,
                merchantRequestId: response.data.MerchantRequestID,
                checkoutRequestId: response.data.CheckoutRequestID
            };

            // Update transaction in database
            await this.transactionRepo.updateTransaction(checkoutRequestId, {
                status: result.resultCode === '0' ? 'completed' : 'failed',
                resultCode: result.resultCode,
                resultDescription: result.resultDesc,
                queryResponse: response.data
            });

            return result;

        } catch (error: any) {
            console.error('Transaction Query Error:', {
                checkoutRequestId,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    // ========== BUSINESS-TO-BUSINESS (B2B) ==========
    async b2bPayment(data: {
        receiverShortCode: string;
        amount: number;
        accountReference: string;
        remarks: string;
    }): Promise<any> {
        try {
            const accessToken = await this.getAccessToken();

            const response = await this.axiosInstance.post(
                `${this.baseUrl}/mpesa/b2b/v1/paymentrequest`,
                {
                    Initiator: this.config.initiatorName,
                    SecurityCredential: this.generateSecurityCredential(),
                    CommandID: 'BusinessPayBill',
                    SenderIdentifierType: '4',
                    ReceiverIdentifierType: '4',
                    Amount: data.amount,
                    PartyA: this.config.shortCode,
                    PartyB: data.receiverShortCode,
                    AccountReference: data.accountReference,
                    Requester: this.config.initiatorName,
                    Remarks: data.remarks
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error: any) {
            console.error('B2B Payment Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // ========== UTILITY METHODS ==========
    private validateAndFormatPhone(phone: string): string {
        // Remove all non-digits
        const cleaned = phone.replace(/\D/g, '');

        // Convert to 254 format if needed
        if (cleaned.startsWith('0') && cleaned.length === 10) {
            return '254' + cleaned.substring(1);
        }

        if (cleaned.startsWith('7') && cleaned.length === 9) {
            return '254' + cleaned;
        }

        if (!cleaned.startsWith('254') || cleaned.length !== 12) {
            throw new Error('Invalid phone number format. Use: 2547XXXXXXXX');
        }

        return cleaned;
    }

    private validateAmount(amount: number): number {
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }

        if (this.config.environment === 'production' && amount < 10) {
            throw new Error('Minimum amount for production is KES 10');
        }

        return Math.floor(amount);
    }

    private generateTimestamp(): string {
        const now = new Date();
        return [
            now.getFullYear(),
            (now.getMonth() + 1).toString().padStart(2, '0'),
            now.getDate().toString().padStart(2, '0'),
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0')
        ].join('');
    }

    private generatePassword(timestamp: string): string {
        return Buffer.from(
            this.config.shortCode + this.config.passKey + timestamp
        ).toString('base64');
    }

    private generateSecurityCredential(): string {
        // For production, you need to encrypt the initiator password
        // This is a simplified version - implement proper encryption
        if (this.config.environment === 'production') {
            // TODO: Implement proper encryption using OpenSSL
            // You'll need to use the public certificate from Safaricom
            console.warn('⚠️  Security credential encryption not implemented for production');
        }
        return this.config.initiatorPassword;
    }

    // ========== HEALTH CHECK ==========
    async healthCheck(): Promise<boolean> {
        try {
            const token = await this.getAccessToken();
            return !!token;
        } catch (error) {
            console.error('M-Pesa Health Check Failed:', error);
            return false;
        }
    }
}