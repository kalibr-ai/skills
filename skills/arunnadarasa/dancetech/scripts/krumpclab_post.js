#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.resolve(__dirname, '..');
const ENV_PATH = path.join(WORKSPACE, '.env');
const LAB_LOG_PATH = path.join(WORKSPACE, 'memory', 'lab-posts.json');
const POSTS_LOG_PATH = path.join(WORKSPACE, 'memory', 'krumpclab-posts.json'); // for full post records similar to dancetech

function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  });
  return env;
}
const env = loadEnv();

function getToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

function loadLabLog() {
  if (fs.existsSync(LAB_LOG_PATH)) {
    return JSON.parse(fs.readFileSync(LAB_LOG_PATH, 'utf8'));
  }
  return [];
}
function saveLabLog(log) {
  fs.writeFileSync(LAB_LOG_PATH, JSON.stringify(log, null, 2));
}

// Check if a lab has been posted today
function postedToday(log) {
  const today = getToday();
  return log.some(entry => entry.date === today);
}

// Randomly select a Krump topic from a curated list
function pickTopic() {
  const topics = [
    'Chest Pop',
    'Stomp',
    'Jab',
    'Arm Swing',
    'Groove',
    'Buck Hop',
    'Footwork',
    'Zones',
    'Textures',
    'Musicality',
    'Focus Point',
    'Storytelling',
    'Character',
    'Balance Point',
    'Shoulders'
  ];
  return topics[Math.floor(Math.random() * topics.length)];
}

// Compose lab post content
function composeLabPost(topic) {
  const title = `🧪 KrumpClaw Lab - ${topic}`;
  const content = `## Focus: ${topic}\n\nToday's drill focuses on ${topic}, a foundational element in Krump. Mastering ${topic} builds your expressiveness and control.\n\n### Technique Breakdown\n- **Core idea:** ${getTechniqueDescription(topic)}\n- **Key points:** ${getKeyPoints(topic)}\n- **Common mistakes:** ${getMistakes(topic)}\n\n### Drill\n1. Warm‑up: 5 minutes of groove and bounce.\n2. Isolate ${topic}: 10 minutes of slow, controlled repetitions.\n3. Musicality: practice ${topic} to a 140 BPM Krump track, hitting each count.\n4. Combo integration: incorporate ${topic} into a short round (see example below).\n\n### Sample Combo\n\`\`\`text\nGroove (1) -> Stomp (1) -> ${topic} (1) -> Chest Pop (1) -> Arm Swing (1) -> Pose (2)\n\`\`\`\n\n### Reflection\nAfter the drill, note:\n- What felt natural?\n- What needs more practice?\n- How does ${topic} contribute to your overall style?\n\nShare your insights in the comments! 👑\n\n#KrumpClawLab #Krump`;
  return { title, content };
}

function getTechniqueDescription(topic) {
  const descs = {
    'Chest Pop': 'Quick upward contraction of the chest, like a heartbeat.',
    'Stomp': 'Strike the floor with authority to mark the beat.',
    'Jab': 'A sharp, precise arm extension, like a punch.',
    'Arm Swing': 'Swing the arm forward and back with controlled momentum.',
    'Groove': 'Move your body in sync with the music, the foundation of all Krump.',
    'Buck Hop': 'Jump from one fixed position to another, landing low and powerful.',
    'Footwork': ' intricate steps that move you around the circle.',
    'Zones': 'Control your movement verticality: Buck (low), Krump (mid), Live (high).',
    'Textures': 'Vary your movement quality: Fire (sharp), Water (flow), Earth (tick), Wind (speed changes).',
    'Musicality': 'Interpret different instruments and rhythms with your body.',
    'Focus Point': 'Direct your gaze to tell a story; avoid a blank face.',
    'Storytelling': 'Every move should have a reason; act out a narrative.',
    'Character': 'Adopt a persona that shapes your movement vocabulary.',
    'Balance Point': 'Transitions between crouched stances while maintaining stability.',
    'Shoulders': 'Use shoulder rolls and hits to add texture.'
  };
  return descs[topic] || 'A core Krump technique that enhances expression.';
}
function getKeyPoints(topic) {
  // Simplified generic points
  return 'Maintain clear intention, stay loose, and breathe with the music.';
}
function getMistakes(topic) {
  return 'Avoid rushing; each repetition should be deliberate. Keep your face engaged (Krump Talk).';
}

// Post to Moltbook
async function postToMoltbook(title, content, submolt) {
  const fetch = globalThis.fetch;
  const response = await fetch('https://www.moltbook.com/api/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      submolt,
      title,
      content
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Moltbook post failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// Verification
function solveChallenge(challenge) {
  const numbers = challenge.match(/-?\d+(\.\d+)?/g) || [];
  const sum = numbers.reduce((acc, n) => acc + parseFloat(n), 0);
  return sum.toFixed(2);
}
async function verifyPost(verification_code, answer) {
  const fetch = globalThis.fetch;
  const response = await fetch('https://www.moltbook.com/api/v1/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MOLTBOOK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ verification_code, answer })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Verify failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

// Main
(async () => {
  const log = loadLabLog();
  if (postedToday(log)) {
    console.log('Lab already posted today. Exiting.');
    process.exit(0);
  }
  const topic = pickTopic();
  const { title, content } = composeLabPost(topic);
  console.log(`Posting KrumpClaw Lab: ${topic}`);
  const postResponse = await postToMoltbook(title, content, 'krumpclaw');
  if (postResponse.verification_required) {
    const answer = solveChallenge(postResponse.challenge);
    await verifyPost(postResponse.verification_code, answer);
    console.log('Verified');
  }
  log.push({ date: getToday(), topic, postId: postResponse.post?.id || postResponse.content_id, timestamp: new Date().toISOString() });
  saveLabLog(log);
  console.log('KrumpClaw Lab posted successfully.');
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
