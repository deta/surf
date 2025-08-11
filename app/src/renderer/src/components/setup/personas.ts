export enum Persona {
  Student = 'Student',
  SoftwareEngineer = 'Software Engineer',
  Designer = 'Designer',
  Entrepreneur = 'Entrepreneur',
  Marketing = 'Marketing',
  Artist = 'Artist',
  Researcher = 'Researcher',
  ProductManager = 'Product Manager',
  Writer = 'Writer',
  Other = 'Other'
}

// Helper to get all persona values as an array
export const PERSONAS = Object.values(Persona)
