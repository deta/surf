import pptxgen from 'pptxgenjs';

// Create a new presentation
const pres = new pptxgen();

// Set presentation properties
pres.author = 'Medical Education Team';
pres.company = 'Pediatric Healthcare';
pres.subject = 'Hypocalcemia in Pediatric Patients';
pres.title = 'Hypocalcemia in Pediatric Patients: Diagnosis, Management, and Implications';

// Define color scheme - Modern medical theme
const colors = {
  primary: '0066CC',      // Medical blue
  secondary: '00A3A3',    // Teal accent
  dark: '1A1A1A',         // Dark text
  light: 'F5F7FA',        // Light background
  white: 'FFFFFF',
  accent: '4A90E2',       // Light blue
  warning: 'FF6B6B',      // Red for warnings
  success: '51CF66'       // Green for success
};

// Define layout constants
const layout = {
  titleSize: 44,
  headingSize: 32,
  subheadingSize: 24,
  bodySize: 18,
  smallSize: 14,
  margin: 0.5,
  contentTop: 1.5
};

// ============================================
// SLIDE 1: TITLE SLIDE
// ============================================
const slide1 = pres.addSlide();
slide1.background = { color: colors.primary };

// Add gradient overlay effect with shapes
slide1.addShape(pres.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: '100%',
  fill: { type: 'solid', color: colors.primary, transparency: 20 }
});

// Main title
slide1.addText('Hypocalcemia in Pediatric Patients', {
  x: 0.5, y: 2.0, w: 9, h: 1.5,
  fontSize: 48,
  bold: true,
  color: colors.white,
  align: 'center',
  fontFace: 'Arial'
});

// Subtitle
slide1.addText('Diagnosis, Management, and Implications', {
  x: 0.5, y: 3.5, w: 9, h: 0.6,
  fontSize: 28,
  color: colors.white,
  align: 'center',
  fontFace: 'Arial'
});

// Date and presenter placeholder
const today = new Date().toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
});

slide1.addText(`Presented by: [Your Name]\n${today}`, {
  x: 0.5, y: 5.0, w: 9, h: 0.8,
  fontSize: 18,
  color: colors.white,
  align: 'center',
  fontFace: 'Arial'
});

// Decorative element - calcium molecule representation
slide1.addShape(pres.ShapeType.ellipse, {
  x: 8.5, y: 0.3, w: 1.2, h: 1.2,
  fill: { color: colors.secondary, transparency: 30 },
  line: { color: colors.white, width: 2 }
});

slide1.addText('Ca²⁺', {
  x: 8.5, y: 0.5, w: 1.2, h: 0.8,
  fontSize: 32,
  bold: true,
  color: colors.white,
  align: 'center',
  valign: 'middle'
});

// ============================================
// SLIDE 2: AGENDA
// ============================================
const slide2 = pres.addSlide();
slide2.background = { color: colors.white };

// Header
slide2.addText('Agenda', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

// Decorative line
slide2.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

const agendaItems = [
  '1. Introduction to Hypocalcemia',
  '2. Pathophysiology',
  '3. Causes in Pediatrics',
  '4. Clinical Presentation',
  '5. Diagnosis',
  '6. Management and Treatment',
  '7. Complications and Prevention',
  '8. Case Study',
  '9. Conclusion and Q&A'
];

agendaItems.forEach((item, index) => {
  // Bullet point circle
  slide2.addShape(pres.ShapeType.ellipse, {
    x: 1.0, y: 2.0 + (index * 0.5), w: 0.15, h: 0.15,
    fill: { color: colors.secondary }
  });
  
  // Agenda text
  slide2.addText(item, {
    x: 1.3, y: 1.95 + (index * 0.5), w: 7.5, h: 0.4,
    fontSize: layout.bodySize,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// ============================================
// SLIDE 3: INTRODUCTION TO HYPOCALCEMIA
// ============================================
const slide3 = pres.addSlide();
slide3.background = { color: colors.white };

slide3.addText('Introduction to Hypocalcemia', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide3.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Definition box
slide3.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.7, w: 9, h: 1.0,
  fill: { color: colors.light },
  line: { color: colors.secondary, width: 2 }
});

slide3.addText('Definition', {
  x: 0.7, y: 1.8, w: 8.6, h: 0.3,
  fontSize: 20,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide3.addText('Serum total calcium < 8.5 mg/dL or ionized calcium < 4.5 mg/dL', {
  x: 0.7, y: 2.15, w: 8.6, h: 0.4,
  fontSize: layout.bodySize,
  color: colors.dark,
  fontFace: 'Arial'
});

// Key points
const introPoints = [
  {
    title: 'Importance in Pediatrics',
    text: 'Affects bone development, neuromuscular function, and cardiac rhythm; more severe in infants due to higher calcium demands'
  },
  {
    title: 'Epidemiology',
    text: 'Common in NICU settings; prevalence ~10-20% in critically ill children'
  },
  {
    title: 'Critical Functions',
    text: 'Essential for muscle contraction, nerve signaling, blood clotting, and skeletal mineralization'
  }
];

introPoints.forEach((point, index) => {
  const yPos = 3.0 + (index * 1.0);
  
  slide3.addText(`• ${point.title}`, {
    x: 0.7, y: yPos, w: 8.6, h: 0.3,
    fontSize: 20,
    bold: true,
    color: colors.secondary,
    fontFace: 'Arial'
  });
  
  slide3.addText(point.text, {
    x: 1.0, y: yPos + 0.35, w: 8.3, h: 0.5,
    fontSize: 16,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// ============================================
// SLIDE 4: PATHOPHYSIOLOGY
// ============================================
const slide4 = pres.addSlide();
slide4.background = { color: colors.white };

slide4.addText('Pathophysiology', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide4.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Calcium homeostasis flowchart
const flowItems = [
  { label: 'Parathyroid\nGland', x: 1.5, y: 2.0, color: colors.accent },
  { label: 'PTH\nRelease', x: 3.5, y: 2.0, color: colors.secondary },
  { label: 'Vitamin D\nActivation', x: 5.5, y: 2.0, color: colors.secondary },
  { label: 'Calcium\nAbsorption', x: 7.5, y: 2.0, color: colors.success }
];

flowItems.forEach((item, index) => {
  // Box
  slide4.addShape(pres.ShapeType.rect, {
    x: item.x, y: item.y, w: 1.5, h: 0.8,
    fill: { color: item.color, transparency: 20 },
    line: { color: item.color, width: 2 }
  });
  
  // Label
  slide4.addText(item.label, {
    x: item.x, y: item.y, w: 1.5, h: 0.8,
    fontSize: 14,
    bold: true,
    color: colors.dark,
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial'
  });
  
  // Arrow
  if (index < flowItems.length - 1) {
    slide4.addShape(pres.ShapeType.rightArrow, {
      x: item.x + 1.6, y: item.y + 0.3, w: 0.3, h: 0.2,
      fill: { color: colors.dark }
    });
  }
});

// Key mechanisms
slide4.addText('Key Mechanisms in Pediatrics:', {
  x: 0.7, y: 3.3, w: 8.6, h: 0.3,
  fontSize: 22,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

const mechanisms = [
  'Immature kidneys and bones make children vulnerable to calcium imbalances',
  'Low calcium → Increased neuromuscular excitability → Tetany, seizures',
  'Cardiac effects: Prolonged QT interval → Risk of arrhythmias',
  'Regulated by PTH (parathyroid hormone), Vitamin D, and Calcitonin'
];

mechanisms.forEach((mech, index) => {
  slide4.addShape(pres.ShapeType.ellipse, {
    x: 0.9, y: 3.9 + (index * 0.5), w: 0.12, h: 0.12,
    fill: { color: colors.secondary }
  });
  
  slide4.addText(mech, {
    x: 1.1, y: 3.85 + (index * 0.5), w: 8.2, h: 0.4,
    fontSize: 16,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// ============================================
// SLIDE 5: CAUSES IN PEDIATRIC PATIENTS
// ============================================
const slide5 = pres.addSlide();
slide5.background = { color: colors.white };

slide5.addText('Causes in Pediatric Patients', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide5.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Categories with colored boxes
const causes = [
  {
    category: 'Nutritional',
    icon: '🍼',
    items: ['Vitamin D deficiency (rickets)', 'Low calcium intake', 'Malabsorption syndromes'],
    color: 'FFB84D'
  },
  {
    category: 'Endocrine',
    icon: '⚕️',
    items: ['Hypoparathyroidism', 'Pseudohypoparathyroidism', 'DiGeorge syndrome'],
    color: 'A78BFA'
  },
  {
    category: 'Renal',
    icon: '🫘',
    items: ['Chronic kidney disease', 'Dialysis', 'Renal tubular disorders'],
    color: '60A5FA'
  },
  {
    category: 'Iatrogenic',
    icon: '💊',
    items: ['Anticonvulsants', 'Total parenteral nutrition', 'Blood transfusions'],
    color: 'F472B6'
  },
  {
    category: 'Neonatal',
    icon: '👶',
    items: ['Prematurity', 'Maternal diabetes', 'Birth asphyxia'],
    color: '34D399'
  }
];

let xPos = 0.5;
let yPos = 1.8;
let colCount = 0;

causes.forEach((cause, index) => {
  // Category box
  slide5.addShape(pres.ShapeType.rect, {
    x: xPos, y: yPos, w: 3.0, h: 1.5,
    fill: { color: cause.color, transparency: 80 },
    line: { color: cause.color, width: 2 }
  });
  
  // Category title
  slide5.addText(`${cause.icon} ${cause.category}`, {
    x: xPos + 0.1, y: yPos + 0.1, w: 2.8, h: 0.3,
    fontSize: 18,
    bold: true,
    color: colors.dark,
    fontFace: 'Arial'
  });
  
  // Items
  slide5.addText(cause.items.map(item => `• ${item}`).join('\n'), {
    x: xPos + 0.1, y: yPos + 0.5, w: 2.8, h: 0.9,
    fontSize: 12,
    color: colors.dark,
    fontFace: 'Arial'
  });
  
  colCount++;
  if (colCount === 3) {
    xPos = 0.5;
    yPos += 1.7;
    colCount = 0;
  } else {
    xPos += 3.2;
  }
});

// ============================================
// SLIDE 6: CLINICAL PRESENTATION
// ============================================
const slide6 = pres.addSlide();
slide6.background = { color: colors.white };

slide6.addText('Clinical Presentation', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide6.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Symptom categories
const symptoms = [
  {
    system: 'Neuromuscular',
    signs: ['Tetany (Chvostek\'s & Trousseau\'s signs)', 'Seizures', 'Muscle cramps and spasms', 'Paresthesias'],
    color: 'EF4444'
  },
  {
    system: 'Cardiovascular',
    signs: ['Prolonged QT interval', 'Arrhythmias', 'Heart failure', 'Hypotension'],
    color: 'F59E0B'
  },
  {
    system: 'Skeletal',
    signs: ['Rickets', 'Pathological fractures', 'Bone pain', 'Growth retardation'],
    color: '8B5CF6'
  },
  {
    system: 'Infant-Specific',
    signs: ['Irritability', 'Poor feeding', 'Jitteriness', 'Apnea/Laryngospasm'],
    color: '10B981'
  }
];

symptoms.forEach((symptom, index) => {
  const yStart = 1.9 + (index * 1.15);
  
  // System header
  slide6.addShape(pres.ShapeType.rect, {
    x: 0.7, y: yStart, w: 8.6, h: 0.35,
    fill: { color: symptom.color },
    line: { color: symptom.color, width: 1 }
  });
  
  slide6.addText(symptom.system, {
    x: 0.8, y: yStart + 0.05, w: 8.4, h: 0.25,
    fontSize: 18,
    bold: true,
    color: colors.white,
    fontFace: 'Arial'
  });
  
  // Signs
  slide6.addText(symptom.signs.map(s => `  • ${s}`).join('\n'), {
    x: 0.9, y: yStart + 0.4, w: 8.4, h: 0.6,
    fontSize: 14,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// ============================================
// SLIDE 7: DIAGNOSIS
// ============================================
const slide7 = pres.addSlide();
slide7.background = { color: colors.white };

slide7.addText('Diagnosis', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide7.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Diagnostic approach - 3 columns
const diagnostics = [
  {
    title: 'Laboratory Tests',
    icon: '🔬',
    items: [
      'Serum calcium (total)',
      'Ionized calcium',
      'PTH level',
      'Vitamin D (25-OH)',
      'Phosphate',
      'Magnesium',
      'Albumin'
    ]
  },
  {
    title: 'Imaging Studies',
    icon: '📊',
    items: [
      'X-ray (rickets)',
      'Bone density scan',
      'Skeletal survey',
      'Wrist/knee films'
    ]
  },
  {
    title: 'Other Tests',
    icon: '💓',
    items: [
      'ECG (QT interval)',
      'Renal function',
      'Genetic testing',
      'Parathyroid imaging'
    ]
  }
];

diagnostics.forEach((diag, index) => {
  const xStart = 0.5 + (index * 3.3);
  
  // Box
  slide7.addShape(pres.ShapeType.rect, {
    x: xStart, y: 1.9, w: 3.0, h: 3.5,
    fill: { color: colors.light },
    line: { color: colors.secondary, width: 2 }
  });
  
  // Icon and title
  slide7.addText(`${diag.icon} ${diag.title}`, {
    x: xStart + 0.1, y: 2.0, w: 2.8, h: 0.4,
    fontSize: 20,
    bold: true,
    color: colors.primary,
    align: 'center',
    fontFace: 'Arial'
  });
  
  // Items
  diag.items.forEach((item, itemIndex) => {
    slide7.addShape(pres.ShapeType.ellipse, {
      x: xStart + 0.2, y: 2.6 + (itemIndex * 0.35), w: 0.1, h: 0.1,
      fill: { color: colors.secondary }
    });
    
    slide7.addText(item, {
      x: xStart + 0.4, y: 2.55 + (itemIndex * 0.35), w: 2.5, h: 0.3,
      fontSize: 14,
      color: colors.dark,
      fontFace: 'Arial'
    });
  });
});

// Important note
slide7.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 5.6, w: 9, h: 0.6,
  fill: { color: 'FFF3CD' },
  line: { color: 'FFC107', width: 2 }
});

slide7.addText('⚠️ Key Point: Ionized calcium is the gold standard - total calcium can be misleading due to albumin binding', {
  x: 0.7, y: 5.7, w: 8.6, h: 0.4,
  fontSize: 15,
  bold: true,
  color: '856404',
  fontFace: 'Arial'
});

// ============================================
// SLIDE 8: MANAGEMENT AND TREATMENT
// ============================================
const slide8 = pres.addSlide();
slide8.background = { color: colors.white };

slide8.addText('Management and Treatment', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide8.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Acute vs Chronic treatment
const treatments = [
  {
    phase: 'ACUTE MANAGEMENT',
    color: 'DC2626',
    icon: '🚨',
    interventions: [
      {
        title: 'IV Calcium Gluconate',
        details: '10-20 mg/kg over 10-30 minutes',
        note: 'Monitor cardiac rhythm during infusion'
      },
      {
        title: 'Symptomatic Treatment',
        details: 'Seizure control, airway management',
        note: 'Address life-threatening complications first'
      },
      {
        title: 'Correct Magnesium',
        details: 'If hypomagnesemia present',
        note: 'Essential for PTH secretion'
      }
    ]
  },
  {
    phase: 'CHRONIC MANAGEMENT',
    color: '059669',
    icon: '📋',
    interventions: [
      {
        title: 'Oral Calcium',
        details: '30-75 mg/kg/day in divided doses',
        note: 'Calcium carbonate or citrate'
      },
      {
        title: 'Vitamin D',
        details: 'Calcitriol 0.25-2 mcg/day',
        note: 'Monitor for hypercalcemia'
      },
      {
        title: 'Treat Underlying Cause',
        details: 'Address nutritional deficiency, endocrine disorder',
        note: 'Long-term success depends on etiology'
      }
    ]
  }
];

treatments.forEach((treatment, tIndex) => {
  const yStart = 1.9 + (tIndex * 2.2);
  
  // Phase header
  slide8.addShape(pres.ShapeType.rect, {
    x: 0.5, y: yStart, w: 9, h: 0.4,
    fill: { color: treatment.color }
  });
  
  slide8.addText(`${treatment.icon} ${treatment.phase}`, {
    x: 0.6, y: yStart + 0.05, w: 8.8, h: 0.3,
    fontSize: 22,
    bold: true,
    color: colors.white,
    fontFace: 'Arial'
  });
  
  // Interventions
  treatment.interventions.forEach((intervention, iIndex) => {
    const xStart = 0.5 + (iIndex * 3.3);
    
    slide8.addShape(pres.ShapeType.rect, {
      x: xStart, y: yStart + 0.5, w: 3.0, h: 1.3,
      fill: { color: colors.light },
      line: { color: treatment.color, width: 2 }
    });
    
    slide8.addText(intervention.title, {
      x: xStart + 0.1, y: yStart + 0.6, w: 2.8, h: 0.25,
      fontSize: 16,
      bold: true,
      color: colors.dark,
      fontFace: 'Arial'
    });
    
    slide8.addText(intervention.details, {
      x: xStart + 0.1, y: yStart + 0.9, w: 2.8, h: 0.3,
      fontSize: 13,
      color: colors.primary,
      fontFace: 'Arial'
    });
    
    slide8.addText(intervention.note, {
      x: xStart + 0.1, y: yStart + 1.25, w: 2.8, h: 0.4,
      fontSize: 11,
      italic: true,
      color: '666666',
      fontFace: 'Arial'
    });
  });
});

// ============================================
// SLIDE 9: COMPLICATIONS
// ============================================
const slide9 = pres.addSlide();
slide9.background = { color: colors.white };

slide9.addText('Complications & Prevention', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide9.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Complications section
slide9.addText('⚠️ Potential Complications', {
  x: 0.7, y: 1.8, w: 4.3, h: 0.4,
  fontSize: 24,
  bold: true,
  color: 'DC2626',
  fontFace: 'Arial'
});

const complications = [
  { type: 'Short-term', items: ['Seizures', 'Cardiac arrest', 'Laryngospasm', 'Respiratory failure'] },
  { type: 'Long-term', items: ['Developmental delays', 'Osteoporosis', 'Dental problems', 'Cataracts'] }
];

complications.forEach((comp, index) => {
  const yStart = 2.3 + (index * 1.3);
  
  slide9.addShape(pres.ShapeType.rect, {
    x: 0.7, y: yStart, w: 4.3, h: 1.0,
    fill: { color: 'FEE2E2' },
    line: { color: 'DC2626', width: 2 }
  });
  
  slide9.addText(comp.type, {
    x: 0.8, y: yStart + 0.1, w: 4.1, h: 0.25,
    fontSize: 18,
    bold: true,
    color: 'DC2626',
    fontFace: 'Arial'
  });
  
  slide9.addText(comp.items.map(i => `• ${i}`).join('  '), {
    x: 0.8, y: yStart + 0.4, w: 4.1, h: 0.5,
    fontSize: 14,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// Prevention section
slide9.addText('✅ Prevention Strategies', {
  x: 5.3, y: 1.8, w: 4.2, h: 0.4,
  fontSize: 24,
  bold: true,
  color: '059669',
  fontFace: 'Arial'
});

slide9.addShape(pres.ShapeType.rect, {
  x: 5.3, y: 2.3, w: 4.2, h: 2.3,
  fill: { color: 'D1FAE5' },
  line: { color: '059669', width: 2 }
});

const prevention = [
  'Vitamin D supplementation (400 IU/day for infants)',
  'Adequate calcium intake (age-appropriate)',
  'Breastfeeding support',
  'Screen high-risk populations (preterm, maternal diabetes)',
  'Monitor at-risk medications',
  'Regular well-child visits',
  'Parental education'
];

prevention.forEach((item, index) => {
  slide9.addShape(pres.ShapeType.ellipse, {
    x: 5.5, y: 2.5 + (index * 0.3), w: 0.1, h: 0.1,
    fill: { color: '059669' }
  });
  
  slide9.addText(item, {
    x: 5.7, y: 2.47 + (index * 0.3), w: 3.7, h: 0.25,
    fontSize: 13,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// Key message
slide9.addShape(pres.ShapeType.rect, {
  x: 0.7, y: 5.0, w: 8.8, h: 0.7,
  fill: { color: colors.secondary },
  line: { color: colors.secondary, width: 2 }
});

slide9.addText('💡 Early recognition and prompt treatment prevent serious complications and improve outcomes', {
  x: 0.9, y: 5.15, w: 8.4, h: 0.4,
  fontSize: 18,
  bold: true,
  color: colors.white,
  align: 'center',
  valign: 'middle',
  fontFace: 'Arial'
});

// ============================================
// SLIDE 10: CASE STUDY
// ============================================
const slide10 = pres.addSlide();
slide10.background = { color: colors.white };

slide10.addText('Case Study', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide10.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

// Patient presentation
slide10.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.7, w: 9, h: 0.5,
  fill: { color: colors.primary }
});

slide10.addText('👶 Patient Presentation', {
  x: 0.7, y: 1.8, w: 8.6, h: 0.3,
  fontSize: 22,
  bold: true,
  color: colors.white,
  fontFace: 'Arial'
});

slide10.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 2.3, w: 9, h: 1.0,
  fill: { color: colors.light },
  line: { color: colors.primary, width: 2 }
});

slide10.addText(
  '6-month-old infant presents to ED with seizures\n' +
  'History: Exclusively breastfed, limited sun exposure, no vitamin D supplementation\n' +
  'Physical exam: Irritable, positive Chvostek\'s sign, developmental delay',
  {
    x: 0.7, y: 2.4, w: 8.6, h: 0.8,
    fontSize: 16,
    color: colors.dark,
    fontFace: 'Arial'
  }
);

// Laboratory findings
slide10.addText('🔬 Laboratory Findings', {
  x: 0.7, y: 3.5, w: 4.3, h: 0.3,
  fontSize: 20,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

const labResults = [
  { test: 'Serum Calcium', value: '6.5 mg/dL', normal: '(8.5-10.5)', abnormal: true },
  { test: 'Ionized Calcium', value: '3.8 mg/dL', normal: '(4.5-5.3)', abnormal: true },
  { test: 'Vitamin D (25-OH)', value: '8 ng/mL', normal: '(>20)', abnormal: true },
  { test: 'PTH', value: 'Elevated', normal: '', abnormal: true },
  { test: 'Phosphate', value: 'Normal', normal: '', abnormal: false }
];

labResults.forEach((lab, index) => {
  const bgColor = lab.abnormal ? 'FEE2E2' : 'D1FAE5';
  const textColor = lab.abnormal ? 'DC2626' : '059669';
  
  slide10.addShape(pres.ShapeType.rect, {
    x: 0.7, y: 3.9 + (index * 0.3), w: 4.3, h: 0.25,
    fill: { color: bgColor },
    line: { color: textColor, width: 1 }
  });
  
  slide10.addText(lab.test, {
    x: 0.8, y: 3.92 + (index * 0.3), w: 2.0, h: 0.2,
    fontSize: 14,
    bold: true,
    color: colors.dark,
    fontFace: 'Arial'
  });
  
  slide10.addText(`${lab.value} ${lab.normal}`, {
    x: 2.9, y: 3.92 + (index * 0.3), w: 2.0, h: 0.2,
    fontSize: 14,
    color: textColor,
    fontFace: 'Arial'
  });
});

// Diagnosis and treatment
slide10.addText('💊 Management', {
  x: 5.3, y: 3.5, w: 4.2, h: 0.3,
  fontSize: 20,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide10.addShape(pres.ShapeType.rect, {
  x: 5.3, y: 3.9, w: 4.2, h: 1.5,
  fill: { color: 'E0F2FE' },
  line: { color: colors.accent, width: 2 }
});

const management = [
  '1. IV calcium gluconate (acute)',
  '2. Vitamin D supplementation',
  '3. Oral calcium supplements',
  '4. Seizure control',
  '5. Parent education'
];

management.forEach((step, index) => {
  slide10.addText(step, {
    x: 5.5, y: 4.0 + (index * 0.28), w: 3.8, h: 0.25,
    fontSize: 14,
    color: colors.dark,
    fontFace: 'Arial'
  });
});

// Outcome
slide10.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 5.6, w: 9, h: 0.6,
  fill: { color: '059669' }
});

slide10.addText('✅ Outcome: Seizures resolved within 48 hours. Full recovery with ongoing vitamin D supplementation.', {
  x: 0.7, y: 5.7, w: 8.6, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fontFace: 'Arial'
});

// ============================================
// SLIDE 11: KEY TAKEAWAYS
// ============================================
const slide11 = pres.addSlide();
slide11.background = { color: colors.white };

slide11.addText('Key Takeaways', {
  x: 0.5, y: 0.5, w: 9, h: 0.7,
  fontSize: layout.titleSize,
  bold: true,
  color: colors.primary,
  fontFace: 'Arial'
});

slide11.addShape(pres.ShapeType.rect, {
  x: 0.5, y: 1.3, w: 2, h: 0.05,
  fill: { color: colors.secondary }
});

const takeaways = [
  {
    number: '1',
    title: 'Early Recognition is Critical',
    text: 'Hypocalcemia can present with life-threatening symptoms. High index of suspicion in at-risk populations.',
    color: 'EF4444'
  },
  {
    number: '2',
    title: 'Accurate Diagnosis',
    text: 'Measure ionized calcium for true assessment. Investigate underlying causes (PTH, vitamin D, renal function).',
    color: 'F59E0B'
  },
  {
    number: '3',
    title: 'Tailored Treatment',
    text: 'Acute: IV calcium for symptomatic patients. Chronic: Address underlying cause with supplements and monitoring.',
    color: '8B5CF6'
  },
  {
    number: '4',
    title: 'Prevention Matters',
    text: 'Vitamin D supplementation, adequate nutrition, and screening high-risk infants prevent complications.',
    color: '10B981'
  },
  {
    number: '5',
    title: 'Multidisciplinary Approach',
    text: 'Collaboration between pediatrics, endocrinology, nutrition, and family education ensures optimal outcomes.',
    color: '0EA5E9'
  }
];

takeaways.forEach((takeaway, index) => {
  const yPos = 1.9 + (index * 0.85);
  
  // Number circle
  slide11.addShape(pres.ShapeType.ellipse, {
    x: 0.7, y: yPos, w: 0.5, h: 0.5,
    fill: { color: takeaway.color }
  });
  
  slide11.addText(takeaway.number, {
    x: 0.7, y: yPos, w: 0.5, h: 0.5,
    fontSize: 28,
    bold: true,
    color: colors.white,
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial'
  });
  
  // Content box
  slide11.addShape(pres.ShapeType.rect, {
    x: 1.4, y: yPos, w: 8.1, h: 0.7,
    fill: { color: colors.light },
    line: { color: takeaway.color, width: 2 }
  });
  
  slide11.addText(takeaway.title, {
    x: 1.5, y: yPos + 0.05, w: 7.9, h: 0.25,
    fontSize: 18,
    bold: true,
    color: colors.dark,
    fontFace: 'Arial'
  });
  
  slide11.addText(takeaway.text, {
    x: 1.5, y: yPos + 0.32, w: 7.9, h: 0.35,
    fontSize: 14,
    color: '4B5563',
    fontFace: 'Arial'
  });
});

// ============================================
// SLIDE 12: CONCLUSION AND Q&A
// ============================================
const slide12 = pres.addSlide();
slide12.background = { color: colors.primary };

// Gradient overlay
slide12.addShape(pres.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: '100%',
  fill: { type: 'solid', color: colors.primary, transparency: 10 }
});

slide12.addText('Thank You', {
  x: 0.5, y: 1.5, w: 9, h: 1.0,
  fontSize: 54,
  bold: true,
  color: colors.white,
  align: 'center',
  fontFace: 'Arial'
});

slide12.addText('Questions & Discussion', {
  x: 0.5, y: 2.7, w: 9, h: 0.6,
  fontSize: 32,
  color: colors.white,
  align: 'center',
  fontFace: 'Arial'
});

// Question mark icon
slide12.addShape(pres.ShapeType.ellipse, {
  x: 4.5, y: 3.7, w: 1.0, h: 1.0,
  fill: { color: colors.secondary },
  line: { color: colors.white, width: 3 }
});

slide12.addText('?', {
  x: 4.5, y: 3.7, w: 1.0, h: 1.0,
  fontSize: 60,
  bold: true,
  color: colors.white,
  align: 'center',
  valign: 'middle',
  fontFace: 'Arial'
});

// References
slide12.addText(
  'References:\n' +
  '• American Academy of Pediatrics (AAP) Guidelines\n' +
  '• Pediatrics Journal - Hypocalcemia in Children\n' +
  '• UpToDate: Calcium Disorders in Pediatrics\n' +
  '• New England Journal of Medicine',
  {
    x: 1.5, y: 5.0, w: 7.0, h: 1.0,
    fontSize: 12,
    color: colors.white,
    align: 'center',
    fontFace: 'Arial'
  }
);

// Save the presentation
console.log('Generating PowerPoint presentation...');
await pres.writeFile({ fileName: 'Hypocalcemia_Pediatric_Patients.pptx' });
console.log('✅ Presentation created successfully: Hypocalcemia_Pediatric_Patients.pptx');
console.log('\nPresentation Details:');
console.log('- Total Slides: 12');
console.log('- Theme: Modern Medical (Blue & Teal)');
console.log('- Content: Comprehensive coverage of hypocalcemia in pediatrics');
console.log('- Features: Professional design, clear structure, medical accuracy');
console.log('\nSlide Breakdown:');
console.log('1. Title Slide');
console.log('2. Agenda');
console.log('3. Introduction to Hypocalcemia');
console.log('4. Pathophysiology');
console.log('5. Causes in Pediatric Patients');
console.log('6. Clinical Presentation');
console.log('7. Diagnosis');
console.log('8. Management and Treatment');
console.log('9. Complications & Prevention');
console.log('10. Case Study');
console.log('11. Key Takeaways');
console.log('12. Conclusion and Q&A');
