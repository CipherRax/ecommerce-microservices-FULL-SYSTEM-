const axios = import('axios');

async function testDirect() {
    const consumerKey = 'fGocAOoaxVtFy05lrBay8cEXalMVGPZ7Z81Bry5dq5proYhA'
    const consumerSecret = 'F5dMwNjKlUpBdhiwjQQ2EeGBxmARIA55hw3qBbhN0twOK5jhoa0dFVisuSsxry7x'

    console.log('Testing with credentials:');
    console.log('Key:', consumerKey.substring(0, 10) + '...');
    console.log('Secret:', consumerSecret.substring(0, 10) + '...');

    try {
        // Method 1: Using GET with query parameters (Correct way)
        const response = await axios({
            method: 'GET',
            url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
            params: {
                grant_type: 'client_credentials'
            },
            auth: {
                username: consumerKey,
                password: consumerSecret
            },
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('\n✅ Success!');
        console.log('Status:', response.status);
        console.log('Token:', response.data.access_token?.substring(0, 20) + '...');
        console.log('Full response:', JSON.stringify(response.data, null, 2));
        return response.data.access_token;
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Headers:', error.response.headers);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

// Run test
testDirect()