export const medicalTechnologistTests = [
  {
    name: 'Fasting Blood Sugar',
    category: 'Laboratory',
    specimenType: 'Serum',
    fields: [
      { key: 'fbs', label: 'Fasting Blood Sugar', unit: 'mg/dL', range: '70 - 100', valueType: 'numeric' },
    ],
  },
  {
    name: 'Creatinine',
    category: 'Laboratory',
    specimenType: 'Serum',
    fields: [
      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', range: { Male: '0.7 - 1.3', Female: '0.6 - 1.1' }, valueType: 'numeric' },
    ],
  },
  {
    name: 'Cholesterol',
    category: 'Laboratory',
    specimenType: 'Serum',
    fields: [
      { key: 'cholesterol', label: 'Cholesterol', unit: 'mg/dL', range: '< 200', valueType: 'numeric' },
    ],
  },
  {
    name: 'Triglycerides',
    category: 'Laboratory',
    specimenType: 'Serum',
    fields: [
      { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', range: '< 150', valueType: 'numeric' },
    ],
  },
  {
    name: 'CBC with Platelet Count',
    category: 'Laboratory',
    specimenType: 'Whole blood (EDTA)',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', range: { Male: '13.5 - 17.5', Female: '12.0 - 15.5' }, valueType: 'numeric' },
      { key: 'hematocrit', label: 'Hematocrit', unit: '%', range: { Male: '40 - 52', Female: '36 - 46' }, valueType: 'numeric' },
      { key: 'wbc', label: 'WBC Count', unit: 'x10^3/uL', range: '4.5 - 11.0', valueType: 'numeric' },
      { key: 'platelets', label: 'Platelet Count', unit: 'x10^3/uL', range: '150 - 450', valueType: 'numeric' },
    ],
  },
  {
    name: 'Complete Urinalysis',
    category: 'Laboratory',
    specimenType: 'Urine',
    fields: [
      { key: 'color', label: 'Color', unit: '-', range: '', valueType: 'text' },
      { key: 'transparency', label: 'Transparency', unit: '-', range: '', valueType: 'text' },
      { key: 'ph', label: 'pH', unit: '-', range: '4.6 - 8.0', valueType: 'numeric' },
      { key: 'specific-gravity', label: 'Specific Gravity', unit: '-', range: '1.005 - 1.030', valueType: 'numeric' },
      { key: 'protein', label: 'Protein', unit: '-', range: '', valueType: 'text' },
      { key: 'glucose', label: 'Glucose', unit: '-', range: '', valueType: 'text' },
    ],
  },
  {
    name: 'Urine Culture and Sensitivity',
    category: 'Microbiology',
    specimenType: 'Urine',
    fields: [
      { key: 'findings', label: 'Findings', valueType: 'text' },
      { key: 'impression', label: 'Impression', valueType: 'text' },
    ],
  },
  {
    name: 'Skin Biopsy',
    category: 'Histopathology',
    specimenType: 'Tissue (formalin)',
    fields: [
      { key: 'gross-description', label: 'Gross description', valueType: 'text' },
      { key: 'microscopic-description', label: 'Microscopic description', valueType: 'text' },
      { key: 'diagnosis', label: 'Diagnosis', valueType: 'text' },
    ],
  },
]

const testsFor = (...names) => names.map((name) =>
  medicalTechnologistTests.find((test) => test.name === name),
)

export const initialTechnologistRequests = [
  { id: 'REQ-2026-0205', patient: 'Ramos, Jose M.', patientId: 'PID-000101', age: 45, sex: 'Male', queueNo: 'Q-006', paidAt: '2026-10-23T07:58:00', receiptNo: 'OR-5512', tests: testsFor('Skin Biopsy') },
  { id: 'REQ-2026-0203', patient: 'Santos, Pedro S.', patientId: 'PID-000119', age: 52, sex: 'Male', queueNo: 'Q-009', paidAt: '2026-10-23T08:15:00', receiptNo: 'OR-5518', tests: testsFor('Urine Culture and Sensitivity') },
  { id: 'REQ-2026-0201', patient: 'Dela Cruz, Juan A.', patientId: 'PID-000123', age: 19, sex: 'Male', queueNo: 'Q-012', paidAt: '2026-10-23T08:42:00', receiptNo: 'OR-5521', tests: testsFor('Fasting Blood Sugar', 'Creatinine', 'Cholesterol') },
  { id: 'REQ-2026-0202', patient: 'Reyes, Maria L.', patientId: 'PID-000124', age: 34, sex: 'Female', queueNo: 'Q-013', paidAt: '2026-10-23T08:50:00', receiptNo: 'OR-5522', tests: testsFor('CBC with Platelet Count', 'Complete Urinalysis') },
  { id: 'REQ-2026-0204', patient: 'Garcia, Ana B.', patientId: 'PID-000125', age: 27, sex: 'Female', queueNo: 'Q-014', paidAt: '2026-10-23T09:05:00', receiptNo: 'OR-5524', tests: testsFor('CBC with Platelet Count') },
  { id: 'REQ-2026-0206', patient: 'Mendoza, Liza P.', patientId: 'PID-000126', age: 61, sex: 'Female', queueNo: 'Q-015', paidAt: '2026-10-23T09:12:00', receiptNo: 'OR-5526', tests: testsFor('Cholesterol', 'Triglycerides') },
  { id: 'REQ-2026-0207', patient: 'Bautista, Carlo D.', patientId: 'PID-000127', age: 30, sex: 'Male', queueNo: 'Q-016', paidAt: '2026-10-23T09:20:00', receiptNo: 'OR-5528', tests: testsFor('Fasting Blood Sugar') },
]

export const initialTechnologistSpecimens = [
  { label: 'SP-0201-A', requestId: 'REQ-2026-0201', type: 'Serum', collectedAt: '', status: 'Expected', reason: '', recollectionOf: '' },
  { label: 'SP-0202-A', requestId: 'REQ-2026-0202', type: 'Whole blood (EDTA)', collectedAt: '2026-10-23T08:58:00', status: 'Received', reason: '', recollectionOf: '' },
  { label: 'SP-0202-B', requestId: 'REQ-2026-0202', type: 'Urine', collectedAt: '', status: 'Expected', reason: '', recollectionOf: '' },
  { label: 'SP-0203-A', requestId: 'REQ-2026-0203', type: 'Urine', collectedAt: '2026-10-23T08:30:00', status: 'Accepted', reason: '', recollectionOf: '' },
  { label: 'SP-0204-A', requestId: 'REQ-2026-0204', type: 'Whole blood (EDTA)', collectedAt: '2026-10-23T09:10:00', status: 'Accepted', reason: '', recollectionOf: '' },
  { label: 'SP-0205-A', requestId: 'REQ-2026-0205', type: 'Tissue (formalin)', collectedAt: '2026-10-23T08:05:00', status: 'Accepted', reason: '', recollectionOf: '' },
  { label: 'SP-0206-A', requestId: 'REQ-2026-0206', type: 'Serum', collectedAt: '2026-10-23T09:15:00', status: 'Rejected', reason: 'Hemolyzed sample', recollectionOf: '' },
  { label: 'SP-0206-A-R1', requestId: 'REQ-2026-0206', type: 'Serum', collectedAt: '', status: 'Expected', reason: '', recollectionOf: 'SP-0206-A' },
  { label: 'SP-0207-A', requestId: 'REQ-2026-0207', type: 'Serum', collectedAt: '2026-10-23T09:24:00', status: 'Accepted', reason: '', recollectionOf: '' },
]

export const initialTechnologistResults = [
  {
    specimenLabel: 'SP-0203-A',
    requestId: 'REQ-2026-0203',
    state: 'awaiting',
    values: {},
    feedback: '',
    submittedAt: '',
    labNumbers: [{ category: 'Microbiology', number: 'LAB-2026-000301' }],
  },
  {
    specimenLabel: 'SP-0204-A',
    requestId: 'REQ-2026-0204',
    state: 'draft',
    values: { hemoglobin: '13.8', hematocrit: '47' },
    feedback: '',
    submittedAt: '',
    labNumbers: [{ category: 'Laboratory', number: 'LAB-2026-000302' }],
  },
  {
    specimenLabel: 'SP-0205-A',
    requestId: 'REQ-2026-0205',
    state: 'returned',
    values: {
      'gross-description': 'One tan skin fragment measuring 0.4 cm in diameter.',
      'microscopic-description': 'Skin with mild chronic inflammation.',
      diagnosis: 'Chronic dermatitis.',
    },
    feedback: 'Please describe the surgical margins in the microscopic description.',
    submittedAt: '',
    labNumbers: [{ category: 'Histopathology', number: 'LAB-2026-000303' }],
  },
  {
    specimenLabel: 'SP-0207-A',
    requestId: 'REQ-2026-0207',
    state: 'validation',
    values: { fbs: '126' },
    feedback: '',
    submittedAt: '2026-10-23T09:48:00',
    labNumbers: [{ category: 'Laboratory', number: 'LAB-2026-000304' }],
  },
]

export const rejectionReasons = [
  'Hemolyzed sample',
  'Insufficient volume',
  'Wrong or missing label',
  'Contaminated sample',
  'Wrong container',
  'Other',
]
