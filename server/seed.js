require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Issue = require('./models/Issue');
const Comment = require('./models/Comment');
const Notification = require('./models/Notification');

const ADMIN_KEY = 'Shamstabraiz@911';

const sampleIssues = [
  // ROAD ISSUES
  { title: 'Massive pothole near Kurnool Bus Stand', description: 'A dangerous pothole has formed near the main bus stand entrance. Multiple two-wheelers have skidded here. The pothole is about 3 feet wide and 1 foot deep. Needs immediate repair before someone gets seriously injured.', issueType: 'road', area: 'Kurnool City', status: 'pending', daysAgo: 2, upvotes: 45 },
  { title: 'Road completely damaged on NH-44 near Adoni', description: 'The national highway stretch between Kurnool and Adoni has severe damage for about 2 km. Heavy trucks have made it worse during monsoon. Travel time has doubled due to this stretch.', issueType: 'road', area: 'Adoni', status: 'in-progress', daysAgo: 15, upvotes: 78 },
  { title: 'No street lights on Nandyal main road', description: 'Street lights have not been working for the past 3 months on the main road connecting Nandyal bus stand to the railway station. It is very dark and unsafe at night, especially for women.', issueType: 'road', area: 'Nandyal', status: 'pending', daysAgo: 30, upvotes: 32 },
  { title: 'Bridge cracks on Tungabhadra river crossing', description: 'Visible cracks have appeared on the old bridge crossing Tungabhadra river near Mantralayam road. Heavy vehicles are still using it despite the danger. Engineers need to inspect immediately.', issueType: 'road', area: 'Mantralayam', status: 'pending', daysAgo: 5, upvotes: 120 },
  { title: 'Unfinished road work in Dhone town', description: 'Road construction started 6 months ago but was abandoned midway. The half-dug road is causing accidents and dust pollution in the residential area.', issueType: 'road', area: 'Dhone', status: 'in-progress', daysAgo: 45, upvotes: 28 },
  { title: 'Speed breakers needed near school in Allagadda', description: 'Multiple accidents have occurred near the government school on the highway in Allagadda. Children are at risk. Speed breakers and zebra crossings are urgently needed.', issueType: 'road', area: 'Allagadda', status: 'resolved', daysAgo: 60, upvotes: 55 },

  // POWER ISSUES
  { title: 'Daily 6-hour power cuts in Yemmiganur', description: 'For the past two weeks, Yemmiganur has been experiencing 6+ hours of power cuts daily. This is affecting small businesses, students studying for exams, and elderly people who need fans in this heat.', issueType: 'power', area: 'Yemmiganur', status: 'pending', daysAgo: 3, upvotes: 92 },
  { title: 'Transformer explosion in Kodumur village', description: 'The transformer near Kodumur village center exploded last night. The entire village of 500+ families has no electricity. The old transformer was overloaded and needs replacement.', issueType: 'power', area: 'Kodumur', status: 'in-progress', daysAgo: 1, upvotes: 67 },
  { title: 'Exposed electric wires near Pattikonda market', description: 'High tension wires are hanging dangerously low near the weekly market area in Pattikonda. During rain, there is serious risk of electrocution. Multiple complaints filed but no action taken.', issueType: 'power', area: 'Pattikonda', status: 'pending', daysAgo: 10, upvotes: 41 },
  { title: 'Frequent voltage fluctuations in Atmakur', description: 'Severe voltage fluctuations are damaging home appliances across Atmakur. Three houses reported TV and refrigerator damage this month alone. The local transformer needs a stabilizer.', issueType: 'power', area: 'Atmakur', status: 'resolved', daysAgo: 25, upvotes: 19 },
  { title: 'Street lights not working in Nandikotkur', description: 'More than 50 street lights in Nandikotkur town center have been non-functional for 2 months. The municipal office has not responded to complaints.', issueType: 'power', area: 'Nandikotkur', status: 'pending', daysAgo: 40, upvotes: 15 },

  // WATER ISSUES
  { title: 'No drinking water supply for 5 days in Gudur', description: 'Gudur village has not received piped water supply for 5 consecutive days. Families are forced to walk 3 km to fetch water from a bore well. Children and elderly are suffering the most.', issueType: 'water', area: 'Gudur', status: 'pending', daysAgo: 1, upvotes: 88 },
  { title: 'Contaminated water supply in Koilkuntla', description: 'The tap water in Koilkuntla has turned yellowish and has a foul smell. Several children have fallen sick with diarrhea after drinking this water. Water quality testing is urgently needed.', issueType: 'water', area: 'Koilkuntla', status: 'in-progress', daysAgo: 7, upvotes: 73 },
  { title: 'Sewage mixing with drinking water in Banaganapalle', description: 'Due to old and damaged pipelines, sewage water is mixing with the drinking water supply in ward 5 of Banaganapalle. This is a severe health hazard affecting 200+ families.', issueType: 'water', area: 'Banaganapalle', status: 'pending', daysAgo: 12, upvotes: 95 },
  { title: 'Bore well dried up in Bethamcherla', description: 'The main community bore well in Bethamcherla has dried up due to falling groundwater levels. The village needs a new deeper bore well or an alternative water source.', issueType: 'water', area: 'Bethamcherla', status: 'in-progress', daysAgo: 20, upvotes: 36 },
  { title: 'Water tank overflow causing flooding in Orvakal', description: 'The overhead water tank in Orvakal has a broken float valve, causing daily overflow. The wasted water floods nearby houses and roads, creating breeding ground for mosquitoes.', issueType: 'water', area: 'Orvakal', status: 'resolved', daysAgo: 35, upvotes: 22 },

  // HEALTH ISSUES
  { title: 'No doctor at Srisailam PHC for 3 months', description: 'The Primary Health Center in Srisailam has been without a doctor for 3 months. Patients are forced to travel 60 km to Kurnool for basic medical care. Pregnant women are at highest risk.', issueType: 'health', area: 'Srisailam', status: 'pending', daysAgo: 8, upvotes: 105 },
  { title: 'Dengue outbreak in Adoni reported', description: 'Multiple dengue cases have been reported in Adoni town. At least 15 confirmed cases in the last week. Fogging and mosquito control measures are not being carried out by the municipal corporation.', issueType: 'health', area: 'Adoni', status: 'in-progress', daysAgo: 4, upvotes: 82 },
  { title: 'Medicine shortage at Nandyal Government Hospital', description: 'The government hospital in Nandyal has run out of basic medicines including paracetamol, antibiotics, and diabetes medication. Patients are being asked to buy from private pharmacies.', issueType: 'health', area: 'Nandyal', status: 'pending', daysAgo: 6, upvotes: 47 },
  { title: 'Ambulance service not responding in Dhone', description: 'Called 108 ambulance service three times for a cardiac emergency in Dhone. No ambulance arrived for 2 hours. The patient had to be taken in a private vehicle. This is life-threatening negligence.', issueType: 'health', area: 'Dhone', status: 'resolved', daysAgo: 18, upvotes: 61 },

  // SANITATION ISSUES
  { title: 'Garbage dump overflowing on MG Road Kurnool', description: 'The garbage dump on MG Road has not been cleared for 10 days. The stench is unbearable and the garbage is spilling onto the road. Stray dogs and pigs are rummaging through it.', issueType: 'sanitation', area: 'Kurnool City', status: 'pending', daysAgo: 3, upvotes: 38 },
  { title: 'Open drain causing diseases in Yemmiganur', description: 'An open drain running through the residential area in Yemmiganur ward 3 has become a breeding ground for mosquitoes. Multiple malaria cases reported. The drain needs to be covered.', issueType: 'sanitation', area: 'Yemmiganur', status: 'in-progress', daysAgo: 14, upvotes: 29 },
  { title: 'Public toilets in deplorable condition at Allagadda bus stand', description: 'The public toilets at Allagadda bus stand are in terrible condition. No water supply, broken doors, and extremely unhygienic. Women travelers are the most affected.', issueType: 'sanitation', area: 'Allagadda', status: 'pending', daysAgo: 22, upvotes: 17 },
  { title: 'Dead animal carcass not removed in Pattikonda', description: 'A cow carcass has been lying on the roadside near Pattikonda for 4 days. The municipal staff has not removed it despite multiple complaints. The decomposing body is a health hazard.', issueType: 'sanitation', area: 'Pattikonda', status: 'resolved', daysAgo: 9, upvotes: 24 },

  // OTHER
  { title: 'Illegal sand mining on Tungabhadra riverbed', description: 'Illegal sand mining is happening at night on the Tungabhadra riverbed near Kurnool. Heavy trucks are damaging village roads and the riverbed ecosystem. Authorities need to take action.', issueType: 'other', area: 'Kurnool City', status: 'pending', daysAgo: 11, upvotes: 56 },
  { title: 'Stray dog menace in Nandyal residential areas', description: 'Packs of stray dogs are attacking children and elderly in multiple residential areas of Nandyal. Two children were bitten last week. Animal control measures are needed urgently.', issueType: 'other', area: 'Nandyal', status: 'in-progress', daysAgo: 16, upvotes: 44 },
  { title: 'Encroachment of public park in Adoni', description: 'The only public park in Adoni ward 7 is being encroached by illegal constructions. Children have lost their only play area. The municipal corporation is turning a blind eye.', issueType: 'other', area: 'Adoni', status: 'pending', daysAgo: 50, upvotes: 33 },
];

const sampleComments = [
  'This is a serious issue. Authorities must act immediately!',
  'I face this problem every day. Please resolve it soon.',
  'Thank you for reporting this. I was about to report the same.',
  'This has been going on for months. When will someone take action?',
  'I have forwarded this to the local MLA office.',
  'We organized a community meeting about this issue last week.',
  'The contractor responsible should be held accountable.',
  'This is affecting our children\'s education and safety.',
  'Visited the site yesterday. The situation is even worse now.',
  'Filed an RTI about this. Will share the response here.',
];

const adminComments = [
  'We have noted this complaint and forwarded it to the concerned department.',
  'A field inspection team has been dispatched to verify the issue.',
  'Work order has been issued. Expected resolution within 2 weeks.',
  'This issue has been escalated to the District Collector\'s office.',
  'Budget has been sanctioned for repairs. Work will begin shortly.',
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Issue.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const admin = await User.create({
      name: 'SMD Tabraiz',
      email: 'tabraizsmd@gmail.com',
      password: 'admin123',
      role: 'admin',
      phone: '9876543210',
      location: 'Kurnool City',
    });
    console.log('👑 Admin created: tabraizsmd@gmail.com / admin123');

    // Create sample users
    const userNames = [
      { name: 'Ravi Kumar', email: 'ravi@example.com' },
      { name: 'Lakshmi Devi', email: 'lakshmi@example.com' },
      { name: 'Mohammed Saleem', email: 'saleem@example.com' },
      { name: 'Priya Reddy', email: 'priya@example.com' },
      { name: 'Venkatesh Naidu', email: 'venkatesh@example.com' },
      { name: 'Anjali Sharma', email: 'anjali@example.com' },
      { name: 'Suresh Babu', email: 'suresh@example.com' },
      { name: 'Fatima Begum', email: 'fatima@example.com' },
    ];

    const users = [];
    for (const u of userNames) {
      const user = await User.create({
        name: u.name,
        email: u.email,
        password: 'password123',
        role: 'user',
        location: 'Kurnool',
      });
      users.push(user);
    }
    console.log(`👥 Created ${users.length} sample users`);

    // Kurnool district coordinates (approximate)
    const coords = {
      'Kurnool City': { lat: 15.8281, lng: 78.0373 },
      'Nandyal': { lat: 15.4786, lng: 78.4833 },
      'Adoni': { lat: 15.6322, lng: 77.2773 },
      'Yemmiganur': { lat: 15.7700, lng: 77.4700 },
      'Dhone': { lat: 15.3950, lng: 77.8730 },
      'Nandikotkur': { lat: 15.8550, lng: 78.2680 },
      'Allagadda': { lat: 15.1340, lng: 78.4940 },
      'Atmakur': { lat: 15.8790, lng: 78.5870 },
      'Kodumur': { lat: 15.6880, lng: 78.0630 },
      'Mantralayam': { lat: 15.9780, lng: 77.3750 },
      'Gudur': { lat: 15.5870, lng: 78.8210 },
      'Pattikonda': { lat: 15.4050, lng: 77.5310 },
      'Banaganapalle': { lat: 15.3175, lng: 78.2280 },
      'Koilkuntla': { lat: 15.2330, lng: 78.3180 },
      'Srisailam': { lat: 15.8510, lng: 78.8690 },
      'Orvakal': { lat: 15.7290, lng: 78.0210 },
      'Bethamcherla': { lat: 15.4440, lng: 78.1480 },
    };

    // Create issues
    const createdIssues = [];
    for (const issue of sampleIssues) {
      const reporter = users[Math.floor(Math.random() * users.length)];
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - issue.daysAgo);

      // Generate fake upvote user IDs
      const upvoteUsers = [];
      const upvoteCount = issue.upvotes;
      for (let i = 0; i < Math.min(upvoteCount, users.length); i++) {
        upvoteUsers.push(users[i]._id);
      }

      const location = coords[issue.area] || { lat: 15.83 + (Math.random() - 0.5) * 0.5, lng: 78.04 + (Math.random() - 0.5) * 0.5 };

      const timeline = [
        { status: 'pending', message: 'Issue reported by citizen', updatedBy: reporter._id, createdAt }
      ];

      if (issue.status === 'in-progress' || issue.status === 'resolved') {
        const progressDate = new Date(createdAt);
        progressDate.setDate(progressDate.getDate() + 2);
        timeline.push({
          status: 'in-progress',
          message: 'Issue is being reviewed by the concerned department',
          updatedBy: admin._id,
          createdAt: progressDate,
        });
      }

      if (issue.status === 'resolved') {
        const resolvedDate = new Date(createdAt);
        resolvedDate.setDate(resolvedDate.getDate() + 7);
        timeline.push({
          status: 'resolved',
          message: 'Issue has been resolved successfully',
          updatedBy: admin._id,
          createdAt: resolvedDate,
        });
      }

      // Determine priority
      let priority = 'low';
      if (upvoteCount >= 50) priority = 'urgent';
      else if (upvoteCount >= 25) priority = 'high';
      else if (upvoteCount >= 10) priority = 'medium';

      const created = await Issue.create({
        title: issue.title,
        description: issue.description,
        issueType: issue.issueType,
        location: {
          area: issue.area,
          district: 'Kurnool',
          state: 'Andhra Pradesh',
          coordinates: { lat: location.lat, lng: location.lng },
        },
        status: issue.status,
        priority,
        upvotes: upvoteUsers,
        upvoteCount,
        reportedBy: reporter._id,
        timeline,
        createdAt,
        updatedAt: createdAt,
      });
      createdIssues.push(created);
    }
    console.log(`📋 Created ${createdIssues.length} sample issues`);

    // Add comments to issues
    let commentCount = 0;
    for (const issue of createdIssues) {
      // 2-4 user comments per issue
      const numComments = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numComments; i++) {
        const commenter = users[Math.floor(Math.random() * users.length)];
        await Comment.create({
          issue: issue._id,
          user: commenter._id,
          text: sampleComments[Math.floor(Math.random() * sampleComments.length)],
          isOfficial: false,
        });
        commentCount++;
      }

      // Add an admin comment on some issues
      if (issue.status !== 'pending' || Math.random() > 0.5) {
        await Comment.create({
          issue: issue._id,
          user: admin._id,
          text: adminComments[Math.floor(Math.random() * adminComments.length)],
          isOfficial: true,
        });
        commentCount++;
      }

      // Update comment count
      const count = await Comment.countDocuments({ issue: issue._id });
      await Issue.findByIdAndUpdate(issue._id, { commentCount: count });
    }
    console.log(`💬 Created ${commentCount} comments`);

    console.log('\n========================================');
    console.log('🎉 SEED COMPLETE!');
    console.log('========================================');
    console.log('\n📌 Login Credentials:');
    console.log('   Admin: tabraizsmd@gmail.com / admin123');
    console.log('   User:  ravi@example.com / password123');
    console.log(`\n📊 Data Summary:`);
    console.log(`   Users:    ${users.length + 1}`);
    console.log(`   Issues:   ${createdIssues.length}`);
    console.log(`   Comments: ${commentCount}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();
