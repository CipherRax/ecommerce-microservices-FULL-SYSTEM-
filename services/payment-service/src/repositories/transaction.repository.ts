import { Firestore } from 'firebase-admin/firestore';
import { firestore } from '../firebase';

export interface Transaction {
    id?: string;
    orderId: string;
    merchantRequestId?: string;
    checkoutRequestId?: string;
    phone: string;
    amount: number;
    status: 'initiated' | 'pending' | 'completed' | 'failed' | 'cancelled';
    responseCode?: string;
    responseDescription?: string;
    resultCode?: string;
    resultDescription?: string;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    errorMessage?: string;
    queryResponse?: any;
    callbackData?: any;
    environment: 'sandbox' | 'production';
    createdAt: Date;
    updatedAt: Date;
}

export class TransactionRepository {
    private collection: FirebaseFirestore.CollectionReference;

    constructor() {
        this.collection = firestore.collection('mpesa_transactions');
    }

    async createTransaction(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const timestamp = new Date();
        const transactionData = {
            ...data,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const docRef = await this.collection.add(transactionData);
        return docRef.id;
    }

    async updateTransaction(checkoutRequestId: string, updates: Partial<Transaction>): Promise<void> {
        const snapshot = await this.collection
            .where('checkoutRequestId', '==', checkoutRequestId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            throw new Error(`Transaction not found: ${checkoutRequestId}`);
        }

        const docRef = snapshot.docs[0].ref;
        await docRef.update({
            ...updates,
            updatedAt: new Date()
        });
    }

    async findByCheckoutRequestId(checkoutRequestId: string): Promise<Transaction | null> {
        const snapshot = await this.collection
            .where('checkoutRequestId', '==', checkoutRequestId)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Transaction;
    }

    async findByOrderId(orderId: string): Promise<Transaction[]> {
        const snapshot = await this.collection
            .where('orderId', '==', orderId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Transaction[];
    }
}