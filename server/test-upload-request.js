const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testUpload() {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(path.join(__dirname, 'test.pdf')));
    form.append('consent', 'true');

    console.log('Testing upload endpoint...');
    
    const response = await fetch('http://localhost:3001/api/upload/pdf', {
      method: 'POST',
      body: form
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Upload test successful!');
    } else {
      console.log('❌ Upload test failed!');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testUpload();
