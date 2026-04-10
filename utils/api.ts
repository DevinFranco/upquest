// UpQuest API
// DEV_MODE=true mocks local data. REAL_CHAT=true attempts live Grok backend for /plan-chat,
// falling back to the smart local mock if the backend returns an error.

const BASE_URL  = process.env.EXPO_PUBLIC_API_URL ?? 'https://upquest-backend-45fk.vercel.app';
const DEV_MODE  = false;
const REAL_CHAT = true;

// ── Smart mock chat — reads what user said and responds contextually ──────────

interface ChatCtx {
  coveredSleep:     boolean;
  coveredActivity:  boolean;
  coveredDiet:      boolean;
  coveredStress:    boolean;
  coveredGoals:     boolean;
  messageCount:     number;
}

const ctx: ChatCtx = { coveredSleep: false, coveredActivity: false, coveredDiet: false, coveredStress: false, coveredGoals: false, messageCount: 0 };

function smartReply(userMsg: string, allMsgs: {role:string; content:string}[]): string {
  const m = userMsg.toLowerCase();
  ctx.messageCount++;

  // Detect what the user just shared
  if (m.match(/sleep|hour|rest|tired|wake|bed|night|insomnia/)) ctx.coveredSleep = true;
  if (m.match(/work|desk|stand|walk|sit|active|exercise|gym|run|sport|job|office/)) ctx.coveredActivity = true;
  if (m.match(/eat|food|diet|meal|calorie|protein|carb|fast|keto|vegan|nutrition/)) ctx.coveredDiet = true;
  if (m.match(/stress|anxious|anxiety|pressure|overwhelm|relax|mental|mood|emotion/)) ctx.coveredStress = true;
  if (m.match(/goal|want|hope|wish|target|aim|lose|gain|build|improve/)) ctx.coveredGoals = true;

  // After enough context, prompt to generate
  const covered = [ctx.coveredSleep, ctx.coveredActivity, ctx.coveredDiet, ctx.coveredStress].filter(Boolean).length;
  if (ctx.messageCount >= 3 || covered >= 2) {
    return "That gives me a really solid picture of where you're at. I have everything I need to build a plan that actually fits your life — not just a generic template.\n\nTap \"Generate ✓\" above whenever you're ready, or keep going if there's anything else you want me to factor in.";
  }

  // Ask about the next uncovered topic, acknowledging what they said first
  const ack = buildAck(m);

  if (!ctx.coveredActivity) {
    return `${ack}What does a typical weekday look like for you — are you mostly sitting at a desk, on your feet, or somewhere in between? This helps me calibrate workout intensity and energy timing.`;
  }
  if (!ctx.coveredDiet) {
    return `${ack}How would you describe your eating habits right now? I'm not looking for perfection — just a sense of what's typical: do you tend to eat regularly, skip meals, eat out a lot, or follow any specific approach?`;
  }
  if (!ctx.coveredStress) {
    return `${ack}Last one — how's your stress level day-to-day? High stress affects recovery and sleep, so knowing this helps me build in the right amount of deload and recovery time.`;
  }

  return `${ack}Is there anything specific you want to make sure is in your plan — or anything you definitely want to avoid?`;
}

function buildAck(msg: string): string {
  if (msg.match(/sleep|hour|rest|wake/)) {
    if (msg.match(/bad|poor|terrible|little|few|not great|tossing|waking|often/)) {
      return "Got it — sounds like sleep quality has been a real issue lately. That's one of the biggest levers for energy and body composition, so we'll put a strong focus on that.\n\n";
    }
    return "Good to know on the sleep front.\n\n";
  }
  if (msg.match(/work|desk|sit|office/)) {
    return "Makes sense — a more sedentary setup means we'll want to be strategic about movement throughout the day.\n\n";
  }
  if (msg.match(/stress|anxious|busy|overwhelm/)) {
    return "That level of stress will definitely factor into your recovery needs.\n\n";
  }
  if (msg.length < 20) {
    return "Thanks for sharing. ";
  }
  return "Got it. ";
}

// ── Mock schedule data ────────────────────────────────────────────────────────

const STRENGTH = {
  theme: 'Strength Training',
  daily_tip: 'Drink 500ml of water before your workout for up to 15% better performance.',
  schedule: { '6:30 AM': 'Wake up + sunlight', '7:00 AM': 'Strength workout (45 min)', '8:00 AM': 'High-protein breakfast', '12:30 PM': 'Lunch', '6:30 PM': 'Dinner', '9:30 PM': 'Wind-down — no screens', '10:00 PM': 'Lights out' },
  meals: {
    breakfast: { name: 'Eggs & Oats Power Bowl', ingredients: ['3 eggs scrambled', '1 cup rolled oats', '1 banana', 'Black coffee'], macros: { protein_g: 35, carbs_g: 65, fat_g: 12, calories: 510 } },
    lunch:     { name: 'Grilled Chicken Rice Bowl', ingredients: ['6oz chicken breast', '1 cup brown rice', 'Broccoli', 'Olive oil'], macros: { protein_g: 52, carbs_g: 55, fat_g: 10, calories: 520 } },
    dinner:    { name: 'Salmon & Sweet Potato', ingredients: ['6oz salmon', '1 medium sweet potato', 'Asparagus', 'Lemon'], macros: { protein_g: 42, carbs_g: 35, fat_g: 18, calories: 470 } },
    snacks: ['Greek yogurt + berries', 'Almonds'],
  },
  workout: { type: 'Strength Training', duration_minutes: 45, exercises: [
    { name: 'Back Squat',     sets: 4, reps: '6-8',  rest_seconds: 120 },
    { name: 'Bench Press',    sets: 4, reps: '6-8',  rest_seconds: 120 },
    { name: 'Bent-over Row',  sets: 3, reps: '8-10', rest_seconds: 90  },
    { name: 'Overhead Press', sets: 3, reps: '8-10', rest_seconds: 90  },
    { name: 'Romanian DL',    sets: 3, reps: '10-12', rest_seconds: 90 },
  ]},
  habits: ['Vitamin D + Magnesium with breakfast', 'No caffeine after 2 PM', '10,000 steps', 'Journal 5 min before bed'],
};

const CARDIO = {
  theme: 'Cardio & Recovery',
  daily_tip: 'Zone 2 cardio burns fat and builds aerobic base without taxing your muscles.',
  schedule: { '6:30 AM': 'Wake up + stretch', '7:00 AM': 'Zone 2 cardio (30 min)', '8:00 AM': 'Breakfast', '12:30 PM': 'Lunch', '9:30 PM': 'Wind-down', '10:00 PM': 'Lights out' },
  meals: {
    breakfast: { name: 'Protein Smoothie Bowl', ingredients: ['1 scoop protein', 'Banana', 'Almond milk', 'Granola'], macros: { protein_g: 35, carbs_g: 55, fat_g: 8, calories: 430 } },
    lunch:     { name: 'Turkey Avocado Wrap', ingredients: ['4oz turkey', 'Whole wheat tortilla', 'Avocado', 'Spinach'], macros: { protein_g: 38, carbs_g: 42, fat_g: 14, calories: 445 } },
    dinner:    { name: 'Lean Beef Stir Fry', ingredients: ['5oz lean beef', 'Mixed vegetables', 'Brown rice', 'Soy sauce'], macros: { protein_g: 44, carbs_g: 48, fat_g: 12, calories: 480 } },
    snacks: ['Apple + almond butter', 'Cottage cheese'],
  },
  workout: { type: 'Zone 2 Cardio', duration_minutes: 30, exercises: [
    { name: 'Treadmill or bike at conversational pace', sets: 1, reps: '30 min', rest_seconds: 0 },
  ]},
  habits: ['Omega-3 with breakfast', 'Foam roll legs after cardio', 'Electrolytes post-workout'],
};

const REST = {
  theme: 'Rest & Renewal',
  daily_tip: 'Rest days are when muscles grow. Prioritize 8 hours tonight.',
  schedule: { '7:00 AM': 'Wake naturally', '7:30 AM': 'Light stretching', '8:00 AM': 'Breakfast', '12:30 PM': 'Lunch', '3:00 PM': 'Easy walk (optional)', '9:30 PM': 'Lights out — 8+ hrs goal' },
  meals: {
    breakfast: { name: 'Avocado Toast & Eggs', ingredients: ['2 eggs', 'Whole grain toast', 'Half avocado', 'Cherry tomatoes'], macros: { protein_g: 24, carbs_g: 35, fat_g: 18, calories: 395 } },
    lunch:     { name: 'Greek Salad with Chicken', ingredients: ['5oz chicken', 'Cucumber', 'Tomato', 'Feta', 'Olives'], macros: { protein_g: 42, carbs_g: 18, fat_g: 16, calories: 385 } },
    dinner:    { name: 'Baked Cod & Quinoa', ingredients: ['6oz cod', '3/4 cup quinoa', 'Roasted veggies', 'Lemon herb'], macros: { protein_g: 48, carbs_g: 42, fat_g: 10, calories: 450 } },
    snacks: ['Protein bar', 'Mixed nuts'],
  },
  workout: null,
  habits: ['Magnesium 400mg before bed', 'No alcohol', 'Read instead of scrolling', 'Gratitude journal'],
};

const MOCK_PLAN = {
  week_summary: 'A balanced week: 3 strength days, 2 cardio sessions, 2 rest days. Focus on progressive overload and sleep quality.',
  days: { Monday: STRENGTH, Tuesday: CARDIO, Wednesday: REST, Thursday: STRENGTH, Friday: CARDIO, Saturday: { ...STRENGTH, theme: 'Weekend Strength' }, Sunday: REST },
  supplement_stack: [
    { name: 'Vitamin D3', dose: '5000 IU', timing: 'With breakfast',    reason: 'Testosterone support, immune function' },
    { name: 'Magnesium',  dose: '400mg',   timing: '30 min before bed', reason: 'Sleep quality, muscle recovery' },
    { name: 'Creatine',   dose: '5g',      timing: 'Post-workout',      reason: 'Strength and power output' },
    { name: 'Omega-3',    dose: '2g',      timing: 'With any meal',     reason: 'Anti-inflammatory, heart health' },
  ],
  shopping_list: {
    proteins: ['Chicken breast (3 lbs)', 'Salmon (1.5 lbs)', 'Lean beef (1 lb)', 'Eggs (18)', 'Greek yogurt', 'Cottage cheese'],
    produce:  ['Broccoli', 'Asparagus', 'Sweet potatoes', 'Bananas', 'Berries', 'Spinach', 'Avocados'],
    grains:   ['Brown rice', 'Rolled oats', 'Whole grain tortillas', 'Quinoa'],
    pantry:   ['Olive oil', 'Almonds', 'Protein powder', 'Almond butter'],
  },
};

// ── Request ──────────────────────────────────────────────────────────────────

async function request(method: string, path: string, body?: object): Promise<any> {
  if (DEV_MODE) {
    await new Promise(r => setTimeout(r, 600));

    if (path.startsWith('/schedules/')) return { schedule: { id: 'local', week_start: new Date().toISOString().split('T')[0], full_schedule: MOCK_PLAN } };
    if (path === '/schedules')          return { schedules: [] };
    if (path === '/profile')            return { profile: { stats: {}, goals: [] }, is_premium: true };

    if (path === '/plan-chat') {
      const b = body as any;

      // Try real Grok backend first (if REAL_CHAT enabled)
      if (REAL_CHAT) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const res = await fetch(`${BASE_URL}/plan-chat`, {
            method: 'POST', headers, body: JSON.stringify(body),
          });
          if (res.ok) {
            const data = await res.json();
            return data;
          }
        } catch (_) {
          // Backend unreachable — fall through to smart mock
        }
      }

      // Smart local mock fallback
      if (b?.action === 'generate' || b?.action === 'modify') {
        return { message: b.action === 'modify' ? 'Plan updated!' : 'Plan ready!', schedule: MOCK_PLAN };
      }
      const lastUserMsg = (b?.messages ?? []).filter((m: any) => m.role === 'user').slice(-1)[0]?.content ?? '';
      const reply = smartReply(lastUserMsg, b?.messages ?? []);
      return { message: reply };
    }

    return { success: true };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed: ${res.status}`);
  return data;
}

export const api = {
  get:    (path: string, _token?: string)               => request('GET',  path),
  post:   (path: string, body: object, _token?: string) => request('POST', path, body),
  put:    (path: string, body: object, _token?: string) => request('PUT',  path, body),
  patch:  (path: string, body: object, _token?: string) => request('PATCH', path, body),
  delete: (path: string, _token?: string)               => request('DELETE', path),
};
