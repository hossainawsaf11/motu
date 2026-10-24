/* Motu exercise library and starter programs.
   Each gym exercise can name a home version; history is kept separately for each version. */
(function () {
  // name: [type, muscle, home version]
  const GYM = {
    'Barbell Bench Press': ['barbell', 'Chest', 'Push-up'],
    'Dumbbell Bench Press': ['dumbbell', 'Chest', 'Push-up'],
    'Incline Dumbbell Press': ['dumbbell', 'Chest', 'Decline Push-up'],
    'Incline Barbell Press': ['barbell', 'Chest', 'Decline Push-up'],
    'Flat Chest Press (Machine/DB)': ['machine', 'Chest', 'Push-up'],
    'Cable Chest Fly': ['cable', 'Chest', 'Band Chest Fly'],
    'Seated Dumbbell Shoulder Press': ['dumbbell', 'Shoulders', 'Pike Push-up'],
    'Dumbbell Shoulder Press': ['dumbbell', 'Shoulders', 'Pike Push-up'],
    'Seated Machine Shoulder Press': ['machine', 'Shoulders', 'Pike Push-up'],
    'Cable Lateral Raise': ['cable', 'Shoulders', 'Band Lateral Raise'],
    'Dumbbell Lateral Raise': ['dumbbell', 'Shoulders', 'Band Lateral Raise'],
    'Face Pull': ['cable', 'Rear delts', 'Band Pull-Apart'],
    'Reverse Pec-Deck': ['machine', 'Rear delts', 'Band Reverse Fly'],
    'Cable Triceps Pushdown (Rope)': ['cable', 'Triceps', 'Band Triceps Pushdown'],
    'Overhead Cable Triceps Extension': ['cable', 'Triceps', 'Bench Dip'],
    'EZ-Bar Skull Crusher': ['barbell', 'Triceps', 'Diamond Push-up'],
    'Lat Pulldown': ['cable', 'Back', 'Band Pulldown'],
    'Wide-Grip Lat Pulldown': ['cable', 'Back', 'Band Pulldown'],
    'Straight-Arm Pulldown': ['cable', 'Back', 'Band Straight-Arm Pulldown'],
    'Barbell Row': ['barbell', 'Back', 'Backpack Row'],
    'Chest-Supported Row': ['machine', 'Back', 'Backpack Row'],
    'Seated Cable Row': ['cable', 'Back', 'Band Seated Row'],
    'Single-Arm Cable Row': ['cable', 'Back', 'Single-Arm Backpack Row'],
    'Incline Dumbbell Curl': ['dumbbell', 'Biceps', 'Backpack Curl'],
    'Hammer Curl': ['dumbbell', 'Biceps', 'Band Hammer Curl'],
    'Cable Biceps Curl': ['cable', 'Biceps', 'Band Biceps Curl'],
    'Barbell Back Squat': ['barbell', 'Quads', 'Backpack Goblet Squat'],
    'Hack Squat': ['machine', 'Quads', 'Backpack Goblet Squat'],
    'Goblet Squat': ['dumbbell', 'Quads', 'Backpack Goblet Squat'],
    'Leg Press': ['machine', 'Quads', 'Step-up'],
    'Leg Press (Feet High)': ['machine', 'Glutes', 'Walking Lunge'],
    'Leg Extension': ['machine', 'Quads', 'Wall Sit'],
    'Bulgarian Split Squat': ['dumbbell', 'Glutes', 'Bodyweight Bulgarian Split Squat'],
    'Romanian Deadlift': ['barbell', 'Hamstrings', 'Backpack Romanian Deadlift'],
    'Dumbbell Romanian Deadlift': ['dumbbell', 'Hamstrings', 'Backpack Romanian Deadlift'],
    'Seated Leg Curl': ['machine', 'Hamstrings', 'Sliding Hamstring Curl'],
    'Hip Thrust': ['barbell', 'Glutes', 'Single-Leg Glute Bridge'],
    'Cable Glute Kickback': ['cable', 'Glutes', 'Banded Kickback'],
    'Hip Abduction Machine': ['machine', 'Glutes', 'Clamshell'],
    'Cable Hip Abduction': ['cable', 'Glutes', 'Banded Side Walk'],
    'Step-up': ['dumbbell', 'Glutes', 'Step-up'],
    'Walking Lunge': ['dumbbell', 'Glutes', 'Walking Lunge'],
    'Standing Calf Raise': ['machine', 'Calves', 'Single-Leg Calf Raise'],
    'Seated Calf Raise': ['machine', 'Calves', 'Single-Leg Calf Raise'],
    'Hanging Leg Raise': ['bodyweight', 'Core', 'Lying Leg Raise'],
    'Cable Crunch': ['cable', 'Core', 'Crunch'],
    'Pallof Press': ['cable', 'Core', 'Side Plank'],
    'Dead Bug': ['bodyweight', 'Core', 'Dead Bug'],
    'Plank': ['bodyweight', 'Core', 'Plank'],
    'Reverse Crunch': ['bodyweight', 'Core', 'Reverse Crunch']
  };
  const HOME_TYPE = n => /band/i.test(n) ? 'band' : /backpack/i.test(n) ? 'backpack' : 'bodyweight';
  const LIB = {};
  for (const [n, [type, m, home]] of Object.entries(GYM)) {
    LIB[n] = { type, m, home: home && home !== n ? home : null };
    if (home && home !== n && !LIB[home]) LIB[home] = { type: HOME_TYPE(home), m, gym: n, isHome: true };
  }
  // same exercise at home and gym (step-ups, lunges, core): keep it, no swap needed
  window.EXLIB = LIB;
  window.homeOf = n => (LIB[n] && LIB[n].home) || null;
  window.gymOf = n => (LIB[n] && LIB[n].gym) || null;

  // [name, sets, repMin, repMax, restSec, note]
  const E = (name, sets, a, b, rest, note) => ({ name, sets, repMin: a, repMax: b, rest, optional: false, note: note || '' });
  window.PROGRAMS = {
    glute3: {
      name: 'Glutes & Core, 3 days', who: 'Toned legs and glutes, a stronger core, a smaller-looking waist',
      days: [
        { name: 'Glutes & Hamstrings', focus: 'Glutes · Hamstrings · Core', ex: [
          E('Hip Thrust', 3, 8, 12, 120), E('Dumbbell Romanian Deadlift', 3, 8, 12, 90), E('Bulgarian Split Squat', 3, 8, 10, 90, 'Reps per leg'),
          E('Cable Glute Kickback', 2, 12, 15, 60, 'Each leg'), E('Hip Abduction Machine', 2, 15, 20, 60), E('Dead Bug', 3, 8, 10, 45, 'Each side')] },
        { name: 'Upper Body & Core', focus: 'Back · Shoulders · Core', ex: [
          E('Lat Pulldown', 3, 10, 12, 90), E('Seated Cable Row', 3, 10, 12, 90), E('Dumbbell Shoulder Press', 3, 10, 12, 90),
          E('Face Pull', 2, 15, 20, 60), E('Plank', 3, 30, 45, 45, 'Seconds'), E('Pallof Press', 2, 10, 12, 45, 'Each side')] },
        { name: 'Glutes & Quads', focus: 'Glutes · Quads · Core', ex: [
          E('Goblet Squat', 3, 10, 12, 90), E('Hip Thrust', 3, 12, 15, 90), E('Step-up', 3, 10, 12, 60, 'Reps per leg'),
          E('Leg Press (Feet High)', 3, 12, 15, 90), E('Cable Hip Abduction', 2, 15, 20, 60), E('Reverse Crunch', 3, 10, 15, 45)] }
      ]
    },
    full3: {
      name: 'Full Body, 3 days', who: 'Fat loss and strength with the least time in the gym',
      days: [
        { name: 'Full Body A', focus: 'Squat · Push · Pull', ex: [
          E('Goblet Squat', 3, 8, 12, 90), E('Dumbbell Bench Press', 3, 8, 12, 90), E('Lat Pulldown', 3, 10, 12, 90),
          E('Dumbbell Romanian Deadlift', 3, 8, 10, 90), E('Plank', 3, 30, 45, 45, 'Seconds')] },
        { name: 'Full Body B', focus: 'Legs · Shoulders · Back', ex: [
          E('Leg Press', 3, 10, 12, 90), E('Seated Dumbbell Shoulder Press', 3, 8, 12, 90), E('Seated Cable Row', 3, 10, 12, 90),
          E('Hip Thrust', 3, 10, 12, 90), E('Dead Bug', 3, 8, 10, 45, 'Each side')] },
        { name: 'Full Body C', focus: 'Single leg · Chest · Back', ex: [
          E('Bulgarian Split Squat', 3, 8, 10, 90, 'Reps per leg'), E('Incline Dumbbell Press', 3, 8, 12, 90), E('Chest-Supported Row', 3, 10, 12, 90),
          E('Seated Leg Curl', 3, 10, 12, 60), E('Reverse Crunch', 3, 10, 15, 45)] }
      ]
    },
    ul4: {
      name: 'Upper / Lower, 4 days', who: 'Muscle and strength on four days a week',
      days: [
        { name: 'Upper A', focus: 'Chest · Back · Shoulders', ex: [
          E('Barbell Bench Press', 3, 6, 10, 150), E('Barbell Row', 3, 6, 10, 120), E('Seated Dumbbell Shoulder Press', 3, 8, 12, 90),
          E('Lat Pulldown', 3, 10, 12, 90), E('Cable Lateral Raise', 2, 12, 15, 60), E('Cable Triceps Pushdown (Rope)', 2, 10, 12, 60)] },
        { name: 'Lower A', focus: 'Quads · Hamstrings · Calves', ex: [
          E('Barbell Back Squat', 3, 5, 8, 180), E('Romanian Deadlift', 3, 8, 10, 150), E('Leg Press', 3, 10, 12, 120),
          E('Seated Leg Curl', 3, 10, 12, 90), E('Standing Calf Raise', 3, 10, 15, 60)] },
        { name: 'Upper B', focus: 'Chest · Back · Arms', ex: [
          E('Incline Dumbbell Press', 3, 8, 12, 90), E('Chest-Supported Row', 3, 8, 12, 90), E('Seated Machine Shoulder Press', 3, 10, 12, 90),
          E('Wide-Grip Lat Pulldown', 3, 10, 12, 90), E('Cable Biceps Curl', 2, 10, 12, 60), E('Face Pull', 2, 15, 20, 60)] },
        { name: 'Lower B', focus: 'Glutes · Quads · Core', ex: [
          E('Hack Squat', 3, 8, 10, 150), E('Hip Thrust', 3, 10, 12, 120), E('Bulgarian Split Squat', 3, 8, 10, 90, 'Reps per leg'),
          E('Leg Extension', 3, 12, 15, 60), E('Seated Calf Raise', 3, 15, 20, 60), E('Cable Crunch', 3, 12, 15, 60)] }
      ]
    }
  };
  window.PROGRAMS.glute4 = {
    name: 'Glutes & Core, 4 days', who: 'The glutes plan plus one extra glute and core day',
    days: [...window.PROGRAMS.glute3.days, { name: 'Glutes & Core Burner', focus: 'Glutes · Core', ex: [
      E('Hip Thrust', 3, 12, 15, 90), E('Cable Glute Kickback', 3, 12, 15, 60, 'Each leg'), E('Walking Lunge', 3, 10, 12, 60, 'Reps per leg'),
      E('Hip Abduction Machine', 3, 15, 20, 60), E('Plank', 3, 30, 45, 45, 'Seconds'), E('Reverse Crunch', 3, 10, 15, 45)] }]
  };
  // the original Push/Pull/Legs x2 rotation, from seed.js
  window.PROGRAMS.ppl6 = {
    name: 'Push / Pull / Legs, 6 days', who: 'Building muscle and losing fat with a high training frequency',
    days: SEED.templates.map(t => ({ name: t.name, focus: t.focus, ex: t.ex.map(a => ({ name: a[0], sets: a[1], repMin: a[2], repMax: a[3], rest: a[4], optional: !!a[5], note: a[6] || '' })) }))
  };
})();
