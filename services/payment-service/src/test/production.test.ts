import { MpesaService } from '../src/services/mpesa.service';

async function testProduction() {
    console.log('Testing M-Pesa Production Integration...');

    const mpesaService = new MpesaService();

    try {
        // Test 1: Health check
        console.log('🧪 Testing health check...');
        const healthy = await mpesaService.healthCheck();
        console.log(`Health check: ${healthy ? '✅ PASS' : '❌ FAIL'}`);

        if (!healthy) {
            throw new Error('M-Pesa is not accessible');
        }

        // Test 2: Small payment (KES 10 minimum for production)
        console.log('🧪 Testing STK Push...');
        const result = await mpesaService.initiateSTKPush({
            phone: '2547XXXXXXXX', // Use a real Safaricom number
            amount: 10,
            orderId: 'PROD-TEST-001',
            description: 'Production test payment'
        });

        console.log('✅ STK Push initiated:', {
            checkoutRequestId: result.checkoutRequestId,
            message: result.customerMessage
        });

        console.log('\n📋 Test Results:');
        console.log('✅ M-Pesa production integration is working!');
        console.log('⚠️  Check phone for M-Pesa prompt');
        console.log(`🔗 Checkout ID: ${result.checkoutRequestId}`);

    } catch (error: any) {
        console.error('❌ Production test failed:', error.message);
        console.error('Details:', error.response?.data || error.stack);
    }
}

testProduction();