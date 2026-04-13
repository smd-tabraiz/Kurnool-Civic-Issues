const axios = require('axios');

async function testRegister() {
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/auth/register', {
      name: 'Saketh',
      email: '249xa32131@gprec.ac.in',
      password: 'password123',
      location: 'Kurnool'
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Data:', err.response?.data);
    console.log('Error Message:', err.message);
  }
}

testRegister();
