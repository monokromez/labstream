// Prototype catalog data. Replace with active records loaded from test_catalog.
export const testCategories = [
  {
    name: 'Hematology',
    tests: [
      { id: 'cbc', name: 'Complete Blood Count (CBC)', price: 400 },
      { id: 'blood-typing', name: 'Blood Typing', price: 250 },
    ],
  },
  {
    name: 'Clinical Chemistry',
    tests: [
      { id: 'fasting-blood-sugar', name: 'Fasting Blood Sugar', price: 150 },
      { id: 'lipid-profile', name: 'Lipid Profile', price: 650 },
      { id: 'creatinine', name: 'Creatinine', price: 250 },
    ],
  },
  {
    name: 'Clinical Microscopy',
    tests: [
      { id: 'urinalysis', name: 'Urinalysis', price: 200 },
      { id: 'fecalysis', name: 'Fecalysis', price: 250 },
    ],
  },
]

export const testCatalog = testCategories.flatMap((category) =>
  category.tests.map((test) => ({ ...test, category: category.name })),
)
