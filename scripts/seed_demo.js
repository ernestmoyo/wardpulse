/**
 * Generate realistic demo reports for WardPulse.
 * Run: node scripts/seed_demo.js
 */
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['water', 'roads', 'sanitation', 'waste', 'infrastructure', 'health'];
const STATUSES = ['open', 'acknowledged', 'resolved'];

const WARD_ISSUES = {
  // From Asher's Resident Review — real issues per ward
  5:  { areas: 'Milton Park, Belvedere', issues: ['Burst water pipes running for weeks', 'Potholes on main road', 'Blocked sewer near school'] },
  6:  { areas: 'Southlea Park', issues: ['No water for 3 weeks', 'Roads completely eroded', 'Raw sewage flowing in open drain', 'Illegal dumping at intersection'] },
  7:  { areas: 'Chisipiti, Ballantyne Park', issues: ['Water cuts every other day', 'Storm drain collapsed', 'Street lights defunct for months'] },
  9:  { areas: 'Greendale, Msasa', issues: ['Intermittent water supply', 'Road surface crumbling', 'Sewer overflow near shops'] },
  10: { areas: 'Houghton Park, Sunningdale', issues: ['No municipal water — residents rely on boreholes', 'Pothole-riddled roads', 'Sewage leak near primary school', 'No waste collection for 2 months'] },
  13: { areas: 'Lochinvar, Southerton', issues: ['Water rationing — once per week', 'Industrial road damage from trucks', 'Clinic understaffed'] },
  16: { areas: 'Mabelreign', issues: ['Water supply erratic', 'Roads deteriorating', 'Sewer blockage in residential area', 'Street lighting completely gone'] },
  17: { areas: 'Mount Pleasant, Avondale', issues: ['Water cuts 3 days per week', 'Avondale road potholes', 'Storm drain overflow during rains'] },
  18: { areas: 'Borrowdale, Greystone Park', issues: ['Water supply adequate but aging pipes', 'Minor road repairs needed', 'Waste collection inconsistent'] },
  20: { areas: 'Mabvuku, Tafara', issues: ['Severe water shortage — no supply for weeks', 'Roads completely collapsed', 'Raw sewage in streets', 'No waste collection', 'Defunct street lights', 'Clinic overcrowded'] },
  22: { areas: 'Hatfield, Msasa Park', issues: ['Intermittent water', 'Road repairs incomplete', 'Sewer smell near campus'] },
  23: { areas: 'Parktown, Mainway Meadows', issues: ['No water supply', 'Roads washed away', 'Sewage flowing openly', 'Illegal dumping widespread'] },
  25: { areas: 'Highfield', issues: ['Water once a week if lucky', 'Potholed roads everywhere', 'Sewer collapse on main street', 'No refuse collection'] },
  26: { areas: 'Western Triangle, Glen View 7&8', issues: ['No water for 2+ weeks', 'Roads impassable after rain', 'Raw sewage flowing in the open', 'Mountains of uncollected waste', 'No street lighting at all'] },
  27: { areas: 'Glen Norah', issues: ['Water supply once a week', 'Main road crumbling', 'Sewer leak behind market', 'Waste dumped in open spaces'] },
  29: { areas: 'Budiriro 5', issues: ['No municipal water', 'Road completely destroyed', 'Sewage contaminating water sources'] },
  30: { areas: 'Glen View 3, Area 8', issues: ['Chronic water shortage', 'Roads in terrible state', 'Open sewers', 'Refuse piling up'] },
  31: { areas: 'Budiriro 3', issues: ['No water for weeks', 'Roads collapsed', 'Sewage running in streets', 'No waste collection'] },
  32: { areas: 'Glen View 1&2', issues: ['Water outage ongoing', 'Potholed roads dangerous', 'Sewer system failed'] },
  35: { areas: 'Hopley, Stoneridge', issues: ['Zero municipal water', 'No tarred roads at all', 'No sewer system — pit latrines', 'No waste collection', 'No street lights', 'No clinic nearby'] },
  36: { areas: 'Crowborough Phase 4', issues: ['Water supply irregular', 'Roads need resurfacing', 'Sewer blockage frequent'] },
  37: { areas: 'Kuwadzana', issues: ['No water supply', 'Roads destroyed', 'Sewer system collapsed', 'Waste everywhere', 'All street lights defunct', 'Drug abuse crisis at recreation area'] },
  39: { areas: 'Dzivarasekwa', issues: ['Chronic water shortage', 'Roads crumbling', 'Sewer overflow', 'Illegal dumping', 'Drug abuse epidemic among youth'] },
  42: { areas: 'Hatcliffe', issues: ['No piped water at all', 'Unpaved roads flood easily', 'No sewer — open drains', 'No waste services'] },
  43: { areas: 'Budiriro 4', issues: ['No water', 'Roads terrible', 'Sewage everywhere', 'No collection', 'Land baron victims'] },
  44: { areas: 'Crowborough Phase 2', issues: ['Water once per week', 'Road potholes dangerous', 'Sewer leak near school'] },
};

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 14) + 6);
  d.setMinutes(Math.floor(Math.random() * 60));
  return d.toISOString();
}

function pickCategory(issue) {
  const lower = issue.toLowerCase();
  if (lower.includes('water') || lower.includes('borehole') || lower.includes('pipe')) return 'water';
  if (lower.includes('road') || lower.includes('pothole') || lower.includes('tarred')) return 'roads';
  if (lower.includes('sew') || lower.includes('drain') || lower.includes('latrine')) return 'sanitation';
  if (lower.includes('waste') || lower.includes('dump') || lower.includes('refuse') || lower.includes('collection')) return 'waste';
  if (lower.includes('street light') || lower.includes('light') || lower.includes('land baron')) return 'infrastructure';
  if (lower.includes('clinic') || lower.includes('drug') || lower.includes('health')) return 'health';
  return CATEGORIES[Math.floor(Math.random() * 4)]; // default to first 4
}

const reports = [];
let id = 1;

for (const [wardStr, data] of Object.entries(WARD_ISSUES)) {
  const wardId = Number(wardStr);

  for (const issue of data.issues) {
    const cat = pickCategory(issue);

    // Generate 2-6 reports per issue to simulate multiple citizens reporting
    const count = Math.floor(Math.random() * 5) + 2;
    for (let i = 0; i < count; i++) {
      const daysBack = Math.floor(Math.random() * 60) + 1;
      const created = randomDate(daysBack);

      // ~20% resolved, ~15% acknowledged, rest open
      const roll = Math.random();
      let status, ack, res;
      if (roll < 0.20) {
        status = 'resolved';
        const ackDate = new Date(new Date(created).getTime() + Math.random() * 5 * 86400000);
        const resDate = new Date(ackDate.getTime() + Math.random() * 14 * 86400000);
        ack = ackDate.toISOString();
        res = resDate.toISOString();
      } else if (roll < 0.35) {
        status = 'acknowledged';
        ack = new Date(new Date(created).getTime() + Math.random() * 7 * 86400000).toISOString();
        res = null;
      } else {
        status = 'open';
        ack = null;
        res = null;
      }

      reports.push({
        id: id++,
        ward_id: wardId,
        category: cat,
        description: i === 0 ? issue : null, // first report has description, rest are "me too"
        lat: null,
        lng: null,
        photo_url: null,
        status,
        source: i === 0 ? 'resident_review' : 'citizen',
        created_at: created,
        acknowledged_at: ack,
        resolved_at: res,
      });
    }
  }
}

// Sort by date
reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

const outPath = path.join(__dirname, '..', 'data', 'reports.json');
fs.writeFileSync(outPath, JSON.stringify(reports, null, 2));
console.log(`Generated ${reports.length} reports across ${Object.keys(WARD_ISSUES).length} wards`);
console.log(`Open: ${reports.filter(r => r.status === 'open').length}`);
console.log(`Acknowledged: ${reports.filter(r => r.status === 'acknowledged').length}`);
console.log(`Resolved: ${reports.filter(r => r.status === 'resolved').length}`);
