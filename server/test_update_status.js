const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testUpdate() {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@kurnool.gov.in',
      password: 'Admin@123456'
    });
    const token = loginRes.data.token;
    console.log('Got token');

    const form = new FormData();
    form.append('status', 'in-progress');
    form.append('message', 'Test');
    
    // We can also test with a file
    // form.append('image', fs.createReadStream('test.jpg'));

    const res = await axios.put('http://localhost:5000/api/issues/69dd5f5b0d5471e79b2877a8/status', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

testUpdate();
