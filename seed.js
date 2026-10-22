/* Seed data imported from "PPL x2 Training Tracker" (Google Sheet), weeks 1-8.
   All weights in kg. Set strings are "weight x reps" separated by spaces. */
window.SEED = {
  startDate: '2026-08-17',
  templates: [
    { id: 'd1', day: 1, name: 'Push A', focus: 'Chest · Shoulders · Triceps · strength', ex: [
      ['Barbell Bench Press', 3, 5, 8, 150],
      ['Seated Dumbbell Shoulder Press', 3, 6, 10, 120],
      ['Incline Dumbbell Press', 3, 8, 12, 90],
      ['Cable Lateral Raise', 3, 12, 15, 60],
      ['Cable Triceps Pushdown (Rope)', 3, 10, 12, 60],
      ['Overhead Cable Triceps Extension', 3, 12, 15, 60, 1]
    ]},
    { id: 'd2', day: 2, name: 'Pull A', focus: 'Back · Rear delts · Biceps · strength', ex: [
      ['Lat Pulldown', 3, 8, 12, 120, 0, 'Or assisted pull-up'],
      ['Barbell Row', 3, 6, 10, 150, 0, 'Or chest-supported row'],
      ['Seated Cable Row', 3, 10, 12, 90, 0, 'Neutral grip'],
      ['Face Pull', 3, 15, 20, 60],
      ['Incline Dumbbell Curl', 3, 10, 12, 60],
      ['Hammer Curl', 3, 10, 12, 60, 1]
    ]},
    { id: 'd3', day: 3, name: 'Legs A', focus: 'Quads · Hamstrings · Calves · Core', ex: [
      ['Barbell Back Squat', 3, 5, 8, 180],
      ['Romanian Deadlift', 3, 8, 10, 150],
      ['Leg Press', 3, 10, 12, 120],
      ['Seated Leg Curl', 3, 10, 12, 90],
      ['Standing Calf Raise', 3, 10, 15, 60],
      ['Hanging Leg Raise', 3, 10, 15, 60, 1]
    ]},
    { id: 'd4', day: 4, name: 'Push B', focus: 'Chest · Shoulders · Triceps · volume', ex: [
      ['Incline Barbell Press', 3, 8, 10, 120, 0, 'Or machine press'],
      ['Flat Chest Press (Machine/DB)', 3, 10, 12, 90],
      ['Seated Machine Shoulder Press', 3, 10, 12, 90],
      ['Dumbbell Lateral Raise', 3, 12, 15, 60],
      ['Cable Chest Fly', 3, 12, 15, 60, 0, 'Mid height'],
      ['EZ-Bar Skull Crusher', 3, 10, 12, 60, 1]
    ]},
    { id: 'd5', day: 5, name: 'Pull B', focus: 'Back · Rear delts · Biceps · volume', ex: [
      ['Chest-Supported Row', 3, 8, 12, 120, 0, 'T-bar or seated row machine'],
      ['Wide-Grip Lat Pulldown', 3, 10, 12, 90],
      ['Single-Arm Cable Row', 3, 12, 15, 90],
      ['Reverse Pec-Deck', 3, 15, 20, 60],
      ['Cable Biceps Curl', 3, 10, 12, 60],
      ['Straight-Arm Pulldown', 3, 12, 15, 60, 1]
    ]},
    { id: 'd6', day: 6, name: 'Legs B', focus: 'Quads · Glutes · Hamstrings · Core', ex: [
      ['Hack Squat', 3, 8, 10, 150, 0, 'Or front squat'],
      ['Bulgarian Split Squat', 3, 8, 10, 90, 0, 'Reps per leg, weight = one dumbbell'],
      ['Hip Thrust', 3, 10, 12, 120, 0, 'Or lying leg curl'],
      ['Leg Extension', 3, 12, 15, 60],
      ['Seated Calf Raise', 3, 15, 20, 60],
      ['Cable Crunch', 3, 12, 15, 60, 1]
    ]}
  ],
  types: {
    'Barbell Bench Press': 'barbell', 'Seated Dumbbell Shoulder Press': 'dumbbell', 'Incline Dumbbell Press': 'dumbbell',
    'Cable Lateral Raise': 'cable', 'Cable Triceps Pushdown (Rope)': 'cable', 'Overhead Cable Triceps Extension': 'cable',
    'Lat Pulldown': 'cable', 'Barbell Row': 'barbell', 'Seated Cable Row': 'cable', 'Face Pull': 'cable',
    'Incline Dumbbell Curl': 'dumbbell', 'Hammer Curl': 'dumbbell',
    'Barbell Back Squat': 'barbell', 'Romanian Deadlift': 'barbell', 'Leg Press': 'machine', 'Seated Leg Curl': 'machine',
    'Standing Calf Raise': 'machine', 'Hanging Leg Raise': 'bodyweight',
    'Incline Barbell Press': 'barbell', 'Flat Chest Press (Machine/DB)': 'machine', 'Seated Machine Shoulder Press': 'machine',
    'Dumbbell Lateral Raise': 'dumbbell', 'Cable Chest Fly': 'cable', 'EZ-Bar Skull Crusher': 'barbell',
    'Chest-Supported Row': 'machine', 'Wide-Grip Lat Pulldown': 'cable', 'Single-Arm Cable Row': 'cable',
    'Reverse Pec-Deck': 'machine', 'Cable Biceps Curl': 'cable', 'Straight-Arm Pulldown': 'cable',
    'Hack Squat': 'machine', 'Bulgarian Split Squat': 'dumbbell', 'Hip Thrust': 'barbell', 'Leg Extension': 'machine',
    'Seated Calf Raise': 'machine', 'Cable Crunch': 'cable'
  },
  // t = template, w = program week, e = sets per exercise in template order, s = stairmaster [min, level, kcal]
  history: [
    // ---------- Day 1 Push A ----------
    { t: 'd1', w: 2, e: ['13.61x15 22.68x10 22.68x10', '13.6x12 13.6x10 13.6x12', '13.6x10 13.6x10 13.6x8', '4.5x6 4.5x8 4.5x8', '11.3x20 15.8x8 13.5x8'] },
    { t: 'd1', w: 3, e: ['22.68x10 27.22x10 31.75x8', '15.88x10 15.88x10 15.88x8', '15.88x10 15.88x8 13.6x8', '4.5x4 2.3x10 2.3x10', '13.6x15 13.6x12 13.6x10'], s: [5, 6, 50] },
    { t: 'd1', w: 4, e: ['22.68x8 22.68x8 22.68x8', '15.88x12 15.88x12 15.88x10', '15.88x8 15.88x10 15.88x10', '4.5x8 4.5x8 4.5x8', '23x15 27x12 27x12'], s: [5, 6, 0] },
    { t: 'd1', w: 5, e: ['45.36x5 27.22x12 27.22x10', '15.88x10 15.88x10 15.88x10', '22.68x8 22.68x8 22.68x8', '4.5x10 4.5x10 4.5x10', '27x12 27x12 27x12'] },
    { t: 'd1', w: 6, e: ['27.22x10 27.22x10 27.22x10', '15.88x10 15.88x10 18.14x10', '18.14x8 18.14x8 18.14x8', '9x10 9x0 9x0', '27x15 32x10 32x10'] },
    { t: 'd1', w: 7, e: ['27.22x10 27.22x10 27.22x10', '18.14x10 18.14x10 18.14x10', '18.14x6 18.14x8 18.14x8', '9x10 9x10 9x10', '27x15 32x10 32x10'] },
    { t: 'd1', w: 8, e: ['27.22x8 27.22x10 32x8', '18.14x8 18.14x8 18.14x6', '18.14x8 18.14x8 18.14x6', '12x8 12x6 12x6', '32x12 32x10 32x10'] },
    // ---------- Day 2 Pull A ----------
    { t: 'd2', w: 1, e: ['45x10 45x8 45x8', '32x10 32x8 32x8', '39x10 39x10 32x12', '15.8x10 15.8x10 13x10', '18x15 23x10 15x10'], s: [5, 6, 39] },
    { t: 'd2', w: 2, e: ['45x10 45x10 45x10', '32x10 32x12 32x10', '39x10 32x12 32x10', '15.9x10 15.9x10 13.6x10', '6.8x12 6.8x10 9.07x10'], s: [5, 6.2, 0] },
    { t: 'd2', w: 3, e: ['45x12 52x10 52x8', '32x10 36x10 41x8', '39x10 45x8 45x8', '15.9x10 13.8x15 13.8x12', '6.8x10 9.07x12 9.07x12'], s: [5, 7, 39] },
    { t: 'd2', w: 4, e: ['45x10 45x10 50x6', '32x10 32x10 32x8', '45x10 45x10 41x8', '14.7x10 14.7x10 14.7x10', '9.07x10 9.07x8 9.07x6'] },
    { t: 'd2', w: 5, e: ['50x10 50x10 54x8', '32x10 32x8 32x8', '45x10 45x10 41x10', '23x10 23x10 23x10', '9.07x10 9.07x6 9.07x8'] },
    { t: 'd2', w: 6, e: ['54x10 54x6 50x8', '40x10 40x6 32x8', '45x8 40x10 45x10', '27x10 27x10 32x10', '9.07x10 9.07x6 9.07x8'] },
    { t: 'd2', w: 7, e: ['59x10 59x8 59x7', '40x10 40x10 49.9x8', '45x12 50x10 50x10', '14.74x12 19.28x10 19.28x10', '11.34x10 11.34x6 9.07x8'] },
    // ---------- Day 3 Legs A ----------
    { t: 'd3', w: 1, e: ['10x10 10x10 10x10', '15x10 15x10 15x10', '30x10 30x10 30x10', '25x10 25x10 25x10', '0x20 0x20 0x20'] },
    { t: 'd3', w: 2, e: ['7.5x10 15x10 15x10', '5x10 10x10 10x10', '36x12 45x10 54x10', '27x10 32x10 32x10', '0x25 0x20 0x25'], s: [10, 5, 0] },
    { t: 'd3', w: 3, e: ['30x8 30x8 30x8', '10x10 20x10 20x10', '54x12 54x15 54x12', '32x10 32x10 36x10', '0x20 0x15 0x15'] },
    { t: 'd3', w: 4, e: ['22x8 26x8 31x8', '22.6x8 22.6x10 22.6x10', '45x12 45x12 45x15', '40x12 49x10 49x10', '0x20 0x20 0x20'] },
    { t: 'd3', w: 5, e: ['26x8 26x8 26x8', '22.6x10 26x10 26x8', '45x10 45x8 45x8', '40x12 49x10 49x10', '0x25 0x25 0x25'] },
    { t: 'd3', w: 6, e: ['26x8 31.75x8 31.75x8', '22.8x10 27.22x8 27.22x8', '45x10 45x8 45x8', '40x12 49x10 49x10', '0x25 0x25 0x25'] },
    { t: 'd3', w: 7, e: ['40.82x6 40.82x8 40.82x6', '27.22x10 27.22x8 27.22x8', '45x8 45x8 45x8', '49x10 49x10 49x10', '0x20 0x20 0x20'] },
    // ---------- Day 4 Push B ----------
    { t: 'd4', w: 1, e: ['7.5x15 12.5x10 12.5x10', '9.3x15 11.3x10 13.6x10', '23x8 18x10 23x10', '7x10 7x10 7x10', '36x10 41x6 32x10'], s: [5, 7.7, 60] },
    { t: 'd4', w: 2, e: ['5x10 10x10 12.5x10', '9x10 14x10 18x10', '23x10 23x10 23x12', '6.8x10 6.8x10 6.8x10', '36x10 36x10 41x10'] },
    { t: 'd4', w: 3, e: ['25x10 30x10 30x8', '15.9x10 15.9x10 15.9x10', '23x10 23x10 23x10', '6.8x12 6.8x10 6.8x10', '41x10 41x8 36x8'] },
    { t: 'd4', w: 4, e: ['30x8 30x6 30x5', '18.14x10 18.14x10 18.14x10', '23x10 23x10 23x8', '6.8x10 6.8x10 6.8x10', '45.3x10 45.3x10 45.3x10'] },
    { t: 'd4', w: 5, e: ['36.3x8 30x8 30x6', '18.14x10 18.14x10 18.14x8', '22.4x12 22.4x12 22.4x10', '6.8x12 6.8x12 6.8x12', '52.2x10 45.3x6 45.3x8'] },
    { t: 'd4', w: 6, e: ['36.3x8 30x8 30x6', '18.14x10 18.14x10 18.14x8', '22.4x12 22.4x12 22.4x10', '6.8x12 6.8x12 6.8x12', '52.2x10 45.3x6 45.3x8'] },
    { t: 'd4', w: 7, e: ['36.3x8 30x8 30x6', '20.41x8 20.41x8 20.41x8', '22.4x12 22.4x12 22.4x10', '6.8x12 6.8x12 6.8x12', '52.2x10 45.3x6 45.3x8'] },
    // ---------- Day 5 Pull B ----------
    { t: 'd5', w: 1, e: ['32x10 32x10 32x8', '39x10 45x8 39x8', '20x6 11x8 11x6', '18x10 23x8 23x8', '23x10 27x10 23x6'] },
    { t: 'd5', w: 2, e: ['32x12 36x10 36x10', '45x10 45x10 45x10', '18x8 18x6 11x10', '23x10 23x10 23x10', '9x10 11.3x12 11.3x10'] },
    { t: 'd5', w: 3, e: ['20x10 20x8 20x6', '45x8 45x8 45x6', '18x8 18x8 18x6', '23x10 23x10 34x10', '14x15 18x10 18x10'], s: [2, 7, 0] },
    { t: 'd5', w: 4, e: ['11.3x12 22.6x8 22.6x8', '50x8 45x8 45x8', '18x8 18x8 18x8', '31.8x10 38.6x8 38.6x8', '23x12 23x12 23x12'] },
    { t: 'd5', w: 5, e: ['11.3x10 11.3x10 11.3x12', '50x8 45x10 45x10', '18x8 18x8 18x8', '38.6x8 38.6x8 38.6x8', '23x12 23x12 23x12'] },
    { t: 'd5', w: 6, e: ['24.9x8 24.9x10 24.95x8', '54x8 50x8 45x8', '23x8 18x8 18x8', '45.36x8 38.56x8 38.5x8', '23x10 23x10 23x10'] },
    { t: 'd5', w: 7, e: ['29.48x8 29.48x8 29.48x6', '59x7 59x6 59x5', '23x8 23x6 23x6', '45.36x8 38.56x8 38.5x8', '23x10 23x10 23x10'] },
    // ---------- Day 6 Legs B ----------
    { t: 'd6', w: 1, e: ['7.5x12 12.5x10 15x8', '4.5x8 4.5x8 2.5x8', '27x12 27x10 32x8', '23x12 27x10 23x12', '0x20 0x20 0x20'], names: { 2: 'Seated Leg Curl' } },
    { t: 'd6', w: 2, e: ['10x10 12.5x10 12.5x10', '4.5x8 6.8x8 6.8x8', '32x10 32x10 27x12', '27x10 27x10 23x12', '27x20 0x25 0x20'] },
    { t: 'd6', w: 3, e: ['22x8 22x8 22x8', '4.5x6 4.5x6 4.5x6', '32x12 32x10 32x10', '32x10 32x10 24x10', '0x20 0x20 0x20'] },
    { t: 'd6', w: 4, e: ['22x8 22x8 22x8', '4.5x8 4.5x6 6.8x6', '32x15 40x12 40x10', '32x10 32x10 32x10', '0x20 0x20 0x20'] },
    { t: 'd6', w: 5, e: ['22x10 22x10 22x10', '6.8x8 6.8x6 6.8x8', '32x15 40x12 40x10', '32x10 32x10 32x10', '0x20 0x20 0x20'] },
    { t: 'd6', w: 6, e: ['22x10 22x10 22x10', '6.8x8 6.8x6 6.8x8', '32x15 40x12 40x10', '32x10 32x10 32x10', '0x20 0x20 0x20'] },
    { t: 'd6', w: 7, e: ['22x10 22x10 22x10', '6.8x8 6.8x6 6.8x8', '32x15 40x12 40x10', '32x10 32x10 32x10', '0x20 0x20 0x20'] }
  ],
  // Real training days from the Strong calendar, in order. Mapping (counted back from Oct 20 = Push A, week 8):
  // Aug 20 = Push A (not logged), Aug 21 + Aug 22 = extra (not logged), Aug 24 onward = the 42 sheet sessions in rotation order
  calendar: ['2026-08-20','2026-08-21','2026-08-22','2026-08-24','2026-08-25','2026-08-26','2026-08-27','2026-08-29','2026-08-30','2026-08-31',
    '2026-09-01','2026-09-03','2026-09-05','2026-09-08','2026-09-09','2026-09-11','2026-09-12','2026-09-13','2026-09-17','2026-09-18','2026-09-19',
    '2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-27','2026-09-28','2026-09-29','2026-09-30',
    '2026-10-02','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-11','2026-10-12','2026-10-13','2026-10-14',
    '2026-10-16','2026-10-17','2026-10-19','2026-10-20'],
  // [program week, kg] weighed on the Monday of that week
  weights: [[1, 110.0], [2, 107.5], [3, 106.0], [4, 106.3], [5, 105.2]]
};
