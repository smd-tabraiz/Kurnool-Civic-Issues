const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({});
  console.log('Users found:', users.map(u => u.email));
  process.exit();
}

checkUsers();
