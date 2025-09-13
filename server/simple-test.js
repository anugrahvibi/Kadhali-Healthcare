const http = require('http');
const fs = require('fs');
const path = require('path');

function testUpload() {
  const testPdfPath = path.join(__dirname, 'test.pdf');
  
  if (!fs.existsSync(testPdfPath)) {
    console.log('Test PDF not found. Creating one...');
    const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF for Medical Analysis) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
299
%%EOF`;
    fs.writeFileSync(testPdfPath, testPdfContent);
  }

  const fileContent = fs.readFileSync(testPdfPath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
  
  const formData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.pdf"',
    'Content-Type: application/pdf',
    '',
    fileContent.toString('binary'),
    `--${boundary}`,
    'Content-Disposition: form-data; name="consent"',
    '',
    'true',
    `--${boundary}--`
  ].join('\r\n');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/upload/pdf',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(formData)
    }
  };

  console.log('Testing upload endpoint...');
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Upload test successful!');
      } else {
        console.log('❌ Upload test failed!');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.write(formData);
  req.end();
}

testUpload();
